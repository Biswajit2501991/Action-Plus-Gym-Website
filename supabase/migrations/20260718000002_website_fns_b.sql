
CREATE OR REPLACE FUNCTION public.website_admin_replace_collection(
  p_token text,
  p_table text,
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
BEGIN
  SELECT * INTO v_staff FROM website_session_staff(p_token);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized'); END IF;
  IF NOT website_is_owner(v_staff.staff_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  IF p_table = 'website_services' THEN
    DELETE FROM website_services WHERE gym_id = v_staff.gym_id;
    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
    LOOP
      INSERT INTO website_services (gym_id, title, description, icon, image_url, sort_order, is_active)
      VALUES (
        v_staff.gym_id,
        r->>'title',
        COALESCE(r->>'description', ''),
        COALESCE(r->>'icon', 'dumbbell'),
        COALESCE(r->>'image_url', ''),
        COALESCE((r->>'sort_order')::int, 0),
        COALESCE((r->>'is_active')::boolean, true)
      );
    END LOOP;
  ELSIF p_table = 'website_pricing_plans' THEN
    DELETE FROM website_pricing_plans WHERE gym_id = v_staff.gym_id;
    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
    LOOP
      INSERT INTO website_pricing_plans (gym_id, name, period, price, description, features, is_featured, badge, cta_text, sort_order, is_active)
      VALUES (
        v_staff.gym_id,
        r->>'name',
        COALESCE(r->>'period', 'monthly'),
        r->>'price',
        COALESCE(r->>'description', ''),
        COALESCE(r->'features', '[]'::jsonb),
        COALESCE((r->>'is_featured')::boolean, false),
        COALESCE(r->>'badge', ''),
        COALESCE(r->>'cta_text', 'Join Now'),
        COALESCE((r->>'sort_order')::int, 0),
        COALESCE((r->>'is_active')::boolean, true)
      );
    END LOOP;
  ELSIF p_table = 'website_trainers' THEN
    DELETE FROM website_trainers WHERE gym_id = v_staff.gym_id;
    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
    LOOP
      INSERT INTO website_trainers (gym_id, name, photo_url, experience, specialization, bio, socials, sort_order, is_active)
      VALUES (
        v_staff.gym_id,
        r->>'name',
        COALESCE(r->>'photo_url', ''),
        COALESCE(r->>'experience', ''),
        COALESCE(r->>'specialization', ''),
        COALESCE(r->>'bio', ''),
        COALESCE(r->'socials', '{}'::jsonb),
        COALESCE((r->>'sort_order')::int, 0),
        COALESCE((r->>'is_active')::boolean, true)
      );
    END LOOP;
  ELSIF p_table = 'website_testimonials' THEN
    DELETE FROM website_testimonials WHERE gym_id = v_staff.gym_id;
    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
    LOOP
      INSERT INTO website_testimonials (gym_id, name, quote, rating, photo_url, video_url, sort_order, is_active)
      VALUES (
        v_staff.gym_id,
        r->>'name',
        r->>'quote',
        COALESCE((r->>'rating')::numeric, 5),
        COALESCE(r->>'photo_url', ''),
        COALESCE(r->>'video_url', ''),
        COALESCE((r->>'sort_order')::int, 0),
        COALESCE((r->>'is_active')::boolean, true)
      );
    END LOOP;
  ELSIF p_table = 'website_videos' THEN
    DELETE FROM website_videos WHERE gym_id = v_staff.gym_id;
    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
    LOOP
      INSERT INTO website_videos (gym_id, title, youtube_url, mp4_url, thumbnail_url, sort_order, is_active)
      VALUES (
        v_staff.gym_id,
        r->>'title',
        COALESCE(r->>'youtube_url', ''),
        COALESCE(r->>'mp4_url', ''),
        COALESCE(r->>'thumbnail_url', ''),
        COALESCE((r->>'sort_order')::int, 0),
        COALESCE((r->>'is_active')::boolean, true)
      );
    END LOOP;
  ELSIF p_table = 'website_stats' THEN
    DELETE FROM website_stats WHERE gym_id = v_staff.gym_id;
    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
    LOOP
      INSERT INTO website_stats (gym_id, label, value, sort_order)
      VALUES (v_staff.gym_id, r->>'label', r->>'value', COALESCE((r->>'sort_order')::int, 0));
    END LOOP;
  ELSIF p_table = 'website_hero_slides' THEN
    DELETE FROM website_hero_slides WHERE gym_id = v_staff.gym_id;
    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
    LOOP
      INSERT INTO website_hero_slides (gym_id, title, image_url, video_url, sort_order, is_active)
      VALUES (
        v_staff.gym_id,
        COALESCE(r->>'title', ''),
        r->>'image_url',
        COALESCE(r->>'video_url', ''),
        COALESCE((r->>'sort_order')::int, 0),
        COALESCE((r->>'is_active')::boolean, true)
      );
    END LOOP;
  ELSIF p_table = 'website_gallery_images' THEN
    DELETE FROM website_gallery_images WHERE gym_id = v_staff.gym_id;
    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
    LOOP
      INSERT INTO website_gallery_images (gym_id, album_id, image_url, alt_text, sort_order, is_active)
      VALUES (
        v_staff.gym_id,
        NULLIF(r->>'album_id', '')::bigint,
        r->>'image_url',
        COALESCE(r->>'alt_text', ''),
        COALESCE((r->>'sort_order')::int, 0),
        COALESCE((r->>'is_active')::boolean, true)
      );
    END LOOP;
  ELSIF p_table = 'website_gallery_albums' THEN
    DELETE FROM website_gallery_images WHERE gym_id = v_staff.gym_id;
    DELETE FROM website_gallery_albums WHERE gym_id = v_staff.gym_id;
    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
    LOOP
      INSERT INTO website_gallery_albums (gym_id, name, description, sort_order, is_active)
      VALUES (
        v_staff.gym_id,
        r->>'name',
        COALESCE(r->>'description', ''),
        COALESCE((r->>'sort_order')::int, 0),
        COALESCE((r->>'is_active')::boolean, true)
      );
    END LOOP;
  ELSIF p_table = 'website_opening_hours' THEN
    DELETE FROM website_opening_hours WHERE gym_id = v_staff.gym_id;
    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
    LOOP
      INSERT INTO website_opening_hours (gym_id, day_of_week, open_time, close_time, is_closed, is_hidden)
      VALUES (
        v_staff.gym_id,
        (r->>'day_of_week')::int,
        NULLIF(r->>'open_time', '')::time,
        NULLIF(r->>'close_time', '')::time,
        COALESCE((r->>'is_closed')::boolean, false),
        COALESCE((r->>'is_hidden')::boolean, false)
      );
    END LOOP;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown table');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.website_admin_save_reviews(
  p_token text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff record;
BEGIN
  SELECT * INTO v_staff FROM website_session_staff(p_token);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized'); END IF;
  IF NOT website_is_owner(v_staff.staff_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  INSERT INTO website_reviews_cache (gym_id, overall_rating, total_reviews, google_url, reviews, updated_at)
  VALUES (
    v_staff.gym_id,
    COALESCE((p_payload->>'overall_rating')::numeric, 5),
    COALESCE((p_payload->>'total_reviews')::int, 0),
    COALESCE(p_payload->>'google_url', ''),
    COALESCE(p_payload->'reviews', '[]'::jsonb),
    now()
  )
  ON CONFLICT (gym_id) DO UPDATE SET
    overall_rating = EXCLUDED.overall_rating,
    total_reviews = EXCLUDED.total_reviews,
    google_url = EXCLUDED.google_url,
    reviews = EXCLUDED.reviews,
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.website_admin_overview(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff record;
  v_today int;
  v_total int;
  v_popup boolean;
BEGIN
  SELECT * INTO v_staff FROM website_session_staff(p_token);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized'); END IF;

  SELECT COUNT(*)::int INTO v_today
  FROM visitors
  WHERE gym_id = v_staff.gym_id
    AND intake_source LIKE 'website%'
    AND created_at::date = CURRENT_DATE;

  SELECT COUNT(*)::int INTO v_total
  FROM visitors
  WHERE gym_id = v_staff.gym_id
    AND intake_source LIKE 'website%';

  SELECT COALESCE(enabled, false) INTO v_popup
  FROM website_popup_offers WHERE gym_id = v_staff.gym_id LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'staff', jsonb_build_object(
      'id', v_staff.staff_user_id,
      'full_name', v_staff.full_name,
      'staff_role', v_staff.staff_role,
      'staff_login_id', v_staff.staff_login_id
    ),
    'leads_today', v_today,
    'leads_total', v_total,
    'popup_enabled', COALESCE(v_popup, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.website_authenticate_staff(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_logout(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_create_visitor(uuid, text, text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_session_staff(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_admin_save_settings(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_admin_set_section(text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_admin_save_popup(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_admin_list_leads(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_admin_update_lead(text, bigint, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_admin_replace_collection(text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_admin_save_reviews(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_admin_overview(text) TO anon, authenticated;
