-- Electron Market - Public storage bucket for homepage Special Offers images.
-- Run manually in Supabase SQL Editor before using Admin Discount Prices image uploads.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'homepage-discount-images',
  'homepage-discount-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

DROP POLICY IF EXISTS "Anyone can read homepage discount images" ON storage.objects;
CREATE POLICY "Anyone can read homepage discount images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'homepage-discount-images');

DROP POLICY IF EXISTS "Admins can upload homepage discount images" ON storage.objects;
CREATE POLICY "Admins can upload homepage discount images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'homepage-discount-images'
    AND (storage.foldername(name))[1] = 'homepage-discounts'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update homepage discount images" ON storage.objects;
CREATE POLICY "Admins can update homepage discount images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'homepage-discount-images'
    AND (storage.foldername(name))[1] = 'homepage-discounts'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'homepage-discount-images'
    AND (storage.foldername(name))[1] = 'homepage-discounts'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete homepage discount images" ON storage.objects;
CREATE POLICY "Admins can delete homepage discount images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'homepage-discount-images'
    AND (storage.foldername(name))[1] = 'homepage-discounts'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );
