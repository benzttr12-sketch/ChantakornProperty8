# CHANTAKORN PROPERTY (ฉันทากร พร็อพเพอร์ตี้)
> สถานะระบบ: ใช้ Firebase Firestore และ Firebase Authentication เป็นระบบหลัก และใช้ Sites + R2 สำหรับรูปภาพ[...]
### Real Estate Agency Platform — Hat Yai & Songkhla, Thailand

> **"บ้าน • ที่ดิน • คอนโด • อสังหาริมทรัพย์ ครบวงจร ใส่ใจทุกบริการ เราดูแล[...]

A production-ready, high-end real estate agency web platform designed and engineered specifically for **CHANTAKORN PROPERTY**, serving the **Hat Yai – Songkhla** metropolitan area in Southern Tha[...]

---

## 🏛️ Brand & Design System

- **Primary Color**: Deep Navy `#0B1F3A`
- **Secondary / Accent**: Luxury Gold `#C9A227`
- **Background**: Soft Clean `#F7F8FA`
- **Card Surface**: Pure White `#FFFFFF`
- **Typography**: Inter & Thai font (Prompt / Noto Sans Thai)
- **Border Radius**: 16px (`rounded-2xl` for cards), 8px (`rounded-lg` for buttons)
- **Spacing**: Consistent 8px spacing system with generous whitespace and subtle elevation shadows

---

## 🚀 Key Features

1. **Homepage (`/`)**:
   - High-impact luxury hero with Hat Yai photography and dual CTAs ("ค้นหาอสังหาริมทรัพย์", "ฝากขายกับเรา")
   - Floating search box with ซื้อ / เช่า tabs, property types, Songkhla districts, and price bounds
   - 6 Category Cards (บ้าน, ที่ดิน, คอนโด, อาคารพาณิชย์, ลงทุน, ขายฝาก / จำนอง)
   - 6 Featured Property Cards with 4:3 image ratio, stats (beds, baths, land size, usable area), and instant favorite toggle
   - Why Choose Us (มืออาชีพ, ข้อมูลชัดเจน, ดูแลทุกขั้นตอน, รู้จักพื้นที่หาดใหญ่–ส��[...]
   - Location Highlights (หาดใหญ่, เมืองสงขลา, ควนลัง, คลองแห, บ้านพรุ, ทุ่งลุง)
   - Sell Property Consignment CTA Banner
   - Customer Testimonials (clearly marked with DEMO tags)
   - Contact CTA & Agency Footer

2. **Property Search & 3-Pane Explorer (`/properties`)**:
   - **Left Pane**: Advanced Filter Panel (Status, Type, District, Price Range, Bedrooms, Bathrooms, Amenities)
   - **Center Pane**: Results grid with dynamic count ("พบ XX รายการ") and sorting (newest, price asc/desc, popular)
   - **Right Pane**: Interactive Leaflet Map with custom gold/navy markers and floating property preview card
   - Dedicated Mobile UX with filter slide-out drawer and list/map view switcher

3. **Property Detail Page (`/properties/[slug]`)**:
   - Responsive photo gallery with carousel and fullscreen lightbox modal supporting 20+ photos
   - Quick specs summary bar (Bedrooms, Bathrooms, Parking, Land Area in ตร.ว., Usable Area in ตร.ม.)
   - Detailed specification table (Property Type, Status, Price, Year Built, Furniture, Title Deed)
   - Verified amenities checklist
   - Location section with interactive Leaflet map and distances to PSU, Central Hatyai, Airport, etc.
   - Certified AgentCard with trust quote, direct Call, LINE, Facebook, and appointment scheduler modal
   - Direct Inquiry contact form with instant validation
   - Sticky mobile action bar (โทร, LINE, นัดชมทรัพย์)
   - Related properties recommendations

4. **Property Consignment & Sell Page (`/sell`)**:
   - Multi-step consignment form for home and land owners
   - Location picker for Songkhla districts
   - Photo file dropzone with live client-side previews
   - Clear submission confirmation with direct LINE contact

5. **Buy (`/buy`) & Rent (`/rent`) Pages**:
   - Dedicated filtered views for properties for sale and properties for rent

6. **Services Showcase (`/services`)**:
   - 8 core agency services with detailed descriptions and direct CTAs

7. **About (`/about`) & Contact (`/contact`)**:
   - Agency story, 4 core values, team member cards, office location preview, and contact form

8. **Favorites (`/favorites`)**:
   - Saved properties system stored in the visitor's browser

9. **Authentication (`/login`, `/register`)**:
   - Firebase Email/Password Auth with verified-email and database role checks
   - Registration creates a `USER` profile and sends an email verification link

10. **Admin Dashboard & CRM (`/admin`)**:
    - High-level KPIs: Total listings, For Sale, For Rent, Total Inquiries
    - Monthly listing growth and inquiry volume charts
    - Property Management table: Featured toggle, Delete, View
    - Comprehensive Add Property form matching the Firestore property document
    - Inquiries & Consignments CRM inbox with status management
    - Agency settings editor

11. **Thailand-First Channels**:
    - Floating LINE Official Account button with pulsing indicator
    - Dedicated mobile bottom navigation bar (`หน้าแรก`, `ค้นหา`, `บันทึก`, `ติดต่อ`)

12. **SEO & Structured Data**:
    - Dynamic Next.js metadata, OpenGraph, Twitter Cards
    - RealEstateListing & SingleFamilyResidence JSON-LD schema
    - Automatically generated `sitemap.xml` and `robots.txt`

---

## 🛠️ Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, PostCSS, Autoprefixer
- **Icons**: Lucide Icons
- **Interactive Maps**: Leaflet + OpenStreetMap
- **Backend / Database**: Firebase Firestore and Authentication; Sites server routes + R2 handle photos
- **State Architecture**: Firebase-first persistence; Supabase is an explicit legacy fallback only when Firebase is not configured

---

## 📦 Getting Started

### 1. Prerequisites
- Node.js 18+ or 20+ installed
- npm or pnpm

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Copy the example file:
```bash
cp .env.example .env.local
```
Set the `NEXT_PUBLIC_FIREBASE_*` values for the Firebase web app. Production builds fail closed when Firebase is configured but unavailable; they do not silently write to localStorage or another [...]

### 4. Firebase setup
1. Enable Email/Password in Firebase Authentication and configure the authorized domains.
2. Publish `firestore.rules`. Firebase Storage is not required for the default deployment; photos use the private server route and Sites R2 binding.
3. Create the first verified administrator profile in Firestore as described in the security guide.
4. Optional sample data can be imported with the authenticated script below. It requires an already verified `ADMIN` account and never accepts an unauthenticated write:

```powershell
$env:FIREBASE_SEED_EMAIL = 'admin@example.com'
$env:FIREBASE_SEED_PASSWORD = '<enter locally; do not commit>'
node scripts/seed-firebase.mjs
Remove-Item Env:FIREBASE_SEED_PASSWORD
```

The app is intentionally empty until real listings are entered. The old `supabase/` files are retained only for historical migration reference.

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173). The production-compatible local server is started with `npm start` after a build.

