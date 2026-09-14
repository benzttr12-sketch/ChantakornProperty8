-- Run after schema.sql. Safe to re-run on an existing project.
BEGIN;
DROP POLICY IF EXISTS "Anyone can insert inquiries" ON public.inquiries;
CREATE POLICY "Anyone can insert inquiries" ON public.inquiries
  FOR INSERT TO anon, authenticated WITH CHECK (status = 'new');

DROP POLICY IF EXISTS "Staff can update inquiries" ON public.inquiries;
CREATE POLICY "Staff can update inquiries" ON public.inquiries
  FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON public.inquiries TO anon, authenticated;
GRANT SELECT, UPDATE ON public.inquiries TO authenticated;
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON public.inquiries(created_at DESC);
COMMIT;
