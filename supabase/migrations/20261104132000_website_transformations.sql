-- Website CMS only: public Transformation Journey cards.
-- Does not read or write members, payments, portal, WhatsApp, or audit tables.

CREATE TABLE IF NOT EXISTS public.website_transformations (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_name text NOT NULL DEFAULT '',
  before_photo_url text NOT NULL DEFAULT '',
  after_photo_url text NOT NULL DEFAULT '',
  photo_message text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  trained_under text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_transformations_gym_sort
  ON public.website_transformations (gym_id, sort_order);

ALTER TABLE public.website_transformations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_website_transformations ON public.website_transformations;
CREATE POLICY public_read_website_transformations
  ON public.website_transformations
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.website_transformations FROM anon, authenticated;
GRANT SELECT ON public.website_transformations TO anon, authenticated;

INSERT INTO public.website_sections (gym_id, section_key, label, enabled, sort_order)
SELECT gym_id, 'transformations', 'Transformation Journey', false, 55
FROM public.website_settings
ON CONFLICT (gym_id, section_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.website_admin_replace_transformations(
  p_token text,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff record;
  r jsonb;
  v_order int := 0;
  v_name text;
  v_before text;
  v_after text;
  v_photo_message text;
  v_message text;
  v_trained text;
BEGIN
  SELECT * INTO v_staff FROM website_session_staff(p_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;
  IF NOT website_is_owner(v_staff.staff_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid payload');
  END IF;

  IF jsonb_array_length(p_rows) > 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too many journeys');
  END IF;

  DELETE FROM website_transformations WHERE gym_id = v_staff.gym_id;

  FOR r IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_name := left(btrim(COALESCE(r->>'member_name', '')), 80);
    v_before := left(btrim(COALESCE(r->>'before_photo_url', '')), 2000);
    v_after := left(btrim(COALESCE(r->>'after_photo_url', '')), 2000);
    v_photo_message := left(btrim(COALESCE(r->>'photo_message', '')), 200);
    v_message := left(btrim(COALESCE(r->>'message', '')), 1000);
    v_trained := left(btrim(COALESCE(r->>'trained_under', '')), 80);

    IF v_before !~* '^https://[^[:space:]]+$' THEN
      v_before := '';
    END IF;
    IF v_after !~* '^https://[^[:space:]]+$' THEN
      v_after := '';
    END IF;

    IF v_name = ''
      AND v_before = ''
      AND v_after = ''
      AND v_photo_message = ''
      AND v_message = ''
      AND v_trained = '' THEN
      CONTINUE;
    END IF;

    INSERT INTO website_transformations (
      gym_id,
      member_name,
      before_photo_url,
      after_photo_url,
      photo_message,
      message,
      trained_under,
      sort_order,
      is_active
    ) VALUES (
      v_staff.gym_id,
      v_name,
      v_before,
      v_after,
      v_photo_message,
      v_message,
      v_trained,
      v_order,
      COALESCE((r->>'is_active')::boolean, true)
    );

    v_order := v_order + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'count', v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.website_admin_replace_transformations(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.website_admin_replace_transformations(text, jsonb) TO anon, authenticated;
