-- A rider can have more than one horse.
--
-- profile.horse_name was a single text field, which is wrong for anyone
-- with two, and it recorded nothing about which horse a booking was
-- actually for. The yard wants to know that: "Sarah, Bramble" and
-- "Sarah, Domino" are different bookings to whoever is running the day.

create table public.horse (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 60),
  -- Sold, moved on, or no longer ridden. Retired rather than deleted, so
  -- the bookings it appears in keep saying who was in the arena. Same
  -- reasoning as facilities being switched off rather than removed.
  retired_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger horse_set_updated_at
  before update on public.horse
  for each row execute function public.set_updated_at();

-- One name at a time. A retired Bramble does not stop a new Bramble.
create unique index horse_one_live_name_per_person
  on public.horse (user_id, lower(btrim(name)))
  where retired_at is null;

create index horse_user_idx on public.horse (user_id) where retired_at is null;

-- ── which horse a booking is for ───────────────────────────────
-- Nullable: an event has no horse, and bookings taken before this did
-- not record one. Set null on delete so a booking outlives a mistake.
alter table public.booking
  add column horse_id uuid references public.horse(id) on delete set null;

comment on column public.booking.horse_id is
  'Which of the rider''s horses the slot is for. Null for events and for bookings taken before horses existed.';

-- ── the horses people already had ──────────────────────────────
insert into public.horse (user_id, name)
select user_id, btrim(horse_name)
from public.profile
where horse_name is not null and btrim(horse_name) <> '';

alter table public.profile drop column horse_name;

-- Signup carries one horse at most, which is the common case. The rest
-- are added on the rider's own details screen.
create or replace function private.copy_signup_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_horse text := nullif(btrim(left(new.raw_user_meta_data ->> 'horse_name', 60)), '');
begin
  insert into public.profile (user_id, name)
  values (new.id, nullif(btrim(left(new.raw_user_meta_data ->> 'name', 60)), ''))
  on conflict (user_id) do nothing;

  if v_horse is not null then
    insert into public.horse (user_id, name) values (new.id, v_horse);
  end if;

  return new;
end;
$$;

-- ── who may read them ──────────────────────────────────────────
alter table public.horse enable row level security;

create policy horse_select_own on public.horse
  for select to authenticated
  using (user_id = auth.uid());

create policy horse_insert_own on public.horse
  for insert to authenticated
  with check (user_id = auth.uid());

create policy horse_update_own on public.horse
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No delete policy. Retiring keeps the horse's name on its bookings.

-- Row level security cannot say which columns an update touches, so the
-- grant does: without this a rider could move a horse onto somebody
-- else's account. Same lesson as migrations 0012 and 0016.
revoke update on public.horse from authenticated;
grant update (name, retired_at) on public.horse to authenticated;

