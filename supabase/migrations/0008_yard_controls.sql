-- How a rider gets on the yard. Some yards will happily take requests
-- from anyone with the link; others only want people they have invited.
create type join_policy as enum ('request', 'invite');

alter table public.business
  add column join_policy join_policy not null default 'request',
  -- Bookings are timestamptz, so the instant is never ambiguous, but a
  -- yard reads its own diary in local time and needs to say which.
  add column timezone text not null default 'Europe/London';

-- opening_hours was an empty jsonb placeholder with no agreed shape.
-- Two times cover what a yard actually needs today, and per-day
-- overrides can come later without a half-used json blob in the way.
alter table public.facility
  drop column opening_hours,
  add column opens_at  time not null default '07:00',
  add column closes_at time not null default '21:00',
  -- how close to a slot somebody can still take it
  add column min_notice_minutes int not null default 0
    check (min_notice_minutes between 0 and 10080),
  add constraint facility_open_before_close check (closes_at > opens_at);

comment on column public.facility.min_notice_minutes is
  'Minutes before a slot starts after which it can no longer be booked. 0 means right up to the start.';
comment on column public.business.timezone is
  'IANA name. Bookings store an instant; this is how the yard reads its own diary.';
