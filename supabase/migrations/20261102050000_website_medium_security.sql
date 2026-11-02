-- Medium security: staff login lockout, owner-only FAQ save, durable rate-limit hits.
-- Additive. Does not change members, payments, portal sessions, or Ask Me messages.

create table if not exists public.website_staff_login_attempts (
  id bigserial primary key,
  gym_id uuid not null,
  login_norm text not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists website_staff_login_attempts_lookup_idx
  on public.website_staff_login_attempts (gym_id, login_norm, created_at desc);

alter table public.website_staff_login_attempts enable row level security;

create table if not exists public.website_rate_hits (
  rate_key text primary key,
  last_hit_at timestamptz not null default now()
);

alter table public.website_rate_hits enable row level security;

create or replace function public.website_authenticate_staff(
  p_login text,
  p_password text,
  p_gym_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user staff_users%rowtype;
  v_token text;
  v_ok boolean := false;
  v_login text := lower(trim(coalesce(p_login, '')));
  v_fails int := 0;
begin
  if v_login = '' then
    return jsonb_build_object('ok', false, 'error', 'Invalid credentials');
  end if;

  delete from website_staff_login_attempts
  where gym_id = p_gym_id
    and login_norm = v_login
    and created_at < now() - interval '1 day';

  select count(*)::int into v_fails
  from website_staff_login_attempts
  where gym_id = p_gym_id
    and login_norm = v_login
    and succeeded = false
    and created_at > now() - interval '15 minutes';

  if v_fails >= 5 then
    return jsonb_build_object(
      'ok', false,
      'error', 'Too many attempts. Try again in 15 minutes.'
    );
  end if;

  select * into v_user
  from staff_users
  where lower(staff_login_id) = v_login
    and gym_id = p_gym_id
  limit 1;

  if not found then
    select u.* into v_user
    from staff_users u
    where lower(u.staff_login_id) = v_login
      and (
        u.gym_id = p_gym_id
        or u.staff_role = 'master_owner'
        or u.gym_code_id in (select id from gym_codes where gym_id = p_gym_id)
      )
    limit 1;
  end if;

  if not found then
    insert into website_staff_login_attempts (gym_id, login_norm, succeeded)
    values (p_gym_id, v_login, false);
    return jsonb_build_object('ok', false, 'error', 'Invalid credentials');
  end if;

  if coalesce(v_user.is_blocked, false) then
    insert into website_staff_login_attempts (gym_id, login_norm, succeeded)
    values (p_gym_id, v_login, false);
    return jsonb_build_object('ok', false, 'error', 'Account blocked');
  end if;

  begin
    v_ok := (extensions.crypt(p_password, v_user.password_hash) = v_user.password_hash);
  exception when others then
    v_ok := false;
  end;

  if not v_ok then
    insert into website_staff_login_attempts (gym_id, login_norm, succeeded)
    values (p_gym_id, v_login, false);
    return jsonb_build_object('ok', false, 'error', 'Invalid credentials');
  end if;

  insert into website_staff_login_attempts (gym_id, login_norm, succeeded)
  values (p_gym_id, v_login, true);

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into website_admin_sessions (staff_user_id, gym_id, token, expires_at)
  values (v_user.id, p_gym_id, v_token, now() + interval '14 days');

  update staff_users set last_login_at = now() where id = v_user.id;

  return jsonb_build_object(
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
end;
$$;

create or replace function public.website_bot_admin_save_faqs(
  p_token text,
  p_faqs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff record;
  r jsonb;
  v_i int := 0;
begin
  select * into v_staff from website_session_staff(p_token);
  if not found then return jsonb_build_object('ok', false, 'error', 'Unauthorized'); end if;
  if not website_is_owner(v_staff.staff_role) then
    return jsonb_build_object('ok', false, 'error', 'Owner only');
  end if;

  delete from website_bot_faqs where gym_id = v_staff.gym_id;

  if p_faqs is null or jsonb_typeof(p_faqs) <> 'array' then
    return jsonb_build_object('ok', true, 'count', 0);
  end if;

  for r in select * from jsonb_array_elements(p_faqs)
  loop
    if coalesce(trim(r->>'question'), '') = '' or coalesce(trim(r->>'answer'), '') = '' then
      continue;
    end if;
    insert into website_bot_faqs (
      gym_id, question, answer, sort_order, is_active, updated_at
    ) values (
      v_staff.gym_id,
      trim(r->>'question'),
      trim(r->>'answer'),
      coalesce((r->>'sort_order')::int, v_i),
      coalesce((r->>'is_active')::boolean, true),
      now()
    );
    v_i := v_i + 1;
  end loop;

  return jsonb_build_object('ok', true, 'count', v_i);
end;
$$;
