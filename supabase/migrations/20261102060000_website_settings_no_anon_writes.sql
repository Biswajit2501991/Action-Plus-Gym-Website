-- Public site may SELECT website_settings (and other CMS tables).
-- Writes stay on owner RPCs / service role. Newsletter INSERT is unchanged.
-- Does not touch members, payments, or portal tables.

revoke insert, update, delete on public.website_settings from anon, authenticated;
revoke insert, update, delete on public.website_sections from anon, authenticated;
revoke insert, update, delete on public.website_popup_offers from anon, authenticated;
revoke insert, update, delete on public.website_hero_slides from anon, authenticated;
revoke insert, update, delete on public.website_stats from anon, authenticated;
revoke insert, update, delete on public.website_services from anon, authenticated;
revoke insert, update, delete on public.website_pricing_plans from anon, authenticated;
revoke insert, update, delete on public.website_trainers from anon, authenticated;
revoke insert, update, delete on public.website_gallery_albums from anon, authenticated;
revoke insert, update, delete on public.website_gallery_images from anon, authenticated;
revoke insert, update, delete on public.website_videos from anon, authenticated;
revoke insert, update, delete on public.website_testimonials from anon, authenticated;
revoke insert, update, delete on public.website_opening_hours from anon, authenticated;
revoke insert, update, delete on public.website_reviews_cache from anon, authenticated;

grant select on public.website_settings to anon, authenticated;
grant select on public.website_sections to anon, authenticated;
grant select on public.website_popup_offers to anon, authenticated;
grant select on public.website_hero_slides to anon, authenticated;
grant select on public.website_stats to anon, authenticated;
grant select on public.website_services to anon, authenticated;
grant select on public.website_pricing_plans to anon, authenticated;
grant select on public.website_trainers to anon, authenticated;
grant select on public.website_gallery_albums to anon, authenticated;
grant select on public.website_gallery_images to anon, authenticated;
grant select on public.website_videos to anon, authenticated;
grant select on public.website_testimonials to anon, authenticated;
grant select on public.website_opening_hours to anon, authenticated;
grant select on public.website_reviews_cache to anon, authenticated;
