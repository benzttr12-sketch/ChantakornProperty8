BEGIN;

CREATE TABLE IF NOT EXISTS public.site_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  agency_name text NOT NULL CHECK (length(agency_name) BETWEEN 1 AND 150),
  phone text NOT NULL CHECK (length(phone) BETWEEN 7 AND 30),
  line_id text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  hours text NOT NULL DEFAULT ''
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public site settings" ON public.site_settings;
CREATE POLICY "Public site settings" ON public.site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin site settings" ON public.site_settings;
CREATE POLICY "Admin site settings" ON public.site_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('consignment-photos', 'consignment-photos', false, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
       ('property-photos', 'property-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Submit consignment photos" ON storage.objects;
CREATE POLICY "Submit consignment photos" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'consignment-photos' AND name ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$');
DROP POLICY IF EXISTS "Staff read consignment photos" ON storage.objects;
CREATE POLICY "Staff read consignment photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'consignment-photos' AND public.is_staff());
DROP POLICY IF EXISTS "Staff manage property photos" ON storage.objects;
CREATE POLICY "Staff manage property photos" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'property-photos' AND public.is_staff())
  WITH CHECK (bucket_id = 'property-photos' AND public.is_staff());

-- Draft photos follow the visibility of their property.
DROP POLICY IF EXISTS "Property images are viewable by everyone" ON public.property_images;
CREATE POLICY "Property images are viewable by everyone" ON public.property_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.published));

-- Save the listing and its image rows as one transaction.
CREATE OR REPLACE FUNCTION public.save_property(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  item public.properties;
  property_id uuid := COALESCE((payload->>'id')::uuid, gen_random_uuid());
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff access required'; END IF;
  IF jsonb_typeof(payload->'images') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'images') > 30
    THEN RAISE EXCEPTION 'Invalid images'; END IF;
  SELECT * INTO item FROM jsonb_populate_record(NULL::public.properties, payload);
  INSERT INTO public.properties (id,title,slug,description,property_type,status,price,province,district,subdistrict,address,
    latitude,longitude,bedrooms,bathrooms,parking,land_size,usable_area,year_built,furniture,features,cover_image,featured,published,agent_id)
  VALUES (property_id,item.title,item.slug,item.description,item.property_type,item.status,item.price,item.province,item.district,
    item.subdistrict,item.address,item.latitude,item.longitude,COALESCE(item.bedrooms,0),COALESCE(item.bathrooms,0),COALESCE(item.parking,0),
    COALESCE(item.land_size,0),COALESCE(item.usable_area,0),item.year_built,item.furniture,COALESCE(item.features,'{}'),item.cover_image,
    COALESCE(item.featured,false),COALESCE(item.published,false),item.agent_id)
  ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,slug=EXCLUDED.slug,description=EXCLUDED.description,
    property_type=EXCLUDED.property_type,status=EXCLUDED.status,price=EXCLUDED.price,province=EXCLUDED.province,
    district=EXCLUDED.district,subdistrict=EXCLUDED.subdistrict,address=EXCLUDED.address,latitude=EXCLUDED.latitude,
    longitude=EXCLUDED.longitude,bedrooms=EXCLUDED.bedrooms,bathrooms=EXCLUDED.bathrooms,parking=EXCLUDED.parking,
    land_size=EXCLUDED.land_size,usable_area=EXCLUDED.usable_area,year_built=EXCLUDED.year_built,furniture=EXCLUDED.furniture,
    features=EXCLUDED.features,cover_image=EXCLUDED.cover_image,featured=EXCLUDED.featured,published=EXCLUDED.published,agent_id=EXCLUDED.agent_id
  RETURNING * INTO item;
  DELETE FROM public.property_images WHERE property_images.property_id = item.id;
  INSERT INTO public.property_images (property_id,image_url,sort_order)
    SELECT item.id, value, ordinality-1 FROM jsonb_array_elements_text(payload->'images') WITH ORDINALITY;
  RETURN to_jsonb(item) || jsonb_build_object('property_images',
    (SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]') FROM public.property_images i WHERE i.property_id = item.id));
END;
$$;
REVOKE ALL ON FUNCTION public.save_property(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_property(jsonb) TO authenticated;

-- Stop a mistaken role edit from removing the last administrator.
CREATE OR REPLACE FUNCTION public.protect_last_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'ADMIN' AND NEW.role IS DISTINCT FROM 'ADMIN' THEN
    PERFORM pg_advisory_xact_lock(824319);
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role='ADMIN' AND id <> OLD.id)
      THEN RAISE EXCEPTION 'Cannot remove the last administrator'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_last_admin ON public.profiles;
CREATE TRIGGER protect_last_admin BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin();
COMMIT;
