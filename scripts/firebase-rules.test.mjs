import test, { before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, setLogLevel } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject, listAll } from 'firebase/storage';

setLogLevel('silent');

let env;
const profile = (id, role) => ({ id, role, full_name: id, phone: '' });
const listing = (id, published = false) => ({ id, published, title: 'Test listing', slug: id, featured: false, price: 1, property_type: 'house', status: 'sale', images: [], features: [], created_at: '2026-09-12' });
const inquiry = id => ({ id, name: 'Customer', phone: '0812345678', message: 'Viewing request', inquiry_type: 'viewing', status: 'new', created_at: '2026-09-12' });
const context = (uid, verified = true) => uid ? env.authenticatedContext(uid, { email_verified: verified }) : env.unauthenticatedContext();
const db = (uid, verified = true) => context(uid, verified).firestore();
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-chantakorn-security',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
    storage: { host: '127.0.0.1', port: 9199, rules: readFileSync('storage.rules', 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async ctx => {
    const store = ctx.firestore();
    await Promise.all([
      ...['admin', 'other-admin', 'agent', 'member'].map(id => setDoc(doc(store, 'profiles', id), profile(id, id.includes('admin') ? 'ADMIN' : id === 'agent' ? 'AGENT' : 'USER'))),
      setDoc(doc(store, 'properties', 'public'), listing('public', true)),
      setDoc(doc(store, 'properties', 'draft'), listing('draft')),
      setDoc(doc(store, 'inquiries', 'customer'), inquiry('customer')),
    ]);
  });
});

