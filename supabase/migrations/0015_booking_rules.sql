-- Rider booking rules, enforced where they cannot be walked past.
--
-- The rider view writes straight from the browser to PostgREST, exactly
-- as the admin screens do, so a grid that only offers legal slots is
-- decoration: anyone can post whatever start and end they please. The
-- facility already carries the rules. This is where they bite.
--
-- Events are exempt on purpose. The yard blocks out a farrier day
-- whenever it likes, and the diary already tells it so.

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

-- Every message above is written to be shown to a rider as it stands,
-- because PT422 arrives at the browser as an ordinary 422 and the
-- alternative is inventing a second set of sentences in TypeScript.
comment on function private.enforce_booking_rules() is
  'Rider slot rules: facility on, one slot long, inside hours, on the grid, past the notice window, inside the horizon. PT422 messages are rider facing.';

revoke all on function private.enforce_booking_rules() from public, anon, authenticated;

drop trigger if exists booking_follows_rules on public.booking;
create trigger booking_follows_rules
  before insert or update on public.booking
  for each row execute function private.enforce_booking_rules();
