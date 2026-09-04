/**
 * The timezones a yard can be in.
 *
 * Deliberately a short list rather than every IANA name. There are
 * several hundred of those, which is unusable on a phone, and this is a
 * British product: the honest answer for almost every yard is the first
 * one. Labelled by country, because nobody thinks of where they keep
 * their horses as "Europe/London".
 *
 * A yard already carrying something outside this list keeps it. See
 * `timezoneOptions`.
 */
export const TIMEZONES: { value: string; label: string }[] = [
  { value: 'Europe/London', label: 'United Kingdom' },
  { value: 'Europe/Dublin', label: 'Ireland' },
  { value: 'Europe/Lisbon', label: 'Portugal' },
  { value: 'Europe/Madrid', label: 'Spain' },
  { value: 'Europe/Paris', label: 'France' },
  { value: 'Europe/Brussels', label: 'Belgium' },
  { value: 'Europe/Amsterdam', label: 'Netherlands' },
  { value: 'Europe/Berlin', label: 'Germany' },
  { value: 'Europe/Copenhagen', label: 'Denmark' },
  { value: 'Europe/Stockholm', label: 'Sweden' },
];

/**
 * The list, with whatever the yard is set to now guaranteed to be in
 * it. Without this, a zone set some other way would silently be
 * rewritten to the top of the list the first time anybody pressed Save.
 */
export function timezoneOptions(current: string): { value: string; label: string }[] {
  if (TIMEZONES.some((t) => t.value === current)) return TIMEZONES;
  return [...TIMEZONES, { value: current, label: current }];
}

/** The clock where the yard is, so a wrong choice is obvious. */
export function clockAt(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    return '';
  }
}
