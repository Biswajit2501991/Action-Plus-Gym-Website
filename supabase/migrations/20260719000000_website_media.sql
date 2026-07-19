-- Website media library: public Storage bucket + metadata table

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'website-media',
  'website-media',
  true,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.website_media (
  id bigserial PRIMARY KEY,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  mime_type text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'video')),
  section_tag text NOT NULL DEFAULT '',
  alt_text text NOT NULL DEFAULT '',
  uploaded_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_website_media_gym_created
  ON public.website_media (gym_id, created_at DESC);

ALTER TABLE public.website_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_website_media ON public.website_media;
CREATE POLICY public_read_website_media ON public.website_media
  FOR SELECT TO anon, authenticated
  USING (true);

-- Public read for website-media objects
DROP POLICY IF EXISTS website_media_public_read ON storage.objects;
CREATE POLICY website_media_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'website-media');

CREATE OR REPLACE FUNCTION public.website_admin_list_media(p_token text)
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

  RETURN jsonb_build_object(
    'ok', true,
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at DESC)
      FROM website_media m
      WHERE m.gym_id = v_staff.gym_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.website_admin_delete_media(
  p_token text,
  p_media_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff record;
  v_path text;
BEGIN
  SELECT * INTO v_staff FROM website_session_staff(p_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;
  IF NOT website_is_owner(v_staff.staff_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  SELECT storage_path INTO v_path
  FROM website_media
  WHERE id = p_media_id AND gym_id = v_staff.gym_id;

  IF v_path IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not found');
  END IF;

  DELETE FROM website_media
  WHERE id = p_media_id AND gym_id = v_staff.gym_id;

  DELETE FROM storage.objects
  WHERE bucket_id = 'website-media' AND name = v_path;

  RETURN jsonb_build_object('ok', true, 'storage_path', v_path);
END;
$$;

GRANT EXECUTE ON FUNCTION public.website_admin_list_media(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_admin_delete_media(text, bigint) TO anon, authenticated;
