import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { generateKeyPair, SignJWT, jwtVerify } from 'jose';

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/server/photo-service.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, Request, Response, URL, Uint8Array, TextDecoder, crypto: webcrypto });
const { createPhotoService, PhotoError } = exports;
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
function harness() {
  const objects = new Map();
  const state = { allowed: true, reads: 0, checks: 0 };
  const service = createPhotoService({
    requireStaff: async req => { state.checks++; if (!req.headers.has('authorization') || !state.allowed) throw new PhotoError(403, 'Denied'); },
    bucket: () => ({
      put: async (key, bytes, options) => objects.set(key, { bytes, options }),
      get: async key => { state.reads++; const object = objects.get(key); return object && { body: object.bytes, size: object.bytes.length, httpMetadata: object.options.httpMetadata }; },
      delete: async key => objects.delete(key),
    }),
  });
  return { service, objects, state };
}
const request = (path, staff = false) => new Request(`https://example.test/api/photos/${path}`, { headers: staff ? { Authorization: 'Bearer test' } : {} });
const upload = (folder, staff = false, body = png, mime = 'image/png') => new Request(`https://example.test/api/photos?bucket=${folder}`, {
  method: 'POST', body, headers: { 'Content-Type': mime, ...(staff ? { Authorization: 'Bearer test' } : {}) },
});
test('customer uploads stay private; staff reads are uncached and revocation applies immediately', async () => {
  const { service, state } = harness();
  const saved = await service.upload(upload('consignment-photos'));
  assert.equal(saved.status, 201);
  const { path } = await saved.json();
  assert.match(path, /^consignment-photos\/[\w-]+\.png$/);
  assert.equal((await service.read(request(path), path)).status, 403);
  assert.equal(state.reads, 0);
  const photo = await service.read(request(path, true), path);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(new Uint8Array(await photo.arrayBuffer()), png);
  state.allowed = false;
  assert.equal((await service.read(request(path, true), path)).status, 403);
});
test('only staff upload listing images; listing photos are public', async () => {
  const { service } = harness();
  assert.equal((await service.upload(upload('property-photos'))).status, 403);
  const { path } = await (await service.upload(upload('property-photos', true))).json();
  assert.equal((await service.read(request(path), path)).status, 200);
  assert.equal((await service.remove(request(path), path)).status, 403);
  assert.equal((await service.remove(request(path, true), path)).status, 204);
  assert.equal((await service.read(request(path), path)).status, 404);
});
test('missing private photos reveal no existence information before authorization', async () => {
  const { service } = harness();
  const path = 'consignment-photos/missing.png';
  assert.equal((await service.read(request(path), path)).status, 403);
  assert.equal((await service.read(request(path, true), path)).status, 404);
});
test('rejects forged images, empty/oversized files, paths outside photo folders, and list requests', async () => {
  const { service, objects } = harness();
  for (const [body, mime, status] of [['<svg/>', 'image/png', 415], [png, 'image/svg+xml', 415], [new Uint8Array(), 'image/png', 415], [new Uint8Array(5 * 1024 * 1024 + 1), 'image/png', 413]]) {
    assert.equal((await service.upload(upload('consignment-photos', false, body, mime))).status, status);
  }
  for (const path of ['profiles/admin', '../photo.png', 'consignment-photos', 'https://other.test/image.png', 'consignment-photos/x.svg']) {
    assert.equal((await service.read(request(path, true), path)).status, 400);
  }
  assert.equal(objects.size, 0);
});
test('separate uploads cannot replace an existing private object', async () => {
  const { service, objects } = harness();
  const a = await (await service.upload(upload('consignment-photos'))).json();
  const b = await (await service.upload(upload('consignment-photos'))).json();
  assert.notEqual(a.path, b.path);
  assert.equal(objects.size, 2);
});

test('photo authorization verifies signature, project, expiry, email and the current Firestore role', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  let role = 'ADMIN';
  let reads = 0;
  const staffExports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/server/staff.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports: staffExports, URL, AbortSignal,
    process: { env: { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project' } },
    fetch: async () => { reads++; return Response.json({ fields: { role: { stringValue: role } } }); },
    require(name) {
      if (name === 'jose') return { createRemoteJWKSet: () => publicKey, jwtVerify };
      if (name === './photo-service') return { PhotoError };
      throw new Error(name);
    },
  });
  async function token({ verified = true, audience = 'test-project', expiration = '5m', key = privateKey } = {}) {
    return new SignJWT({ email_verified: verified }).setProtectedHeader({ alg: 'RS256' }).setSubject('staff-id')
      .setIssuer('https://securetoken.google.com/test-project').setAudience(audience).setIssuedAt().setExpirationTime(expiration).sign(key);
  }
  const check = jwt => staffExports.requireFirebaseStaff(new Request('https://example.test', { headers: { Authorization: `Bearer ${jwt}` } }));
  const good = await token();
  await check(good);
  role = 'USER';
  await assert.rejects(check(good), { status: 403 });
  const priorReads = reads;
  for (const options of [{ verified: false }, { audience: 'wrong-project' }, { expiration: 1 }, { key: (await generateKeyPair('RS256')).privateKey }]) {
    await assert.rejects(check(await token(options)), { status: 401 });
  }
  assert.equal(reads, priorReads);
});
