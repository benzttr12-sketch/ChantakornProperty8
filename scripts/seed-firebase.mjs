// scripts/seed-firebase.mjs
// Run: node scripts/seed-firebase.mjs
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, setDoc, doc, getDoc } from 'firebase/firestore';
import { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import process from 'node:process';

// Read .env.local
const envPath = resolve(process.cwd(), '.env.local');
let env = {};
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      env[key] = val;
    }
  });
}

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || firebaseConfig.projectId.includes('your-project-id')) {
  console.error('❌ ไม่พบ Firebase Config หรือยังไม่ได้ระบุค่าในไฟล์ .env.local');
  console.error('กรุณาใส่ค่า NEXT_PUBLIC_FIREBASE_API_KEY และ NEXT_PUBLIC_FIREBASE_PROJECT_ID ใน .env.local ก่อน');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// This script is intentionally authenticated. Firestore production rules reject
// unauthenticated writes, and a public client config must never be treated as an
// admin credential.
const auth = initializeAuth(app, { persistence: inMemoryPersistence });

const SAMPLE_AGENTS = [
  {
    id: "a1111111-1111-1111-1111-111111111111",
    name: "คุณฉันทากร นวลจันทร์ (เบนซ์)",
    title: "ผู้ก่อตั้งและที่ปรึกษาอสังหาริมทรัพย์อาวุโส",
    phone: "081-604-0097",
    line_id: "LINE Official Account",
    facebook: "https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88/100089427220145/",
    email: "chantakorn@chantakornproperty.com",
    photo_url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80",
    bio: "ประสบการณ์ด้านอสังหาริมทรัพย์ในพื้นที่หาดใหญ่-สงขลากว่า 10 ปี เชี่ยวชาญด้านการขาย-เช่าบ้าน ที่ดิน และคอนโด",
  },
  {
    id: "a2222222-2222-2222-2222-222222222222",
    name: "คุณพิมลภัส สุวรรณรัตน์ (พิม)",
    title: "ผู้เชี่ยวชาญด้านบ้านเดี่ยวและคอนโดมิเนียม ม.อ.หาดใหญ่",
    phone: "089-876-5432",
    line_id: "LINE Official Account",
    facebook: "https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88/100089427220145/",
    email: "pimonpat@chantakornproperty.com",
    photo_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80",
    bio: "ให้คำปรึกษาในการเลือกซื้อบ้านและคอนโดเพื่ออยู่อาศัยและการลงทุน สมาชิกอาคารสถาบันอสังหาริมทรัพย์ไทย",
  },
];

const SAMPLE_PROPERTIES = [
  {
    id: 'prop-01',
    title: 'บ้านเดี่ยว 2 ชั้น สไตล์โมเดิร์นทรอปิคอล ใกล้เซ็นทรัลหาดใหญ่',
    slug: 'modern-tropical-house-near-central-hatyai',
    description: 'บ้านเดี่ยว 2 ชั้น ดีไซน์โมเดิร์นทรอปิคอล ออกแบบโปร่งโล่ง รับลมธรรมชาติดี สำหรับครอบครัว',
    property_type: 'house',
    status: 'sale',
    price: 4850000,
    province: 'สงขลา',
    district: 'หาดใหญ่',
    subdistrict: 'ควนลัง',
    address: 'ซอยเพชรเกษม 41 ต.ควนลัง อ.หาดใหญ่ จ.สงขลา',
    latitude: 7.0084,
    longitude: 100.4431,
    bedrooms: 3,
    bathrooms: 3,
    parking: 2,
    land_size: 56.5,
    usable_area: 195.0,
    year_built: 2023,
    furniture: 'พร้อมอยู่บางส่วน',
    features: ['เครื่องปรับอากาศ 3 เครื่อง', 'ห้องครัวบิวท์อิน', 'ระบบกล้องวงจรปิด CCTV', 'ระบบสปริงเกอร์'],
    cover_image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
    ],
    featured: true,
    published: true,
    agent_id: 'a1111111-1111-1111-1111-111111111111',
    created_at: new Date().toISOString(),
  },
  {
    id: 'prop-02',
    title: 'ที่ดินเปล่าทำเลทอง ถมแล้ว รูปแปลงสวย ใกล้สนามบินนานาชาติหาดใหญ่',
    slug: 'prime-land-near-hatyai-airport',
    description: 'ที่ดินทำเลศักยภาพสูง เนื้อที่ 200 ตารางวา หน้ากว้างติดถนนสาธารณ์ พร้อมสร้าง',
    property_type: 'land',
    status: 'sale',
    price: 2890000,
    province: 'สงขลา',
    district: 'หาดใหญ่',
    subdistrict: 'ควนลัง',
    address: 'ถนนสนามบิน-ลพบุรีราเมศวร์ ต.ควนลัง อ.หาดใหญ่ จ.สงขลา',
    latitude: 6.9452,
    longitude: 100.3980,
    bedrooms: 0,
    bathrooms: 0,
    parking: 0,
    land_size: 200.0,
    usable_area: 0,
    year_built: 2024,
    furniture: 'ไม่มี',
    features: ['ติดถนนสาธารณะ', 'ไฟฟ้าเข้าถึง', 'น้ำประปาเข้าถึง', 'ถมแล้วพร้อมสร้าง'],
    cover_image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
    ],
    featured: true,
    published: true,
    agent_id: 'a1111111-1111-1111-1111-111111111111',
    created_at: new Date().toISOString(),
  },
  {
    id: 'prop-03',
    title: 'คอนโดหรูแต่งครบ วิวดอยคอหงส์ ใกล้มหาวิทยาลัยสงขลานครินทร์ (ม.อ.)',
    slug: 'luxury-condo-khohong-view-near-psu',
    description: 'คอนโดมิเนียมพร้อมอยู่ ชั้น 12 วิวทิวทัศน์เขาคอหงส์ ตกแต่งครบด้วยเฟอร์นิเจอร์',
    property_type: 'condo',
    status: 'sale',
    price: 2490000,
    province: 'สงขลา',
    district: 'หาดใหญ่',
    subdistrict: 'คอหงส์',
    address: 'ถนนกาญจนวนิช ต.คอหงส์ อ.หาดใหญ่ จ.สงขลา',
    latitude: 7.0125,
    longitude: 100.4982,
    bedrooms: 1,
    bathrooms: 1,
    parking: 1,
    land_size: 0,
    usable_area: 34.5,
    year_built: 2022,
    furniture: 'ตกแต่งครบ พร้อมเข้าอยู่',
    features: ['สระว่ายน้ำ Infinity Edge', 'ฟิตเนสพาโนรามาวิว', 'ระบบ Digital Door Lock', 'Co-Working Space'],
    cover_image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    ],
    featured: true,
    published: true,
    agent_id: 'a2222222-2222-2222-2222-222222222222',
    created_at: new Date().toISOString(),
  },
];

