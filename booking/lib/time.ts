/**
 * Wall clock to instant, in a named timezone.
 *
 * A yard types "the 14th at 6pm" and means six o'clock at the yard.
 * Reading that with `new Date('2026-09-14T18:00')` uses whatever zone
 * the browser happens to be in, so an owner booking a clinic from a
 * holiday in Spain would put it in the diary an hour out. These do the
 * conversion against the yard's own timezone instead.
 */

/** How far ahead of UTC the zone is at that instant, in milliseconds. */
function offsetMs(at: Date, timeZone: string): number {
  // Formatting an instant in the target zone and reading it back as if
  // it were UTC gives the offset, DST included, with no table to keep.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);

  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  // en-GB gives hour 24 for midnight; Date.UTC is happy to normalise it.
  const asUtc = Date.UTC(
    get('year'), get('month') - 1, get('day'),
    get('hour'), get('minute'), get('second'),
  );
  return asUtc - at.getTime();
}

/**
 * "2026-09-14" plus "18:00" in Europe/London becomes the right instant.
 *
 * The first guess treats the wall clock as if it were UTC, which is
 * wrong by exactly the zone's offset. Applying that offset and
 * measuring again settles the two hours a year when the clocks change
 * and the offset before the shift differs from the offset after it.
 */
export function zonedToInstant(date: string, time: string, timeZone: string): Date {
  const guess = new Date(`${date}T${time}:00Z`);
  const firstPass = new Date(guess.getTime() - offsetMs(guess, timeZone));
  const settled = new Date(guess.getTime() - offsetMs(firstPass, timeZone));
  return settled;
}

/** Reads an instant back as the yard sees it, for display. */
export function instantToZoned(
  iso: string,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
    ...opts,
  }).format(new Date(iso));
}

/** Today at the yard, as YYYY-MM-DD, for a date input's minimum. */
export function todayAt(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "18:00" plus 45 minutes is "18:45", staying inside the day. */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Calendar arithmetic on "2026-09-04", with no zone involved.
 *
 * Deliberately not `zonedToInstant` plus 24 hours, which is wrong twice
 * a year: the day the clocks go forward is 23 hours long.
 */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "Today", "Tomorrow", or "Sat 5 Sep". */
export function dayLabel(date: string, timeZone: string): string {
  const today = todayAt(timeZone);
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';

  // Read back as UTC, because the value is a calendar date rather than
  // an instant and formatting it in any other zone can shift the day.
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
