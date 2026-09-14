import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/store/properties-store.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function harness(response, configured = true, firebase = null, moduleSource = compiled) {
  const calls = [];
  const firebaseCalls = [];
  const firestore = {};
  for (const method of ['collection', 'doc', 'query', 'where', 'orderBy']) {
    firestore[method] = (...args) => { firebaseCalls.push([method, ...args]); return { id: args.at(-1) || 'generated-id' }; };
  }
  for (const method of ['getDoc', 'getDocs', 'setDoc', 'updateDoc', 'deleteDoc']) {
    firestore[method] = async (...args) => {
      firebaseCalls.push([method, ...args]);
      if (firebase?.error) throw firebase.error;
      if (method === 'getDoc') return { id: 'test', exists: () => firebase?.exists !== false, data: () => firebase?.property || {} };
      if (method === 'getDocs') return { docs: (firebase?.rows || []).map(row => ({ id: row.id, data: () => row })) };
    };
  }
  const chain = { then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); } };
  for (const method of ['select', 'eq', 'order', 'insert', 'update', 'single', 'maybeSingle']) {
    chain[method] = (...args) => { calls.push([method, ...args]); return chain; };
  }
  const client = { from(table) { calls.push(['from', table]); return chain; } };
  const exports = {};
  vm.runInNewContext(moduleSource, {
    exports, console, crypto: { randomUUID },
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test', ...(firebase ? { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project', NEXT_PUBLIC_[...] } : {}) } },
    localStorage: new Proxy({}, { get() { throw new Error('Unexpected localStorage access'); } }),
    require(name) {
      if (name === '@/lib/firebase/public-reader') return { readPublicProperties() { if (firebase?.error) throw firebase.error; return firebase?.rows || []; } };
      if (name === '@/lib/firebase/client') return { db: firebase ? {} : null, isFirebaseConfigured: !!firebase,
        requireFirebaseDatabase() { if (firebase?.unavailable) throw new Error('Firebase unavailable'); return {}; } };
      if (name === 'firebase/firestore') return firestore;
      if (name === 'react') return { cache: fn => fn };
      if (name === '@supabase/supabase-js') return { createClient() { calls.push(['createClient']); return client; } };
      if (name === '@/lib/supabase/client') return { supabase: configured ? client : null, isSupabaseConfigured: configured };
      if (name === '@/data/sample-properties') return { SAMPLE_PROPERTIES: [{ id: 'DEMO' }] };
      if (name === '@/lib/property-data') return {
        demoDataEnabled: true,
        PROPERTY_SELECT: '*',
        rowToProperty: row => row,
        filterProperties: (rows) => rows,
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { store: exports, calls, firebaseCalls };
}
const inquiry = { name: 'Test', phone: '0812345678', message: 'Test', property_title: 'Display only', inquiry_type: 'inquiry', status: 'new' };
test('public insert omits display title and does not SELECT private data', async () => {
  const { store, calls } = harness({ error: null });
  const saved = await store.submitInquiry(inquiry);
  assert.equal('property_title' in calls.find(c => c[0] === 'insert')[1], false);
  assert.equal(calls.some(c => c[0] === 'select'), false);
  assert.match(saved.id, /^[0-9a-f-]{36}$/);
});
test('failed submission rejects instead of claiming success', async () => {
  await assert.rejects(harness({ error: { code: '42501' } }).store.submitInquiry(inquiry));
});
test('missing configuration cannot accept customer data', async () => {
  const { store } = harness({}, false);
  await assert.rejects(store.submitInquiry(inquiry));
  await assert.rejects(store.fetchInquiries());
});
test('empty database never reintroduces demo listings', async () => {
  assert.equal((await harness({ data: [], error: null }).store.fetchProperties()).length, 0);
});
test('read failure does not fall back to demo listings', async () => {
  await assert.rejects(harness({ error: new Error('offline') }).store.fetchProperties());
});
test('staff can request drafts, public query filters published', async () => {
  const { store, calls } = harness({ data: [], error: null });
  await store.fetchProperties();
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'published' && c[2] === true));
  calls.length = 0;
  await store.fetchProperties(undefined, true);
  assert.equal(calls.some(c => c[0] === 'eq' && c[1] === 'published'), false);
});
test('status persists remotely and denied update rejects', async () => {
  const { store, calls } = harness({ data: { id: 'test' }, error: null });
  await store.updateInquiryStatus('test', 'scheduled');
  assert.equal(calls.find(c => c[0] === 'update')[1].status, 'scheduled');
  await assert.rejects(harness({ data: null, error: { code: '42501' } }).store.updateInquiryStatus('test', 'closed'));
});

