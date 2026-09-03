/**
 * A facility's day, turned into the slots a rider actually sees.
 *
 * The same rules live in migration 0015 as a trigger, and that is the
 * one that counts: the rider view writes straight from the browser, so
 * a grid that only offers legal slots is a courtesy, not a guard. This
 * exists so nobody is invited to tap something the database will refuse.
 */

import { addDays, todayAt, zonedToInstant } from './time';

export type SlotFacility = {
  id: string;
  name: string;
  kind: string;
  slot_minutes: number;
  opens_at: string;
  closes_at: string;
  min_notice_minutes: number;
  max_days_ahead: number;
};

/** A confirmed booking standing in the way, whoever it belongs to. */
export type Held = {
  id: string;
  facility_id: string;
  starts_at: string;
  ends_at: string;
  kind: 'slot' | 'event';
  title: string | null;
  mine: boolean;
  /**
   * Who has it, and only ever set for somebody who runs the yard. A
   * rider sees that a slot is taken, not by whom.
   */
  who: string | null;
};

export type SlotState =
  | 'free'   // yours for the taking
  | 'yours'  // you already have it
  | 'taken'  // somebody else has it
  | 'event'  // the yard has blocked it out
  | 'gone';  // past, or inside the notice window

export type Slot = {
  /** "18:30", as the yard reads it. */
  at: string;
  startsAt: string;
  endsAt: string;
  state: SlotState;
  /** The event's name, when the yard has blocked the time out. */
  title: string | null;
  /** Your booking's id, so you can give it up again. */
  bookingId: string | null;
  /** Who has it. Only ever filled in for somebody running the yard. */
  who: string | null;
};

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toClock = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Every day this facility is open to bookings, starting today. */
export function bookableDays(facility: SlotFacility, timeZone: string): string[] {
  const first = todayAt(timeZone);
  return Array.from({ length: facility.max_days_ahead + 1 }, (_, i) => addDays(first, i));
}

/**
 * Slots run in a line from opening time, which is why a facility's hours
 * and slot length are the only settings needed to draw a day. The last
 * one is whichever still finishes by closing.
 */
export function buildDay(
  facility: SlotFacility,
  date: string,
  timeZone: string,
  held: Held[],
  now: Date,
): Slot[] {
  const open = toMinutes(facility.opens_at);
  const close = toMinutes(facility.closes_at);
  const step = facility.slot_minutes;
  const notice = facility.min_notice_minutes * 60_000;

  const here = held.filter((h) => h.facility_id === facility.id);
  const slots: Slot[] = [];

  for (let m = open; m + step <= close; m += step) {
    const at = toClock(m);
    const startsAt = zonedToInstant(date, at, timeZone);
    // Elapsed minutes, not wall clock, matching what the trigger checks.
    const endsAt = new Date(startsAt.getTime() + step * 60_000);

    const clash = here.find(
      (h) => startsAt < new Date(h.ends_at) && endsAt > new Date(h.starts_at),
    );

    const state: SlotState = clash
      ? clash.kind === 'event' ? 'event' : clash.mine ? 'yours' : 'taken'
      : startsAt.getTime() - notice < now.getTime() ? 'gone' : 'free';

    slots.push({
      at,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      state,
      title: clash?.kind === 'event' ? clash.title : null,
      bookingId: state === 'yours' ? clash!.id : null,
      who: state === 'taken' ? clash!.who : null,
    });
  }

  return slots;
}
