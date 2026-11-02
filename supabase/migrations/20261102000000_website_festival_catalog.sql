-- Festival theme catalog. Additive only. Existing Durga Puja columns stay as fallback.

alter table public.website_settings
  add column if not exists festival_catalog jsonb not null default '{}'::jsonb;

comment on column public.website_settings.festival_catalog is
  'Per-theme festival schedules (durga_puja, diwali). Empty object falls back to festival_* columns. Does not change members, payments, or the member portal.';

update public.website_settings
set festival_catalog = jsonb_build_object(
  'durga_puja', jsonb_build_object(
    'enabled', (festival_enabled is true) and (festival_theme in ('durga_puja', '')),
    'starts_at', festival_starts_at,
    'ends_at', festival_ends_at,
    'apply_website', true,
    'apply_gym_manager', false
  ),
  'diwali', jsonb_build_object(
    'enabled', false,
    'starts_at', null,
    'ends_at', null,
    'apply_website', true,
    'apply_gym_manager', false
  )
)
where coalesce(festival_catalog, '{}'::jsonb) = '{}'::jsonb;

create or replace function public.website_festival_windows_overlap(
  a_start timestamptz,
  a_end timestamptz,
  b_start timestamptz,
  b_end timestamptz
)
returns boolean
language sql
immutable
as $$
  select a_start is not null
    and a_end is not null
    and b_start is not null
    and b_end is not null
    and a_start < b_end
    and b_start < a_end;
$$;

