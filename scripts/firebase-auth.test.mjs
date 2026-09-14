import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync('src/lib/firebase/auth.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function harness({ role = 'USER', verified = true, exists = true, available = true, error = null, registerError = null, signInError = null, verifyError = null } = {}) {
  const calls = [];
  const user = { uid: 'user-id', emailVerified: verified };
  const auth = available ? { currentUser: user, async authStateReady() { calls.push(['ready']); } } : null;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require(name) {
    if (name === './client') return { auth, requireFirebaseDatabase: () => ({}) };
    if (name === 'firebase/auth') return {
      async signInWithEmailAndPassword() { calls.push(['signIn']); if (signInError) throw signInError; return { user }; },
      async signOut() { calls.push(['signOut']); },
      async createUserWithEmailAndPassword() { calls.push(['register']); if (registerError) throw registerError; return { user }; },
      async sendEmailVerification() { calls.push(['verify']); if (verifyError) throw verifyError; },
      async deleteUser() { assert.fail('Registration must not delete accounts'); },
    };
    if (name === 'firebase/firestore') return {
      doc: (...args) => args,
      async getDoc() { calls.push(['getProfile']); if (error) throw error; return { exists: () => exists, data: () => ({ role, full_name: 'Name' }) }; },
      async runTransaction(db, work) {
        if (error) throw error;
        return work({ get: async () => ({ exists: () => exists }), set: (reference, data) => calls.push(['setProfile', data]) });
      },
    };
    throw new Error(`Unexpected import ${name}`);
  } });
  return { auth: exports, calls };
}
test('staff login requires verified email and a database-assigned staff role', async () => {
  for (const options of [{ role: 'USER' }, { role: 'ADMIN', verified: false }, { role: 'ADMIN', exists: false }, { error: new Error('denied') }]) {
    const { auth, calls } = harness(options);
    await assert.rejects(auth.signInFirebaseStaff('staff@example.com', 'test-password'));
    assert.equal(calls.at(-1)[0], 'signOut');
  }
  for (const role of ['ADMIN', 'AGENT']) {
    const { auth, calls } = harness({ role });
    await auth.signInFirebaseStaff('staff@example.com', 'test-password');
    assert.equal(calls.some(([name]) => name === 'signOut'), false);
    assert.ok(calls.some(([name]) => name === 'ready'));
  }
});
test('registration creates a USER profile, sends verification and signs out', async () => {
  const { auth, calls } = harness({ verified: false, exists: false });
  await auth.registerFirebaseUser('member@example.com', 'test-password', ' Name ', ' 0812345678 ');
  const saved = calls.find(([name]) => name === 'setProfile')[1];
  assert.equal(saved.role, 'USER');
  assert.equal(saved.id, 'user-id');
  assert.equal(saved.full_name, 'Name');
  assert.deepEqual(calls.slice(-2).map(([name]) => name), ['verify', 'signOut']);
});
test('failed registration profile write clears the authenticated session', async () => {
  const { auth, calls } = harness({ error: new Error('denied') });
  await assert.rejects(auth.registerFirebaseUser('member@example.com', 'test-password', 'Name', ''), { code: 'auth/profile-incomplete' });
  assert.equal(calls.at(-1)[0], 'signOut');
  assert.equal(calls.some(([name]) => name === 'verify'), false);
});
test('unverified accounts can request a fresh verification link without keeping a session', async () => {
  const { auth, calls } = harness({ verified: false });
  await auth.resendFirebaseVerification('member@example.com', 'test-password');
  assert.deepEqual(calls, [['signIn'], ['verify'], ['signOut']]);
});
test('verified accounts cannot request a redundant verification link', async () => {
  const { auth, calls } = harness();
  await assert.rejects(auth.resendFirebaseVerification('member@example.com', 'test-password'), /ยืนยันแล้ว/);
  assert.deepEqual(calls, [['signIn'], ['signOut']]);
});
test('unavailable Firebase authentication fails closed', async () => {
  const { auth, calls } = harness({ available: false });
  await assert.rejects(auth.signInFirebaseStaff('staff@example.com', 'test-password'));
  await assert.rejects(auth.firebaseProfile());
  assert.equal(calls.length, 0);
});

test('verified members can sign in as members but staff login still rejects them', async () => {
  const { auth } = harness();
  assert.equal((await auth.signInFirebaseUser('member@example.com', 'test-password')).role, 'USER');
  await assert.rejects(auth.signInFirebaseStaff('member@example.com', 'test-password'), { code: 'auth/staff-required' });
});
test('email delivery failure preserves the account and profile for resend', async () => {
  const { auth, calls } = harness({ exists: false, verified: false, verifyError: new Error('offline') });
  assert.equal(await auth.registerFirebaseUser('member@example.com', 'test-password', 'Name', ''), 'verification-pending');
  assert.ok(calls.some(([name]) => name === 'setProfile'));
  assert.equal(calls.at(-1)[0], 'signOut');
});
test('partial registration resumes only after proving ownership and creates only USER', async () => {
  const { auth, calls } = harness({ exists: false, verified: false, registerError: { code: 'auth/email-already-in-use' } });
  assert.equal(await auth.registerFirebaseUser('member@example.com', 'test-password', 'Name', ''), 'verification-sent');
  assert.ok(calls.findIndex(([name]) => name === 'signIn') < calls.findIndex(([name]) => name === 'setProfile'));
  assert.equal(calls.find(([name]) => name === 'setProfile')[1].role, 'USER');
});
test('retries never overwrite an existing admin profile or send redundant verification', async () => {
  const { auth, calls } = harness({ role: 'ADMIN', registerError: { code: 'auth/email-already-in-use' } });
  assert.equal(await auth.registerFirebaseUser('admin@example.com', 'test-password', 'New name', ''), 'already-verified');
  assert.equal(calls.some(([name]) => name === 'setProfile' || name === 'verify'), false);
});
test('wrong password on an existing email cannot repair or overwrite its profile', async () => {
  const { auth, calls } = harness({ registerError: { code: 'auth/email-already-in-use' }, signInError: { code: 'auth/invalid-credential' } });
  await assert.rejects(auth.registerFirebaseUser('member@example.com', 'wrong-password', 'Name', ''), { code: 'auth/invalid-credential' });
  assert.equal(calls.some(([name]) => name === 'setProfile' || name === 'verify'), false);
});
test('invalid profile input is rejected before any account is created', async () => {
  const { auth, calls } = harness();
  await assert.rejects(auth.registerFirebaseUser('member@example.com', 'test-password', '   ', ''), { code: 'auth/invalid-profile' });
  assert.equal(calls.length, 0);
});
