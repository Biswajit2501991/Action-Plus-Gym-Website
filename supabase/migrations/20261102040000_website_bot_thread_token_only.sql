-- Ask Me: load a public thread only with the conversation token.
-- Keep the same function signature so existing grants still apply.
-- Does not drop messages, threads, members, or payments.

create or replace function public.website_bot_get_thread(
  p_gym_id uuid,
  p_public_token uuid default null,
  p_mobile text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread website_bot_threads%rowtype;
  v_msgs jsonb;
begin
  -- p_mobile is ignored. Anyone with the public anon key must not
  -- recover another person's chat by guessing a mobile number.
  if p_public_token is null then
    return jsonb_build_object('ok', false, 'error', 'Conversation token required');
  end if;

  select * into v_thread
  from website_bot_threads
  where gym_id = p_gym_id
    and public_token = p_public_token
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Conversation not found');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'sender', m.sender,
      'body', m.body,
      'staff_name', m.staff_name,
      'created_at', m.created_at
    ) order by m.created_at, m.id
  ), '[]'::jsonb)
  into v_msgs
  from website_bot_messages m
  where m.thread_id = v_thread.id;

  return jsonb_build_object(
    'ok', true,
    'thread', jsonb_build_object(
      'id', v_thread.id,
      'public_token', v_thread.public_token,
      'customer_name', v_thread.customer_name,
      'mobile', v_thread.mobile,
      'email', v_thread.email,
      'status', v_thread.status,
      'created_at', v_thread.created_at,
      'updated_at', v_thread.updated_at
    ),
    'messages', v_msgs
  );
end;
$$;
