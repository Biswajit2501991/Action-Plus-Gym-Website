-- Billing push: IST trigger hour + overdue message fields.
-- Applied remotely via Supabase MCP (member_portal_billing_push_triggers).

alter table public.member_portal_settings
  add column if not exists billing_push_hour_ist integer not null default 8,
  add column if not exists billing_push_overdue_title text not null default 'Late payment notice',
  add column if not exists billing_push_overdue_body text not null default 'A fine has been added to your plan. Please clear within 1 week to avoid deactivation or membership cancellation, or reach out to the gym if there is any issue.';

alter table public.member_portal_settings
  drop constraint if exists member_portal_settings_billing_push_hour_ist_check;

alter table public.member_portal_settings
  add constraint member_portal_settings_billing_push_hour_ist_check
  check (billing_push_hour_ist >= 0 and billing_push_hour_ist <= 23);
