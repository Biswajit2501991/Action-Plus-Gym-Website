-- Optional: unique pair for Gym Manager bulk upserts.
-- Member portal PT chat no longer depends on this (uses update/insert by id).
create unique index if not exists pt_client_profiles_gym_id_member_id_uidx
  on public.pt_client_profiles (gym_id, member_id);
