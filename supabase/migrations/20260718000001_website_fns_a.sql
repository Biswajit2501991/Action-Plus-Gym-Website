-- Helper: validate admin session
CREATE OR REPLACE FUNCTION public.website_session_staff(p_token text)
RETURNS TABLE (
  staff_user_id bigint,
  gym_id uuid,
  staff_role text,
  full_name text,
  staff_login_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT s.staff_user_id, s.gym_id, u.staff_role, u.full_name, u.staff_login_id::text
  FROM website_admin_sessions s
  JOIN staff_users u ON u.id = s.staff_user_id
  WHERE s.token = p_token
    AND s.expires_at > now()
    AND COALESCE(u.is_blocked, false) = false;
END;
$$;

CREATE OR REPLACE FUNCTION public.website_authenticate_staff(
  p_login text,
  p_password text,
  p_gym_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user staff_users%ROWTYPE;
  v_token text;
  v_ok boolean := false;
BEGIN
  SELECT * INTO v_user
  FROM staff_users
  WHERE lower(staff_login_id) = lower(p_login)
    AND gym_id = p_gym_id
  LIMIT 1;

  IF NOT FOUND THEN
    -- also allow master owners linked via gym_codes for this gym
    SELECT u.* INTO v_user
    FROM staff_users u
    WHERE lower(u.staff_login_id) = lower(p_login)
      AND (
        u.gym_id = p_gym_id
        OR u.staff_role = 'master_owner'
        OR u.gym_code_id IN (SELECT id FROM gym_codes WHERE gym_id = p_gym_id)
      )
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid credentials');
  END IF;

  IF COALESCE(v_user.is_blocked, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Account blocked');
  END IF;

  -- bcrypt via pgcrypto
  BEGIN
    v_ok := (extensions.crypt(p_password, v_user.password_hash) = v_user.password_hash);
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
  END;

  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid credentials');
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO website_admin_sessions (staff_user_id, gym_id, token, expires_at)
  VALUES (v_user.id, p_gym_id, v_token, now() + interval '14 days');

  UPDATE staff_users SET last_login_at = now() WHERE id = v_user.id;

  RETURN jsonb_build_object(
    'ok', true,
    'token', v_token,
    'staff', jsonb_build_object(
      'id', v_user.id,
      'full_name', v_user.full_name,
      'staff_login_id', v_user.staff_login_id,
      'staff_role', v_user.staff_role,
      'role_label', v_user.role_label,
      'gym_id', p_gym_id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.website_logout(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM website_admin_sessions WHERE token = p_token;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.website_create_visitor(
  p_gym_id uuid,
  p_full_name text,
  p_email text,
  p_mobile text,
  p_intake_source text,
  p_notes text DEFAULT NULL,
  p_interest_plan text DEFAULT NULL,
  p_goal text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_source text;
BEGIN
  IF p_full_name IS NULL OR length(trim(p_full_name)) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Name required');
  END IF;
  IF p_mobile IS NULL OR length(trim(p_mobile)) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Mobile required');
  END IF;

  v_source := COALESCE(NULLIF(trim(p_intake_source), ''), 'website');
  IF v_source NOT IN ('website', 'website_trial', 'website_contact', 'website_newsletter') THEN
    v_source := 'website';
  END IF;

  INSERT INTO visitors (
    gym_id, full_name, email, mobile, status, intake_source,
    notes, interest_plan, goal, added_at, created_at, updated_at, call_back_required
  ) VALUES (
    p_gym_id,
    trim(p_full_name),
    COALESCE(trim(p_email), ''),
    trim(p_mobile),
    'New',
    v_source,
    p_notes,
    p_interest_plan,
    p_goal,
    now(),
    now(),
    now(),
    true
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.website_is_owner(p_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_role IN ('master_owner', 'branch_owner');
$$;

-- Generic CMS upsert helpers via JSON for owners
CREATE OR REPLACE FUNCTION public.website_admin_save_settings(
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
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;
  IF NOT website_is_owner(v_staff.staff_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  INSERT INTO website_settings AS s (gym_id)
  VALUES (v_staff.gym_id)
  ON CONFLICT (gym_id) DO NOTHING;

  UPDATE website_settings SET
    site_name = COALESCE(p_payload->>'site_name', site_name),
    tagline = COALESCE(p_payload->>'tagline', tagline),
    phone = COALESCE(p_payload->>'phone', phone),
    email = COALESCE(p_payload->>'email', email),
    whatsapp = COALESCE(p_payload->>'whatsapp', whatsapp),
    address = COALESCE(p_payload->>'address', address),
    map_embed_url = COALESCE(p_payload->>'map_embed_url', map_embed_url),
    google_reviews_url = COALESCE(p_payload->>'google_reviews_url', google_reviews_url),
    timezone = COALESCE(p_payload->>'timezone', timezone),
    socials = COALESCE(p_payload->'socials', socials),
    seo_title = COALESCE(p_payload->>'seo_title', seo_title),
    seo_description = COALESCE(p_payload->>'seo_description', seo_description),
    seo_og_image = COALESCE(p_payload->>'seo_og_image', seo_og_image),
    hero_headline = COALESCE(p_payload->>'hero_headline', hero_headline),
    hero_subheadline = COALESCE(p_payload->>'hero_subheadline', hero_subheadline),
    updated_at = now()
  WHERE gym_id = v_staff.gym_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.website_admin_set_section(
  p_token text,
  p_section_key text,
  p_enabled boolean
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

  UPDATE website_sections
  SET enabled = p_enabled
  WHERE gym_id = v_staff.gym_id AND section_key = p_section_key;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.website_admin_save_popup(
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

  INSERT INTO website_popup_offers (gym_id, enabled, title, body, image_url, button_text, button_href, bg_color, accent_color, text_color, expires_at)
  SELECT
    v_staff.gym_id,
    COALESCE((p_payload->>'enabled')::boolean, false),
    COALESCE(p_payload->>'title', ''),
    COALESCE(p_payload->>'body', ''),
    COALESCE(p_payload->>'image_url', ''),
    COALESCE(p_payload->>'button_text', 'Claim Offer'),
    COALESCE(p_payload->>'button_href', '#join'),
    COALESCE(p_payload->>'bg_color', '#0A0A0A'),
    COALESCE(p_payload->>'accent_color', '#C9A227'),
    COALESCE(p_payload->>'text_color', '#FFFFFF'),
    NULLIF(p_payload->>'expires_at', '')::timestamptz
  WHERE NOT EXISTS (SELECT 1 FROM website_popup_offers WHERE gym_id = v_staff.gym_id);

  UPDATE website_popup_offers SET
    enabled = COALESCE((p_payload->>'enabled')::boolean, enabled),
    title = COALESCE(p_payload->>'title', title),
    body = COALESCE(p_payload->>'body', body),
    image_url = COALESCE(p_payload->>'image_url', image_url),
    button_text = COALESCE(p_payload->>'button_text', button_text),
    button_href = COALESCE(p_payload->>'button_href', button_href),
    bg_color = COALESCE(p_payload->>'bg_color', bg_color),
    accent_color = COALESCE(p_payload->>'accent_color', accent_color),
    text_color = COALESCE(p_payload->>'text_color', text_color),
    expires_at = CASE WHEN p_payload ? 'expires_at' THEN NULLIF(p_payload->>'expires_at', '')::timestamptz ELSE expires_at END,
    updated_at = now()
  WHERE gym_id = v_staff.gym_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.website_admin_list_leads(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff record;
  v_rows jsonb;
BEGIN
  SELECT * INTO v_staff FROM website_session_staff(p_token);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized'); END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY v.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT id, full_name, email, mobile, status, intake_source, notes, interest_plan, goal, created_at, added_at
    FROM visitors
    WHERE gym_id = v_staff.gym_id
      AND intake_source LIKE 'website%'
    ORDER BY created_at DESC
    LIMIT 200
  ) v;

  RETURN jsonb_build_object('ok', true, 'leads', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.website_admin_update_lead(
  p_token text,
  p_lead_id bigint,
  p_status text,
  p_notes text
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

  UPDATE visitors SET
    status = COALESCE(NULLIF(p_status, ''), status),
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = p_lead_id
    AND gym_id = v_staff.gym_id
    AND intake_source LIKE 'website%';

  RETURN jsonb_build_object('ok', true);
END;
$$;
