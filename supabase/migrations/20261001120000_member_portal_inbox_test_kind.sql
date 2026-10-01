-- Allow the Bis Test broadcast to appear in the Member Portal bell.
-- Gym-wide sends still use owner_broadcast. The 5-minute wait stays on the push log.

alter table public.member_portal_notification_inbox
  drop constraint if exists member_portal_notification_inbox_kind_chk;

alter table public.member_portal_notification_inbox
  add constraint member_portal_notification_inbox_kind_chk
  check (kind in ('owner_broadcast', 'owner_broadcast_test'));
