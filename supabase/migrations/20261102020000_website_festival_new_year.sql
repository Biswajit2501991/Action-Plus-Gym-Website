-- Add New Year 2027 to the festival catalog. Additive JSON key only. No drops.

update public.website_settings
set festival_catalog = jsonb_set(
  coalesce(festival_catalog, '{}'::jsonb),
  '{new_year_2027}',
  '{"enabled":false,"starts_at":null,"ends_at":null,"apply_website":true,"apply_gym_manager":false}'::jsonb,
  true
)
where coalesce(festival_catalog->'new_year_2027', 'null'::jsonb) = 'null'::jsonb;

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
  if v_catalog->'new_year_2027' is null then
    v_catalog := jsonb_set(
      v_catalog,
      '{new_year_2027}',
      '{"enabled":false,"starts_at":null,"ends_at":null,"apply_website":true,"apply_gym_manager":false}'::jsonb,
      true
    );
  end if;

  v_theme := coalesce(p_payload->>'theme', '');

  if v_theme = '' or v_theme = 'default' then
    v_catalog := jsonb_set(v_catalog, '{durga_puja,enabled}', 'false'::jsonb, true);
    v_catalog := jsonb_set(v_catalog, '{diwali,enabled}', 'false'::jsonb, true);
    v_catalog := jsonb_set(v_catalog, '{chhath_puja,enabled}', 'false'::jsonb, true);
    v_catalog := jsonb_set(v_catalog, '{new_year_2027,enabled}', 'false'::jsonb, true);
    update website_settings set
      festival_catalog = v_catalog,
      festival_enabled = false,
      festival_theme = '',
      updated_at = now()
    where gym_id = v_staff.gym_id;
    return jsonb_build_object('ok', true, 'catalog', v_catalog);
  end if;

  if v_theme not in ('durga_puja', 'diwali', 'chhath_puja', 'new_year_2027') then
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
    foreach v_other_key in array array['durga_puja', 'diwali', 'chhath_puja', 'new_year_2027']
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
      or coalesce((v_catalog->'diwali'->>'enabled')::boolean, false)
      or coalesce((v_catalog->'chhath_puja'->>'enabled')::boolean, false)
      or coalesce((v_catalog->'new_year_2027'->>'enabled')::boolean, false),
    festival_theme = case
      when coalesce((v_catalog->'durga_puja'->>'enabled')::boolean, false) then 'durga_puja'
      when coalesce((v_catalog->'diwali'->>'enabled')::boolean, false) then 'diwali'
      when coalesce((v_catalog->'chhath_puja'->>'enabled')::boolean, false) then 'chhath_puja'
      when coalesce((v_catalog->'new_year_2027'->>'enabled')::boolean, false) then 'new_year_2027'
      else ''
    end,
    festival_starts_at = case
      when coalesce((v_catalog->'durga_puja'->>'enabled')::boolean, false)
        then nullif(v_catalog->'durga_puja'->>'starts_at', '')::timestamptz
      when coalesce((v_catalog->'diwali'->>'enabled')::boolean, false)
        then nullif(v_catalog->'diwali'->>'starts_at', '')::timestamptz
      when coalesce((v_catalog->'chhath_puja'->>'enabled')::boolean, false)
        then nullif(v_catalog->'chhath_puja'->>'starts_at', '')::timestamptz
      when coalesce((v_catalog->'new_year_2027'->>'enabled')::boolean, false)
        then nullif(v_catalog->'new_year_2027'->>'starts_at', '')::timestamptz
      else festival_starts_at
    end,
    festival_ends_at = case
      when coalesce((v_catalog->'durga_puja'->>'enabled')::boolean, false)
        then nullif(v_catalog->'durga_puja'->>'ends_at', '')::timestamptz
      when coalesce((v_catalog->'diwali'->>'enabled')::boolean, false)
        then nullif(v_catalog->'diwali'->>'ends_at', '')::timestamptz
      when coalesce((v_catalog->'chhath_puja'->>'enabled')::boolean, false)
        then nullif(v_catalog->'chhath_puja'->>'ends_at', '')::timestamptz
      when coalesce((v_catalog->'new_year_2027'->>'enabled')::boolean, false)
        then nullif(v_catalog->'new_year_2027'->>'ends_at', '')::timestamptz
      else festival_ends_at
    end,
    updated_at = now()
  where gym_id = v_staff.gym_id;

  return jsonb_build_object('ok', true, 'catalog', v_catalog);
end;
$$;