async function seed() {
  const email = env.FIREBASE_SEED_EMAIL || process.env.FIREBASE_SEED_EMAIL;
  const password = env.FIREBASE_SEED_PASSWORD || process.env.FIREBASE_SEED_PASSWORD;
  if (!email || !password) {
    throw new Error('ต้องกำหนด FIREBASE_SEED_EMAIL และ FIREBASE_SEED_PASSWORD ใน environment ก่อนรัน (อย่าใส่รหัสผ่านลงใน Git)');
  }

  console.log(`🔐 กำลังยืนยันบัญชีผู้ดูแล ${email} สำหรับการนำเข้าข้อมูล...`);
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  if (!user.emailVerified) throw new Error('บัญชี seed ต้องยืนยันอีเมลก่อน');
  const profile = await getDoc(doc(db, 'profiles', user.uid));
  if (!profile.exists() || profile.data().role !== 'ADMIN') {
    throw new Error('บัญชี seed ต้องมีโปรไฟล์ ADMIN ใน Firestore ก่อน');
  }

  console.log('🚀 กำลังเริ่มนำเข้าข้อมูลตัวอย่างสู่ Firebase Firestore...');

  for (const agent of SAMPLE_AGENTS) {
    await setDoc(doc(db, 'agents', agent.id), agent);
    console.log(`✅ บันทึกนายหน้า: ${agent.name}`);
  }

  for (const prop of SAMPLE_PROPERTIES) {
    await setDoc(doc(db, 'properties', prop.id), prop);
    console.log(`✅ บันทึกทรัพย์: ${prop.title}`);
  }

  await signOut(auth);
  console.log('\n🎉 นำเข้าข้อมูลสู่ Firebase Firestore สำเร็จเรียบร้อย!');
}

seed().catch(err => {
  signOut(auth).catch(() => {});
  console.error('❌ เกิดข้อผิดพลาดในการ seed:', err);
  process.exit(1);
});