create or replace function public.website_admin_save_festival_theme(
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
  v_theme text;
  v_enabled boolean;
  v_starts timestamptz;
  v_ends timestamptz;
  v_apply_website boolean;
  v_apply_gym boolean;
  v_catalog jsonb;
  v_other jsonb;
  v_other_key text;
  v_row record;
begin
  select * into v_staff from website_session_staff(p_token);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Unauthorized');
  end if;
  if not website_is_owner(v_staff.staff_role) then
    return jsonb_build_object('ok', false, 'error', 'Forbidden');
  end if;

  select * into v_row from website_settings where gym_id = v_staff.gym_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Settings not found.');
  end if;

  v_catalog := coalesce(v_row.festival_catalog, '{}'::jsonb);
  if v_catalog = '{}'::jsonb then
    v_catalog := jsonb_build_object(
      'durga_puja', jsonb_build_object(
        'enabled', (v_row.festival_enabled is true) and (v_row.festival_theme in ('durga_puja', '')),
        'starts_at', v_row.festival_starts_at,
        'ends_at', v_row.festival_ends_at,
        'apply_website', true,
        'apply_gym_manager', false
      ),
      'diwali', jsonb_build_object(
        'enabled', false,
        'starts_at', null,
        'ends_at', null,
        'apply_website', true,
        'apply_gym_manager', false
      )
    );
  end if;

  v_theme := coalesce(p_payload->>'theme', '');

  if v_theme = '' or v_theme = 'default' then
    v_catalog := jsonb_set(v_catalog, '{durga_puja,enabled}', 'false'::jsonb, true);
    v_catalog := jsonb_set(v_catalog, '{diwali,enabled}', 'false'::jsonb, true);
    update website_settings set
      festival_catalog = v_catalog,
      festival_enabled = false,
      festival_theme = '',
      updated_at = now()
    where gym_id = v_staff.gym_id;
    return jsonb_build_object('ok', true, 'catalog', v_catalog);
  end if;

  if v_theme not in ('durga_puja', 'diwali') then
    return jsonb_build_object('ok', false, 'error', 'Unknown theme.');
  end if;

  v_enabled := coalesce((p_payload->>'enabled')::boolean, false);
  v_starts := nullif(p_payload->>'starts_at', '')::timestamptz;
  v_ends := nullif(p_payload->>'ends_at', '')::timestamptz;
  v_apply_website := coalesce((p_payload->>'apply_website')::boolean, true);
  v_apply_gym := coalesce((p_payload->>'apply_gym_manager')::boolean, false);

  if v_enabled and (v_starts is null or v_ends is null or v_ends <= v_starts) then
    return jsonb_build_object(
      'ok', false,
      'error', 'Set a start and an end in IST. The end must be after the start.'
    );
  end if;

  if not v_apply_website and not v_apply_gym then
    return jsonb_build_object(
      'ok', false,
      'error', 'Choose where this theme applies: website, Gym Manager, or both.'
    );
  end if;

  if v_enabled then
    foreach v_other_key in array array['durga_puja', 'diwali']
    loop
      if v_other_key = v_theme then
        continue;
      end if;
      v_other := v_catalog->v_other_key;
      if coalesce((v_other->>'enabled')::boolean, false)
        and website_festival_windows_overlap(
          v_starts,
          v_ends,
          nullif(v_other->>'starts_at', '')::timestamptz,
          nullif(v_other->>'ends_at', '')::timestamptz
        )
      then
        return jsonb_build_object(
          'ok', false,
          'error', 'This schedule overlaps another festival theme. Change the dates or turn the other theme off.'
        );
      end if;
    end loop;
  end if;

  v_catalog := jsonb_set(
    v_catalog,
    array[v_theme],
    jsonb_build_object(
      'enabled', v_enabled,
      'starts_at', v_starts,
      'ends_at', v_ends,
      'apply_website', v_apply_website,
      'apply_gym_manager', v_apply_gym
    ),
    true
  );

  update website_settings set
    festival_catalog = v_catalog,
    festival_enabled = coalesce((v_catalog->'durga_puja'->>'enabled')::boolean, false)
      or coalesce((v_catalog->'diwali'->>'enabled')::boolean, false),
    festival_theme = case
      when coalesce((v_catalog->'durga_puja'->>'enabled')::boolean, false) then 'durga_puja'
      when coalesce((v_catalog->'diwali'->>'enabled')::boolean, false) then 'diwali'
      else ''
    end,
    festival_starts_at = case
      when coalesce((v_catalog->'durga_puja'->>'enabled')::boolean, false)
        then nullif(v_catalog->'durga_puja'->>'starts_at', '')::timestamptz
      when coalesce((v_catalog->'diwali'->>'enabled')::boolean, false)
        then nullif(v_catalog->'diwali'->>'starts_at', '')::timestamptz
      else festival_starts_at
    end,
    festival_ends_at = case
      when coalesce((v_catalog->'durga_puja'->>'enabled')::boolean, false)
        then nullif(v_catalog->'durga_puja'->>'ends_at', '')::timestamptz
      when coalesce((v_catalog->'diwali'->>'enabled')::boolean, false)
        then nullif(v_catalog->'diwali'->>'ends_at', '')::timestamptz
      else festival_ends_at
    end,
    updated_at = now()
  where gym_id = v_staff.gym_id;

  return jsonb_build_object('ok', true, 'catalog', v_catalog);
end;
$$;

grant execute on function public.website_admin_save_festival_theme(text, jsonb) to anon, authenticated;

create or replace function public.website_admin_save_festival(
  p_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return website_admin_save_festival_theme(
    p_token,
    jsonb_build_object(
      'theme', 'durga_puja',
      'enabled', coalesce((p_payload->>'enabled')::boolean, false),
      'starts_at', p_payload->>'starts_at',
      'ends_at', p_payload->>'ends_at',
      'apply_website', true,
      'apply_gym_manager', coalesce(
        (
          select (festival_catalog->'durga_puja'->>'apply_gym_manager')::boolean
          from website_settings
          where gym_id = (select gym_id from website_session_staff(p_token))
          limit 1
        ),
        false
      )
    )
  );
end;
$$;

grant execute on function public.website_admin_save_festival(text, jsonb) to anon, authenticated;
