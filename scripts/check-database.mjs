import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd());

const firebaseProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const firebaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  firebaseProject &&
  !firebaseProject.includes('your-project-id'),
);

async function checkFirebase() {
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseProject)}/databases/(default)/documents`;
  let failed = false;
  const checks = [
    ['properties', fetch(`${base}:runQuery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: 'properties' }],
        where: { fieldFilter: { field: { fieldPath: 'published' }, op: 'EQUAL', value: { booleanValue: true } } },
        limit: 1,
      } }),
    })],
    ['agents', fetch(`${base}/agents?pageSize=1`)],
  ];
  for (const [collection, pending] of checks) {
    const response = await pending;
    if (!response.ok) {
      failed = true;
      console.error(`${collection}: ตรวจสอบไม่ผ่าน (HTTP ${response.status})`);
    } else {
      console.log(`${collection}: Firestore เชื่อมต่อสำเร็จ`);
    }
  }
  console.log('ตรวจเฉพาะการอ่านข้อมูลสาธารณะ ไม่มีการแก้ไขข้อมูล');
  return failed;
}

async function checkLegacySupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('your-project-id')) {
    console.error('ยังไม่ได้ตั้งค่า Firebase: ใส่ค่า NEXT_PUBLIC_FIREBASE_* ใน .env.local');
    return true;
  }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let failed = false;
  for (const table of ['properties', 'property_images', 'agents']) {
    const { error } = await client.from(table).select('id', { head: true, count: 'exact' });
    if (error) {
      failed = true;
      console.error(`${table}: ตรวจสอบไม่ผ่าน (${error.code || 'connection error'})`);
    } else console.log(`${table}: Supabase เชื่อมต่อสำเร็จ`);
  }
  console.log('ตรวจเฉพาะการอ่านตาราง legacy ไม่มีการแก้ไขข้อมูล');
  return failed;
}

try {
  const failed = await (firebaseConfigured ? checkFirebase() : checkLegacySupabase());
  process.exitCode = failed ? 1 : 0;
} catch (error) {
  console.error(`ตรวจสอบฐานข้อมูลไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
