-- Run manually in Supabase SQL Editor. Do not execute automatically.
-- Repairs only the legacy KINIK Verified Supplier's missing canonical link.

BEGIN;

DO $$
DECLARE
  v_verified_id constant uuid := '18fad2ca-850f-49af-aeae-c0940081322f';
  v_verified public.verified_supplier%ROWTYPE;
  v_canonical public.suppliers%ROWTYPE;
BEGIN
  SELECT *
    INTO v_verified
    FROM public.verified_supplier
   WHERE supplier_id = v_verified_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'KINIK Verified Supplier % was not found; no repair was performed', v_verified_id;
  END IF;

  IF v_verified.name IS DISTINCT FROM 'KINIK' THEN
    RAISE EXCEPTION 'Verified Supplier UUID % belongs to %, not KINIK; no repair was performed',
      v_verified_id, coalesce(v_verified.name, '<null>');
  END IF;

  -- A pre-existing canonical_supplier_id is already a stable, explicit relationship.
  IF v_verified.canonical_supplier_id IS NOT NULL THEN
    SELECT *
      INTO v_canonical
      FROM public.suppliers
     WHERE supplier_id = v_verified.canonical_supplier_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'KINIK references missing canonical supplier %; no repair was performed',
        v_verified.canonical_supplier_id;
    END IF;

    RAISE NOTICE 'KINIK is already linked to canonical supplier %; no repair was needed',
      v_verified.canonical_supplier_id;
    RETURN;
  END IF;

  -- Prefer the same stable UUID. A collision is reusable only when it is demonstrably compatible.
  SELECT *
    INTO v_canonical
    FROM public.suppliers
   WHERE supplier_id = v_verified_id
   FOR UPDATE;

  IF FOUND THEN
    IF lower(trim(v_canonical.supplier_name)) IS DISTINCT FROM lower(trim(v_verified.name))
       OR v_canonical.verified_supplier IS DISTINCT FROM true
       OR v_canonical.supplier_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION
        'Canonical supplier UUID % already belongs to an incompatible record (name=%, verified=%, status=%); no repair was performed',
        v_verified_id,
        coalesce(v_canonical.supplier_name, '<null>'),
        coalesce(v_canonical.verified_supplier::text, '<null>'),
        coalesce(v_canonical.supplier_status, '<null>');
    END IF;
  ELSE
    INSERT INTO public.suppliers (
      supplier_id,
      supplier_name,
      company_name,
      verified_supplier,
      supplier_status
    ) VALUES (
      v_verified_id,
      v_verified.name,
      v_verified.name,
      true,
      'active'
    );
  END IF;

  UPDATE public.verified_supplier
     SET canonical_supplier_id = v_verified_id
   WHERE supplier_id = v_verified_id
     AND canonical_supplier_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'KINIK canonical link changed concurrently; transaction was cancelled';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
