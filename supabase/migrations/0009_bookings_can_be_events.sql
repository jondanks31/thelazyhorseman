-- A clinic, a farrier day or a lesson is still a booking: it occupies a
-- facility for a stretch of time and must not clash with anything else.
-- Reusing the booking table means the no-overlap constraint protects
-- events for free, which a separate events table would not.
--
-- What differs is that an event says what it is, and is not somebody's
-- personal slot.
create type booking_kind as enum ('slot', 'event');

alter table public.booking
  add column kind  booking_kind not null default 'slot',
  add column title text;

alter table public.booking
  add constraint booking_title_shape
    check (title is null or length(btrim(title)) between 1 and 80),
  -- riders see "Jumping clinic", not an unexplained blocked-out hour
  add constraint booking_event_has_title
    check (kind = 'slot' or (title is not null and length(btrim(title)) > 0));

-- Anybody on the yard may take a slot. Only somebody running it may
-- block the arena out for an event. Verified by acting as an approved
-- rider: taking a slot is allowed, creating an event raises 42501.
drop policy booking_insert_own on public.booking;

create policy booking_insert_own on public.booking
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and private.is_member_of(business_id)
    and status = 'confirmed'
    and (kind = 'slot' or private.is_admin_of(business_id))
  );

comment on column public.booking.kind is
  'slot is one rider taking their turn. event is the yard blocking the facility out, and must carry a title.';