test('public can read published properties, but cannot read drafts or use an unfiltered listing query', async () => {
  await assertSucceeds(getDoc(doc(db(), 'properties', 'public')));
  await assertSucceeds(getDocs(query(collection(db(), 'properties'), where('published', '==', true))));
  await assertFails(getDoc(doc(db(), 'properties', 'draft')));
  await assertFails(getDocs(collection(db(), 'properties')));
});
test('anonymous, regular and unverified staff accounts cannot mutate properties or read customer records', async () => {
  for (const [uid, verified] of [[undefined, false], ['member', true], ['agent', false]]) {
    const store = db(uid, verified);
    await assertFails(setDoc(doc(store, 'properties', 'new'), listing('new')));
    await assertFails(updateDoc(doc(store, 'properties', 'public'), { title: 'Changed' }));
    await assertFails(deleteDoc(doc(store, 'properties', 'public')));
    await assertFails(getDoc(doc(store, 'inquiries', 'customer')));
    await assertFails(getDocs(collection(store, 'inquiries')));
  }
});
test('verified staff can manage properties and inquiry status but cannot rewrite customer details', async () => {
  const store = db('agent');
  await assertSucceeds(getDocs(collection(store, 'properties')));
  await assertSucceeds(setDoc(doc(store, 'properties', 'new'), listing('new')));
  await assertSucceeds(updateDoc(doc(store, 'properties', 'new'), { published: true }));
  await assertFails(updateDoc(doc(store, 'properties', 'new'), { created_at: 'changed' }));
  await assertSucceeds(deleteDoc(doc(store, 'properties', 'new')));
  await assertSucceeds(getDocs(collection(store, 'inquiries')));
  await assertSucceeds(updateDoc(doc(store, 'inquiries', 'customer'), { status: 'contacted' }));
  await assertSucceeds(updateDoc(doc(store, 'inquiries', 'customer'), { status: 'scheduled' }));
  await assertFails(updateDoc(doc(store, 'inquiries', 'customer'), { phone: 'attacker' }));
  await assertFails(updateDoc(doc(store, 'inquiries', 'customer'), { status: 'invalid' }));
  await assertFails(deleteDoc(doc(store, 'inquiries', 'customer')));
});
test('public inquiries are validated and create-only, even if the document ID is known', async () => {
  const store = db();
  await assertSucceeds(setDoc(doc(store, 'inquiries', 'new'), inquiry('new')));
  await assertFails(getDoc(doc(store, 'inquiries', 'new')));
  await assertFails(setDoc(doc(store, 'inquiries', 'new'), inquiry('new')));
  await assertFails(deleteDoc(doc(store, 'inquiries', 'new')));
  await assertFails(setDoc(doc(store, 'inquiries', 'bad'), { ...inquiry('bad'), status: 'closed' }));
  await assertFails(setDoc(doc(store, 'inquiries', 'bad'), { ...inquiry('bad'), role: 'ADMIN' }));
  await assertFails(setDoc(doc(store, 'inquiries', 'bad'), { ...inquiry('bad'), message: 'x'.repeat(5001) }));
  await assertSucceeds(setDoc(doc(store, 'inquiries', 'sell'), { ...inquiry('sell'), inquiry_type: 'consignment_sell',
    consignment_details: { property_type: 'house', province: 'Songkhla', district: 'Hatyai', expected_price: 1, photos_count: 0, photo_paths: [] } }));
});
test('members can create only their own USER profile and cannot self-promote or read other profiles', async () => {
  const store = db('new-member', false);
  await assertFails(setDoc(doc(store, 'profiles', 'new-member'), profile('new-member', 'ADMIN')));
  await assertFails(setDoc(doc(store, 'profiles', 'someone-else'), profile('someone-else', 'USER')));
  await assertSucceeds(setDoc(doc(store, 'profiles', 'new-member'), profile('new-member', 'USER')));
  await assertSucceeds(updateDoc(doc(store, 'profiles', 'new-member'), { full_name: 'My name' }));
  await assertFails(updateDoc(doc(store, 'profiles', 'new-member'), { role: 'ADMIN' }));
  await assertFails(getDoc(doc(store, 'profiles', 'admin')));
  await assertFails(getDocs(collection(store, 'profiles')));
  await assertFails(deleteDoc(doc(store, 'profiles', 'new-member')));
});
test('only admins manage other roles; self-demotion and client profile deletion are denied', async () => {
  await assertFails(updateDoc(doc(db('agent'), 'profiles', 'member'), { role: 'ADMIN' }));
  await assertSucceeds(updateDoc(doc(db('admin'), 'profiles', 'member'), { role: 'AGENT' }));
  await assertSucceeds(getDocs(collection(db('admin'), 'profiles')));
  await assertFails(updateDoc(doc(db('admin'), 'profiles', 'admin'), { role: 'USER' }));
  await assertFails(deleteDoc(doc(db('admin'), 'profiles', 'other-admin')));
});
test('role revocation blocks an existing authenticated staff session immediately', async () => {
  const staffDb = db('agent');
  await assertSucceeds(getDoc(doc(staffDb, 'inquiries', 'customer')));
  await assertSucceeds(updateDoc(doc(db('admin'), 'profiles', 'agent'), { role: 'USER' }));
  await assertFails(getDoc(doc(staffDb, 'inquiries', 'customer')));
  await assertFails(updateDoc(doc(staffDb, 'properties', 'public'), { title: 'Changed' }));
});
test('only admins change public settings and unmatched collections stay denied', async () => {
  const settings = { id: 1, agency_name: 'Agency', phone: '0812345678' };
  await assertFails(setDoc(doc(db('agent'), 'site_settings', '1'), settings));
  await assertSucceeds(setDoc(doc(db('admin'), 'site_settings', '1'), settings));
  await assertSucceeds(getDoc(doc(db(), 'site_settings', '1')));
  await assertFails(setDoc(doc(db('admin'), 'unknown', 'record'), { value: true }));
});
test('private consignment uploads cannot be read, replaced, listed or deleted by customers', async () => {
  const guest = context().storage();
  const reference = ref(guest, 'consignment-photos/customer.jpg');
  await assertSucceeds(uploadBytes(reference, new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg' }));
  await assertFails(getBytes(reference));
  await assertFails(listAll(ref(guest, 'consignment-photos')));
  await assertFails(uploadBytes(reference, new Uint8Array([4]), { contentType: 'image/jpeg' }));
  await assertFails(deleteObject(reference));
  await assertSucceeds(getBytes(ref(context('agent').storage(), 'consignment-photos/customer.jpg')));
  await assertFails(getBytes(ref(context('member').storage(), 'consignment-photos/customer.jpg')));
});
test('property uploads require verified staff and both upload paths validate size and MIME type', async () => {
  for (const bucket of ['property-photos', 'consignment-photos']) {
    const staffStorage = context('agent').storage();
    await assertFails(uploadBytes(ref(staffStorage, `${bucket}/bad.svg`), new Uint8Array([1]), { contentType: 'image/svg+xml' }));
    await assertFails(uploadBytes(ref(staffStorage, `${bucket}/huge.jpg`), new Uint8Array(5 * 1024 * 1024 + 1), { contentType: 'image/jpeg' }));
  }
  await assertFails(uploadBytes(ref(context().storage(), 'property-photos/test.jpg'), new Uint8Array([1]), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(context('agent', false).storage(), 'property-photos/test.jpg'), new Uint8Array([1]), { contentType: 'image/jpeg' }));
  await assertSucceeds(uploadBytes(ref(context('agent').storage(), 'property-photos/test.jpg'), new Uint8Array([1]), { contentType: 'image/jpeg' }));
  await assertSucceeds(getBytes(ref(context().storage(), 'property-photos/test.jpg')));
});