test('Firebase update returns the merged property and delete returns true without secondary writes', async () => {
  const { store, calls, firebaseCalls } = harness({}, true, { property: { title: 'Before', created_at: 'original', images: ['old'] } });
  const saved = await store.updateProperty('test', { id: 'wrong', title: 'After', created_at: 'wrong', images: ['new'] });
  assert.equal(saved.id, 'test');
  assert.equal(saved.title, 'After');
  assert.equal(saved.created_at, 'original');
  assert.equal(saved.images[0], 'new');
  assert.equal(firebaseCalls.at(-1)[0], 'updateDoc');
  assert.equal(await store.deleteProperty('test'), true);
  assert.equal(calls.length, 0);
});

test('Firebase create and inquiry mutations return immediately after persistence', async () => {
  const { store, calls, firebaseCalls } = harness({}, true, { exists: false });
  const saved = await store.createProperty({ id: 'new-property', title: 'New', images: ['image'] });
  assert.equal(saved.id, 'new-property');
  assert.ok(saved.created_at);
  const submitted = await store.submitInquiry({ ...inquiry, line_id: undefined, status: 'closed' });
  assert.equal(submitted.status, 'new');
  assert.ok(submitted.id);
  assert.equal('line_id' in firebaseCalls.at(-1)[2], false);
  assert.equal(await store.updateInquiryStatus('test', 'scheduled'), undefined);
  assert.equal(firebaseCalls.at(-1)[0], 'updateDoc');
  assert.equal(calls.length, 0);
});

test('Firebase empty fetches and missing documents never fall through', async () => {
  const { store, calls, firebaseCalls } = harness({}, true, { exists: false });
  assert.equal((await store.fetchProperties()).length, 0);
  assert.ok(firebaseCalls.some(c => c[0] === 'where' && c[1] === 'published'));
  firebaseCalls.length = 0;
  await store.fetchProperties(undefined, true);
  assert.equal(firebaseCalls.some(c => c[0] === 'where'), false);
  assert.equal((await store.fetchInquiries()).length, 0);
  await assert.rejects(store.fetchPropertyById('missing'));
  await assert.rejects(store.updateProperty('missing', { title: 'After' }));
  assert.equal(firebaseCalls.some(c => c[0] === 'updateDoc'), false);
  assert.equal(calls.length, 0);
});

test('Firebase failures reject without using another backend', async () => {
  const { store, calls } = harness({}, true, { error: new Error('Firestore denied') });
  for (const operation of [
    () => store.fetchProperties(), () => store.fetchPropertyById('test'),
    () => store.createProperty({ title: 'New' }), () => store.updateProperty('test', { title: 'After' }),
    () => store.deleteProperty('test'), () => store.submitInquiry(inquiry),
    () => store.fetchInquiries(), () => store.updateInquiryStatus('test', 'closed'),
  ]) await assert.rejects(operation, /Firestore denied/);
  assert.equal(calls.length, 0);
});

test('configured Firebase with failed initialization never uses Supabase', async () => {
  const { store, calls } = harness({}, true, { unavailable: true });
  await assert.rejects(store.fetchProperties(), /Firebase unavailable/);
  await assert.rejects(store.deleteProperty('test'), /Firebase unavailable/);
  await assert.rejects(store.submitInquiry(inquiry), /Firebase unavailable/);
  assert.equal(calls.length, 0);
});

test('public Firebase reads return empty/missing results and propagate failures without Supabase', async () => {
  const publicSource = ts.transpileModule(readFileSync(new URL('../src/lib/supabase/public-properties.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outp[...]
  const { store, calls } = harness({}, true, {}, publicSource);
  assert.equal((await store.fetchPublicProperties()).length, 0);
  assert.equal(await store.fetchPublicPropertyBySlug('missing'), null);
  assert.equal(calls.length, 0);
  const failed = harness({}, true, { error: new Error('offline') }, publicSource);
  await assert.rejects(failed.store.fetchPublicProperties(), /offline/);
  await assert.rejects(failed.store.fetchPublicPropertyBySlug('test'), /offline/);
  assert.equal(failed.calls.length, 0);
});
