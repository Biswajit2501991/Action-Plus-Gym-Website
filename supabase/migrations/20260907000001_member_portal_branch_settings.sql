-- Mirror of New App Migration migration for deploy tracking.
-- Per-branch Member Portal soft gates (additive). Missing row = fully allowed.

create table if not exists public.member_portal_branch_settings (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  gym_code_id uuid not null references public.gym_codes (id) on delete cascade,
  portal_enabled boolean not null default true,
  portal_sections jsonb null,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint member_portal_branch_settings_gym_branch_uidx unique (gym_id, gym_code_id)
);

create index if not exists member_portal_branch_settings_gym_idx
  on public.member_portal_branch_settings (gym_id);
