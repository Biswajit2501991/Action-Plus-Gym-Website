CREATE OR REPLACE FUNCTION public.website_bot_admin_unread_count(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff record;
  v_count int;
BEGIN
  SELECT * INTO v_staff FROM website_session_staff(p_token);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized'); END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM website_bot_threads
  WHERE gym_id = v_staff.gym_id
    AND status = 'open';

  RETURN jsonb_build_object('ok', true, 'count', COALESCE(v_count, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.website_bot_admin_unread_count(text) TO anon, authenticated;