### 6. Build for Production
```bash
npm run build
npm start
```

---

## 📁 Project Architecture

```
g:/Chantakorn/
├── public/                     # Static assets
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with Header, Footer, LINE button
│   │   ├── page.tsx            # Homepage (Exact 10 sections)
│   │   ├── properties/
│   │   │   ├── page.tsx        # 3-Pane Search & Filter & Map
│   │   │   └── [slug]/page.tsx # Property Detail with gallery & agent
│   │   ├── buy/page.tsx        # Properties for sale
│   │   ├── rent/page.tsx       # Rental properties
│   │   ├── sell/page.tsx       # Consignment submission & photo upload
│   │   ├── services/page.tsx   # 8 agency services
│   │   ├── about/page.tsx      # About Chantakorn Property & team
│   │   ├── contact/page.tsx    # Contact & office information
│   │   ├── favorites/page.tsx  # Saved properties
│   │   ├── login/page.tsx      # Sign in & 1-click demo logins
│   │   ├── register/page.tsx   # Sign up
│   │   ├── admin/
│   │   │   ├── layout.tsx      # Admin dashboard layout & sidebar
│   │   │   ├── page.tsx        # Metrics & growth charts
│   │   │   ├── properties/     # Management table & Add property form
│   │   │   ├── inquiries/      # Leads & consignment CRM
│   │   │   └── settings/       # Agency settings
│   │   ├── sitemap.ts          # Dynamic XML sitemap
│   │   └── robots.ts           # Search engine robots
│   ├── components/
│   │   ├── home/               # Hero, Search, Categories, Locations, etc.
│   │   ├── layout/             # Header, Footer, MobileBottomNav, LINE button
│   │   └── properties/         # PropertyCard, Map, Gallery, Specs, Agent
│   ├── data/                   # Hat Yai - Songkhla sample data & agents
│   └── lib/                    # Firebase/Supabase clients, store, types, utils
├── firestore.rules             # Firestore access boundary
├── storage.rules                # Storage access boundary
├── FIREBASE-SECURITY.md         # Deployment and launch checklist
└── supabase/                    # Legacy migration reference only
```

---

## 🔒 Security & Performance Highlights

- **Firestore/Storage Rules**: Verified staff roles are read from Firestore profiles; public access is limited to published listings and validated inquiry creation.
- **Image Optimization**: Powered by Next.js Image with responsive sizes and lazy loading.
- **Privacy Safe Coordinates**: Public map markers reflect property area without exposing private deed coordinates when requested.
- **Responsive Touch UX**: Dedicated mobile navigation bar and thumb-friendly sticky contact triggers.
