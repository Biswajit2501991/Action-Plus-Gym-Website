-- Member Portal: saved goal choice and assigned workout variant.
-- Additive. Does not alter member_workout_program_progress or payments.

create table if not exists public.member_workout_goal_plan (
  gym_id uuid not null,
  member_uuid uuid not null,
  level text not null,
  goals jsonb not null default '[]'::jsonb,
  variant_id text,
  skipped boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (gym_id, member_uuid)
);

create index if not exists member_workout_goal_plan_variant_idx
  on public.member_workout_goal_plan (gym_id, level, variant_id);

alter table public.member_workout_goal_plan enable row level security;

comment on table public.member_workout_goal_plan is
  'Member Portal workout goals and the assigned variant. Progress ticks stay on member_workout_program_progress.';
