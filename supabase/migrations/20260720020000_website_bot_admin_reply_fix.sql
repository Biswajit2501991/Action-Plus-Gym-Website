CREATE OR REPLACE FUNCTION public.website_bot_admin_reply(
  p_token text,
  p_thread_id bigint,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_user_id bigint;
  v_gym_id uuid;
  v_full_name text;
  v_staff_login_id text;
  v_thread_id bigint;
  v_body text;
BEGIN
  SELECT s.staff_user_id, s.gym_id, s.full_name, s.staff_login_id
  INTO v_staff_user_id, v_gym_id, v_full_name, v_staff_login_id
  FROM website_session_staff(p_token) AS s
  LIMIT 1;

  IF v_staff_user_id IS NULL OR v_gym_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  v_body := trim(COALESCE(p_body, ''));
  IF length(v_body) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reply required');
  END IF;

  SELECT th.id INTO v_thread_id
  FROM website_bot_threads th
  WHERE th.id = p_thread_id
    AND th.gym_id = v_gym_id
  LIMIT 1;

  IF v_thread_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not found');
  END IF;

  INSERT INTO website_bot_messages (gym_id, thread_id, sender, body, staff_name)
  VALUES (
    v_gym_id,
    v_thread_id,
    'staff',
    v_body,
    COALESCE(NULLIF(trim(v_full_name), ''), NULLIF(trim(v_staff_login_id), ''), 'Action Plus Gym')
  );

  UPDATE website_bot_threads SET
    status = 'answered',
    updated_at = now()
  WHERE id = v_thread_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.website_bot_admin_reply(text, bigint, text) TO anon, authenticated;
