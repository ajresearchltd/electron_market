-- Run manually in Supabase SQL Editor.
-- Do not paste Codex prompts or reports into Supabase.
-- Secure verified supplier logo storage and Admin-only writes.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('verified-supplier-images', 'verified-supplier-images', true, 2097152, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp'];

ALTER TABLE public.verified_supplier ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can select verified_supplier" ON public.verified_supplier;
CREATE POLICY "Public can read verified suppliers" ON public.verified_supplier FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert verified_supplier" ON public.verified_supplier;
DROP POLICY IF EXISTS "Authenticated users can update verified_supplier" ON public.verified_supplier;
DROP POLICY IF EXISTS "Authenticated users can delete verified_supplier" ON public.verified_supplier;
DROP POLICY IF EXISTS "Admins can insert verified suppliers" ON public.verified_supplier;
CREATE POLICY "Admins can insert verified suppliers" ON public.verified_supplier FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin'));
DROP POLICY IF EXISTS "Admins can update verified suppliers" ON public.verified_supplier;
CREATE POLICY "Admins can update verified suppliers" ON public.verified_supplier FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin'));
DROP POLICY IF EXISTS "Admins can delete verified suppliers" ON public.verified_supplier;
CREATE POLICY "Admins can delete verified suppliers" ON public.verified_supplier FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin'));

DROP POLICY IF EXISTS "Public can read verified supplier images" ON storage.objects;
CREATE POLICY "Public can read verified supplier images" ON storage.objects FOR SELECT TO public USING (bucket_id='verified-supplier-images');
DROP POLICY IF EXISTS "Admins can upload verified supplier images" ON storage.objects;
CREATE POLICY "Admins can upload verified supplier images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='verified-supplier-images' AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin'));
DROP POLICY IF EXISTS "Admins can update verified supplier images" ON storage.objects;
CREATE POLICY "Admins can update verified supplier images" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='verified-supplier-images' AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin'))
WITH CHECK (bucket_id='verified-supplier-images' AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin'));
DROP POLICY IF EXISTS "Admins can delete verified supplier images" ON storage.objects;
CREATE POLICY "Admins can delete verified supplier images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='verified-supplier-images' AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin'));
NOTIFY pgrst, 'reload schema';
