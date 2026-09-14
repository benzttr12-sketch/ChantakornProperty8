-- ==========================================================
-- CHANTAKORN PROPERTY - DATABASE SCHEMA
-- PostgreSQL / Supabase Schema with Row Level Security (RLS)
-- Location Focus: Hat Yai – Songkhla, Thailand
-- ==========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. AGENTS TABLE
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    title TEXT DEFAULT 'นายหน้าอสังหาริมทรัพย์มืออาชีพ CHANTAKORN PROPERTY',
    phone TEXT NOT NULL,
    line_id TEXT NOT NULL,
    facebook TEXT,
    email TEXT,
    photo_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PROPERTIES TABLE
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    property_type TEXT NOT NULL CHECK (property_type IN ('house', 'land', 'condo', 'commercial', 'investment', 'consignment')),
    status TEXT NOT NULL CHECK (status IN ('sale', 'rent')),
    price NUMERIC NOT NULL CHECK (price >= 0),
    province TEXT NOT NULL DEFAULT 'สงขลา',
    district TEXT NOT NULL,
    subdistrict TEXT,
    address TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    bedrooms INTEGER DEFAULT 0 CHECK (bedrooms >= 0),
    bathrooms INTEGER DEFAULT 0 CHECK (bathrooms >= 0),
    parking INTEGER DEFAULT 0 CHECK (parking >= 0),
    land_size NUMERIC DEFAULT 0, -- In Wah (ตร.ว.)
    usable_area NUMERIC DEFAULT 0, -- In Sqm (ตร.ม.)
    year_built INTEGER,
    furniture TEXT DEFAULT 'บางส่วน',
    features TEXT[] DEFAULT '{}',
    cover_image TEXT,
    featured BOOLEAN DEFAULT false,
    published BOOLEAN DEFAULT true,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. PROPERTY IMAGES TABLE
CREATE TABLE IF NOT EXISTS public.property_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. INQUIRIES & CONSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    line_id TEXT,
    message TEXT,
    inquiry_type TEXT DEFAULT 'inquiry' CHECK (inquiry_type IN ('inquiry', 'viewing', 'consignment_sell')),
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'scheduled', 'closed')),
    consignment_details JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. FAVORITES TABLE
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, property_id)
);

-- 6. USER PROFILES TABLE (Mirrors Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'USER' CHECK (role IN ('ADMIN', 'AGENT', 'USER')),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Keep the application profile in sync with Supabase Auth. Roles always start as
-- USER; privileged roles must be granted by an existing administrator.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'phone', ''),
    'USER'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Security-definer helper avoids recursive RLS policies on profiles.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'AGENT')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$;

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_properties_slug ON public.properties(slug);
CREATE INDEX IF NOT EXISTS idx_properties_type_status ON public.properties(property_type, status);
CREATE INDEX IF NOT EXISTS idx_properties_price ON public.properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_district ON public.properties(district);
CREATE INDEX IF NOT EXISTS idx_properties_featured ON public.properties(featured);
CREATE INDEX IF NOT EXISTS idx_property_images_prop_id ON public.property_images(property_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);

-- Automatic updated_at trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_properties_timestamp
    BEFORE UPDATE ON public.properties
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Properties: Public can view published listings
CREATE POLICY "Public properties are viewable by everyone" 
ON public.properties FOR SELECT 
USING (published = true);

CREATE POLICY "Admins and agents can manage properties" 
ON public.properties FOR ALL 
TO authenticated 
USING (
    public.is_staff()
);

-- Property Images: Public can view
CREATE POLICY "Property images are viewable by everyone" 
ON public.property_images FOR SELECT 
USING (true);

CREATE POLICY "Admins and agents can manage property images" 
ON public.property_images FOR ALL 
TO authenticated 
USING (
    public.is_staff()
);

-- Agents: Public can view agents
CREATE POLICY "Agents are viewable by everyone" 
ON public.agents FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage agents" 
ON public.agents FOR ALL 
TO authenticated 
USING (
    public.is_admin()
);

-- Inquiries: Anyone can submit an inquiry
CREATE POLICY "Anyone can insert inquiries" 
ON public.inquiries FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Only staff can view inquiries" 
ON public.inquiries FOR SELECT 
TO authenticated 
USING (
    public.is_staff()
);

-- Favorites: Users can manage their own favorites
CREATE POLICY "Users can manage own favorites" 
ON public.favorites FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Profiles: Users can view and update own profile, Admins can view all
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (false);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR ALL 
TO authenticated 
USING (
    public.is_admin()
);

-- Database-side validation for untrusted client input.
ALTER TABLE public.properties
  ADD CONSTRAINT properties_coordinates_valid
  CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT properties_title_length_valid CHECK (char_length(title) BETWEEN 3 AND 200),
  ADD CONSTRAINT properties_description_length_valid CHECK (char_length(description) <= 10000);

ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_name_length_valid CHECK (char_length(name) BETWEEN 1 AND 120),
  ADD CONSTRAINT inquiries_phone_length_valid CHECK (char_length(phone) BETWEEN 7 AND 30),
  ADD CONSTRAINT inquiries_message_length_valid CHECK (char_length(message) <= 5000);

-- Trace staff changes to listings without exposing audit entries publicly.
CREATE TABLE IF NOT EXISTS public.property_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.property_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can view audit logs" ON public.property_audit_log
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.audit_property_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.property_audit_log (property_id, actor_id, action, old_data, new_data)
  VALUES (COALESCE(NEW.id, OLD.id), auth.uid(), TG_OP, to_jsonb(OLD), to_jsonb(NEW));
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS properties_audit_trigger ON public.properties;
CREATE TRIGGER properties_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.audit_property_change();
