-- Action Plus Gym website CMS schema
-- Integrates with existing visitors + staff_users (Gym Manager)

CREATE SCHEMA IF NOT EXISTS website;

-- Settings (singleton per gym)
CREATE TABLE IF NOT EXISTS public.website_settings (
  gym_id uuid PRIMARY KEY REFERENCES public.gyms(id) ON DELETE CASCADE,
  site_name text NOT NULL DEFAULT 'Action Plus Gym',
  tagline text NOT NULL DEFAULT 'Train Harder. Live Stronger.',
  phone text DEFAULT '',
  email text DEFAULT '',
  whatsapp text DEFAULT '',
  address text DEFAULT '',
  map_embed_url text DEFAULT '',
  google_reviews_url text DEFAULT '',
  timezone text NOT NULL DEFAULT 'Australia/Sydney',
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_title text DEFAULT 'Action Plus Gym | Premium Fitness',
  seo_description text DEFAULT 'Premium gym training, personal coaching, and world-class facilities.',
  seo_og_image text DEFAULT '',
  hero_headline text DEFAULT 'Elevate Your Limits',
  hero_subheadline text DEFAULT 'Premium coaching, elite equipment, and a membership experience built for results.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.website_sections (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (gym_id, section_key)
);

CREATE TABLE IF NOT EXISTS public.website_popup_offers (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  image_url text DEFAULT '',
  button_text text DEFAULT 'Claim Offer',
  button_href text DEFAULT '#join',
  bg_color text DEFAULT '#0A0A0A',
  accent_color text DEFAULT '#C9A227',
  text_color text DEFAULT '#FFFFFF',
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.website_hero_slides (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  title text DEFAULT '',
  image_url text NOT NULL,
  video_url text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.website_stats (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.website_services (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text DEFAULT 'dumbbell',
  image_url text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.website_pricing_plans (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  period text NOT NULL DEFAULT 'monthly',
  price text NOT NULL,
  description text DEFAULT '',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_featured boolean NOT NULL DEFAULT false,
  badge text DEFAULT '',
  cta_text text DEFAULT 'Join Now',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.website_trainers (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_url text DEFAULT '',
  experience text DEFAULT '',
  specialization text DEFAULT '',
  bio text DEFAULT '',
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.website_gallery_albums (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.website_gallery_images (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  album_id bigint REFERENCES public.website_gallery_albums(id) ON DELETE SET NULL,
  image_url text NOT NULL,
  alt_text text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.website_videos (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  title text NOT NULL,
  youtube_url text DEFAULT '',
  mp4_url text DEFAULT '',
  thumbnail_url text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.website_testimonials (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  quote text NOT NULL,
  rating numeric(2,1) DEFAULT 5,
  photo_url text DEFAULT '',
  video_url text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.website_opening_hours (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time time,
  close_time time,
  is_closed boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  UNIQUE (gym_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS public.website_reviews_cache (
  gym_id uuid PRIMARY KEY REFERENCES public.gyms(id) ON DELETE CASCADE,
  overall_rating numeric(2,1) DEFAULT 5.0,
  total_reviews int DEFAULT 0,
  google_url text DEFAULT '',
  reviews jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.website_newsletter (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id, email)
);

CREATE TABLE IF NOT EXISTS public.website_admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id bigint NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_admin_sessions_token ON public.website_admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_website_sections_gym ON public.website_sections(gym_id);
CREATE INDEX IF NOT EXISTS idx_website_services_gym ON public.website_services(gym_id);

-- RLS
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_popup_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_hero_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_gallery_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_reviews_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_newsletter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_admin_sessions ENABLE ROW LEVEL SECURITY;

-- Public read policies
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'website_settings','website_sections','website_popup_offers','website_hero_slides',
    'website_stats','website_services','website_pricing_plans','website_trainers',
    'website_gallery_albums','website_gallery_images','website_videos','website_testimonials',
    'website_opening_hours','website_reviews_cache'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I; CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true);',
      'public_read_' || t, t, 'public_read_' || t, t
    );
  END LOOP;
END $$;

-- Newsletter insert for anon
DROP POLICY IF EXISTS newsletter_insert ON public.website_newsletter;
CREATE POLICY newsletter_insert ON public.website_newsletter
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

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

  v_token := encode(gen_random_bytes(32), 'hex');

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
