/**
 * Calendar dates, as "2026-09-05" strings.
 *
 * No zones in here on purpose. A calendar square is a date on a wall,
 * not an instant, and formatting one against a timezone can shift it a
 * day. Everything below reads and writes UTC, which for a date-only
 * value means it never moves. Turning a square into a real moment is
 * `zonedToInstant` in time.ts, against the yard's own zone.
 */

import { addDays } from './time';

/** "2026-09" for the month a date falls in. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** "September 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', month: 'long', year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** The month before or after, wrapping the year. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** First and last date of the month, inclusive. */
export function monthRange(month: string): { first: string; last: string } {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  return { first: first.toISOString().slice(0, 10), last: last.toISOString().slice(0, 10) };
}

/**
 * Every square of the grid, whole weeks, Monday first. Days either side
 * of the month are included so the rows are square; `monthOf` tells
 * them apart.
 */
export function monthGrid(month: string): string[] {
  const { first, last } = monthRange(month);

  // getUTCDay is 0 for Sunday, and the week starts on Monday here.
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(first, -lead);

  const trail = 6 - ((new Date(`${last}T00:00:00Z`).getUTCDay() + 6) % 7);
  const end = addDays(last, trail);

  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** "M", "T", "W"… for the column headings. */
export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** "Mon", for a chip. */
export function weekdayShort(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' })
    .format(new Date(`${date}T00:00:00Z`));
}

/** "5", for a chip or a calendar square. */
export function dayOfMonth(date: string): string {
  return String(Number(date.slice(8, 10)));
}

/** "Saturday 5 September", for anything read aloud. */
export function longDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${date}T00:00:00Z`));
}