-- ── the yard's view of them ────────────────────────────────────
-- One function serves both screens: the riders list groups these by
-- person, and the diary and slot grid look up a booking's horse by id.
create function public.yard_horses(p_business_id uuid)
returns table (
  horse_id   uuid,
  owner_id   uuid,
  horse      text,
  retired    boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin_of(p_business_id) then
    raise exception 'not yours' using errcode = '42501';
  end if;

  -- Only the horses of people on this yard. Output columns are named
  -- apart from the real ones so they cannot shadow them.
  return query
    select h.id, h.user_id, h.name, (h.retired_at is not null)
    from public.horse h
    join public.membership m on m.user_id = h.user_id
    where m.business_id = p_business_id
    order by h.name;
end;
$$;

revoke all on function public.yard_horses(uuid) from public;
grant execute on function public.yard_horses(uuid) to authenticated;

-- yard_riders no longer carries a horse, because there can be several.
drop function if exists public.yard_riders(uuid);

create function public.yard_riders(p_business_id uuid)
returns table (
  membership_id uuid,
  member_id     uuid,
  email         text,
  rider_name    text,
  role          public.membership_role,
  status        public.membership_status,
  joined_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin_of(p_business_id) then
    raise exception 'not yours' using errcode = '42501';
  end if;

  return query
    select m.id, m.user_id, u.email::text, p.name,
           m.role, m.status, m.created_at
    from public.membership m
    join auth.users u on u.id = m.user_id
    left join public.profile p on p.user_id = m.user_id
    where m.business_id = p_business_id
    order by m.created_at;
end;
$$;

revoke all on function public.yard_riders(uuid) from public;
grant execute on function public.yard_riders(uuid) to authenticated;

-- ── you can only book with your own horse ──────────────────────
-- The rider view writes straight from the browser, so the dropdown
-- offering only your own horses is a courtesy. This is the guard.
-- Folded into the existing rules trigger rather than added alongside it,
-- so there is one place that decides whether a booking is allowed.
create or replace function private.enforce_booking_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_facility public.facility%rowtype;
  v_tz    text;
  v_start timestamp;  -- wall clock at the yard, not the browser's
  v_end   timestamp;
  v_open  int;        -- minutes past midnight
  v_close int;
  v_from  int;
  v_to    int;
begin
  -- Checked on every write, cancellations included, because an edit must
  -- never be able to move a booking onto somebody else's horse.
  if new.horse_id is not null and not exists (
    select 1 from public.horse h
    where h.id = new.horse_id and h.user_id = new.user_id
  ) then
    raise exception 'That is not one of your horses.'
      using errcode = 'PT422', detail = 'horse not yours';
  end if;

  -- An edit that leaves the booking where it is makes no fresh claim on
  -- the facility, so the rules below do not apply to it. One thing does:
  -- a slot that has already begun cannot be cancelled by the rider who
  -- took it. Bookings are cancelled rather than deleted so the no-show
  -- survives, and cancelling after the fact would erase it anyway. The
  -- yard can still cancel anything, for the rider who rings up.
  if tg_op = 'UPDATE'
     and new.starts_at   = old.starts_at
     and new.ends_at     = old.ends_at
     and new.facility_id = old.facility_id
  then
    if old.status = 'confirmed'
       and new.status = 'cancelled'
       and old.starts_at <= now()
       and not private.is_admin_of(new.business_id)
    then
      raise exception 'That one has already started. Speak to the yard.'
        using errcode = 'PT422', detail = 'cancel after start';
    end if;
    return new;
  end if;

  if new.kind = 'event' then
    return new;
  end if;

  select * into v_facility from public.facility where id = new.facility_id;
  if not found then
    raise exception 'no such facility' using errcode = '23503';
  end if;

  if not v_facility.is_active then
    raise exception 'That one is not taking bookings.'
      using errcode = 'PT422', detail = 'facility off';
  end if;

  select b.timezone into v_tz from public.business b where b.id = new.business_id;

  v_start := new.starts_at at time zone v_tz;
  v_end   := new.ends_at   at time zone v_tz;

  -- One slot, no more and no less. Measured as elapsed time rather than
  -- wall clock, so an hour is an hour. The one consequence is that a
  -- slot straddling a clock change is refused; UK transitions happen at
  -- 01:00 and 02:00, so only a yard open through the night would ever
  -- meet it.
  if new.ends_at - new.starts_at <> make_interval(mins => v_facility.slot_minutes) then
    raise exception 'Slots on % are % minutes.', v_facility.name, v_facility.slot_minutes
      using errcode = 'PT422', detail = 'wrong length';
  end if;

  v_open  := extract(hour from v_facility.opens_at)::int  * 60 + extract(minute from v_facility.opens_at)::int;
  v_close := extract(hour from v_facility.closes_at)::int * 60 + extract(minute from v_facility.closes_at)::int;
  v_from  := extract(hour from v_start)::int * 60 + extract(minute from v_start)::int;
  v_to    := extract(hour from v_end)::int   * 60 + extract(minute from v_end)::int;

  -- closes_at > opens_at is a table constraint, so a slot inside the
  -- hours never runs past midnight and both ends land on one day.
  if v_start::date <> v_end::date or v_from < v_open or v_to > v_close then
    raise exception '% is open % to %.',
      v_facility.name,
      to_char(v_facility.opens_at,  'HH24:MI'),
      to_char(v_facility.closes_at, 'HH24:MI')
      using errcode = 'PT422', detail = 'outside hours';
  end if;

  -- Slots run in a line from opening time. Anything landing between two
  -- of them would leave a stub nobody can book.
  if (v_from - v_open) % v_facility.slot_minutes <> 0 then
    raise exception 'That is not one of the slots.'
      using errcode = 'PT422', detail = 'off the grid';
  end if;

  if new.starts_at < now() + make_interval(mins => v_facility.min_notice_minutes) then
    if v_facility.min_notice_minutes = 0 then
      raise exception 'That one has gone by.'
        using errcode = 'PT422', detail = 'in the past';
    else
      raise exception '% wants % minutes notice.', v_facility.name, v_facility.min_notice_minutes
        using errcode = 'PT422', detail = 'inside notice';
    end if;
  end if;

  if v_start::date > (now() at time zone v_tz)::date + v_facility.max_days_ahead then
    raise exception 'You can book % days ahead, no further.', v_facility.max_days_ahead
      using errcode = 'PT422', detail = 'past the horizon';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_booking_rules() from public, anon, authenticated;
