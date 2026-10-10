-- Optional public-site line for returning visitors. Blank keeps the built-in wording.

alter table public.website_settings
  add column if not exists returning_bar_text text not null default '';

comment on column public.website_settings.returning_bar_text is
  'Header line for visitors who closed the welcome popup. Empty uses the default Welcome back line.';

create or replace function public.website_admin_save_settings(
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
begin
  select * into v_staff from website_session_staff(p_token);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Unauthorized');
  end if;
  if not website_is_owner(v_staff.staff_role) then
    return jsonb_build_object('ok', false, 'error', 'Forbidden');
  end if;

  insert into website_settings as s (gym_id)
  values (v_staff.gym_id)
  on conflict (gym_id) do nothing;

  update website_settings set
    site_name = coalesce(p_payload->>'site_name', site_name),
    tagline = coalesce(p_payload->>'tagline', tagline),
    phone = coalesce(p_payload->>'phone', phone),
    email = coalesce(p_payload->>'email', email),
    whatsapp = coalesce(p_payload->>'whatsapp', whatsapp),
    address = coalesce(p_payload->>'address', address),
    map_embed_url = coalesce(p_payload->>'map_embed_url', map_embed_url),
    google_reviews_url = coalesce(p_payload->>'google_reviews_url', google_reviews_url),
    timezone = coalesce(p_payload->>'timezone', timezone),
    socials = coalesce(p_payload->'socials', socials),
    seo_title = coalesce(p_payload->>'seo_title', seo_title),
    seo_description = coalesce(p_payload->>'seo_description', seo_description),
    seo_og_image = coalesce(p_payload->>'seo_og_image', seo_og_image),
    hero_headline = coalesce(p_payload->>'hero_headline', hero_headline),
    hero_subheadline = coalesce(p_payload->>'hero_subheadline', hero_subheadline),
    returning_bar_text = coalesce(p_payload->>'returning_bar_text', returning_bar_text),
    updated_at = now()
  where gym_id = v_staff.gym_id;

  return jsonb_build_object('ok', true);
end;
$$;
