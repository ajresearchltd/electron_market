-- Manual Supabase SQL Editor migration. Do not run automatically.
-- Fixes Product Finder configuration publication so save + activation is one transaction.

CREATE OR REPLACE FUNCTION public.publish_product_finder_ai_configuration(p_configuration jsonb)
RETURNS public.product_finder_ai_config_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.product_finder_ai_config_versions;
  v_next_version integer;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = v_actor AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_configuration IS NULL
     OR jsonb_typeof(p_configuration) <> 'object'
     OR jsonb_typeof(p_configuration->'responsesApi') <> 'object' THEN
    RAISE EXCEPTION 'Invalid Product Finder configuration' USING ERRCODE = '22023';
  END IF;

  -- Serialize publishers for this singleton configuration key. The transaction
  -- rolls back every change if any later statement fails.
  PERFORM pg_advisory_xact_lock(hashtext('product_finder_ai_configuration'));

  SELECT * INTO v_row
  FROM public.product_finder_ai_config_versions
  WHERE configuration_key = 'product_finder' AND status = 'draft'
  ORDER BY version_number DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.product_finder_ai_config_versions
    SET configuration = p_configuration,
        updated_by = v_actor,
        updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    SELECT COALESCE(max(version_number), 0) + 1 INTO v_next_version
    FROM public.product_finder_ai_config_versions
    WHERE configuration_key = 'product_finder';

    INSERT INTO public.product_finder_ai_config_versions
      (configuration_key, version_number, status, configuration, created_by, updated_by)
    VALUES
      ('product_finder', v_next_version, 'draft', p_configuration, v_actor, v_actor)
    RETURNING * INTO v_row;
  END IF;

  UPDATE public.product_finder_ai_config_versions
  SET status = 'archived', updated_at = now(), updated_by = v_actor
  WHERE configuration_key = 'product_finder'
    AND status = 'published'
    AND id <> v_row.id;

  UPDATE public.product_finder_ai_config_versions
  SET status = 'published', published_at = now(), updated_at = now(), updated_by = v_actor
  WHERE id = v_row.id AND status = 'draft'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product Finder draft could not be published' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END
$$;

REVOKE ALL ON FUNCTION public.publish_product_finder_ai_configuration(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_product_finder_ai_configuration(jsonb) TO authenticated;

-- The obsolete UUID overload required a draft created outside the transaction.
DROP FUNCTION IF EXISTS public.publish_product_finder_ai_configuration(uuid);

NOTIFY pgrst, 'reload schema';
