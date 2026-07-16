-- Run manually in Supabase SQL Editor.
-- Electron Market - allow the existing internal Support application role.
-- This migration changes no user records.

DO $$
DECLARE
  current_definition text;
  expected_old_definition constant text :=
    'CHECK ((role = ANY (ARRAY[''customer''::text, ''supplier''::text, ''admin''::text])))';
  expected_new_definition constant text :=
    'CHECK ((role = ANY (ARRAY[''customer''::text, ''supplier''::text, ''admin''::text, ''support''::text])))';
BEGIN
  SELECT pg_get_constraintdef(constraint_row.oid, true)
    INTO current_definition
  FROM pg_constraint AS constraint_row
  WHERE constraint_row.conrelid = 'public.user_profiles'::regclass
    AND constraint_row.conname = 'user_profiles_role_check'
    AND constraint_row.contype = 'c';

  IF current_definition IS NULL THEN
    RAISE EXCEPTION 'Expected CHECK constraint public.user_profiles.user_profiles_role_check was not found.';
  END IF;

  IF current_definition = expected_new_definition THEN
    RAISE NOTICE 'user_profiles_role_check already permits support; no change was required.';
    RETURN;
  END IF;

  IF current_definition <> expected_old_definition THEN
    RAISE EXCEPTION
      'Refusing to replace unexpected user_profiles_role_check definition: %',
      current_definition;
  END IF;

  ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_role_check;
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN ('customer', 'supplier', 'admin', 'support'));
END
$$;

NOTIFY pgrst, 'reload schema';
