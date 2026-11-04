-- Website CMS only. Sets the current on-screen order and lets an owner
-- change sort_order. Does not change enabled flags or section content.

UPDATE public.website_sections
SET sort_order = CASE section_key
  WHEN 'hero' THEN 0
  WHEN 'stats' THEN 10
  WHEN 'transformations' THEN 20
  WHEN 'pricing' THEN 30
  WHEN 'trainers' THEN 40
  WHEN 'services' THEN 50
  WHEN 'gallery' THEN 60
  WHEN 'videos' THEN 70
  WHEN 'testimonials' THEN 80
  WHEN 'hours' THEN 90
  WHEN 'reviews' THEN 100
  WHEN 'contact' THEN 110
  WHEN 'popup' THEN 200
  WHEN 'footer' THEN 1000
  ELSE sort_order
END
WHERE section_key IN (
  'hero', 'stats', 'transformations', 'pricing', 'trainers', 'services',
  'gallery', 'videos', 'testimonials', 'hours', 'reviews', 'contact',
  'popup', 'footer'
);

CREATE OR REPLACE FUNCTION public.website_admin_set_section_order(
  p_token text,
  p_keys jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff record;
  v_key text;
  v_seen text[] := ARRAY[]::text[];
  v_order int := 0;
  v_allowed text[] := ARRAY[
    'stats', 'transformations', 'pricing', 'trainers', 'services',
    'gallery', 'videos', 'testimonials', 'hours', 'reviews', 'contact'
  ];
BEGIN
  SELECT * INTO v_staff FROM website_session_staff(p_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;
  IF NOT website_is_owner(v_staff.staff_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  IF p_keys IS NULL OR jsonb_typeof(p_keys) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid payload');
  END IF;
  IF jsonb_array_length(p_keys) > 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too many sections');
  END IF;

  FOR v_key IN SELECT value FROM jsonb_array_elements_text(p_keys)
  LOOP
    IF NOT (v_key = ANY (v_allowed)) OR v_key = ANY (v_seen) THEN
      CONTINUE;
    END IF;
    v_seen := array_append(v_seen, v_key);
    v_order := v_order + 1;
    UPDATE website_sections
    SET sort_order = v_order * 10
    WHERE gym_id = v_staff.gym_id
      AND section_key = v_key;
  END LOOP;

  FOR v_key IN
    SELECT section_key
    FROM website_sections
    WHERE gym_id = v_staff.gym_id
      AND section_key = ANY (v_allowed)
      AND NOT (section_key = ANY (v_seen))
    ORDER BY sort_order, section_key
  LOOP
    v_order := v_order + 1;
    UPDATE website_sections
    SET sort_order = v_order * 10
    WHERE gym_id = v_staff.gym_id
      AND section_key = v_key;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.website_admin_set_section_order(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.website_admin_set_section_order(text, jsonb) TO anon, authenticated;
