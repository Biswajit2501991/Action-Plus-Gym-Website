-- Seasonal public-site skin. Additive columns only. Existing settings rows stay.

alter table public.website_settings
  add column if not exists festival_theme text not null default '',
  add column if not exists festival_enabled boolean not null default false,
  add column if not exists festival_starts_at timestamptz,
  add column if not exists festival_ends_at timestamptz;

comment on column public.website_settings.festival_theme is
  'Seasonal public-site skin. Empty keeps the normal day/night theme. Does not change member portal.';

create or replace function public.website_admin_save_festival(
  p_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff record;
  v_enabled boolean;
  v_starts timestamptz;
  v_ends timestamptz;
begin
  select * into v_staff from website_session_staff(p_token);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Unauthorized');
  end if;
  if not website_is_owner(v_staff.staff_role) then
    return jsonb_build_object('ok', false, 'error', 'Forbidden');
  end if;

  v_enabled := coalesce((p_payload->>'enabled')::boolean, false);
  v_starts := nullif(p_payload->>'starts_at', '')::timestamptz;
  v_ends := nullif(p_payload->>'ends_at', '')::timestamptz;

  if v_enabled and (v_starts is null or v_ends is null or v_ends <= v_starts) then
    return jsonb_build_object(
      'ok', false,
      'error', 'Set a start and an end in IST. The end must be after the start.'
    );
  end if;

  update website_settings set
    festival_enabled = v_enabled,
    festival_theme = case when v_enabled then 'durga_puja' else '' end,
    festival_starts_at = v_starts,
    festival_ends_at = v_ends,
    updated_at = now()
  where gym_id = v_staff.gym_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.website_admin_save_festival(text, jsonb) to anon, authenticated;
