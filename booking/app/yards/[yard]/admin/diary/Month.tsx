'use client';

import Link from 'next/link';
import {
  WEEKDAY_INITIALS,
  dayOfMonth,
  longDate,
  monthLabel,
  monthOf,
  shiftMonth,
} from '@/lib/month';

/** What is on one day, as far as a square needs to know. */
export type DayBusy = {
  /** Titles of anything the yard has blocked out. */
  events: string[];
  /** How many rider slots are taken. */
  slots: number;
};

/**
 * The month, for orientation.
 *
 * The list underneath is where the yard acts on a booking; this is for
 * the question the list is bad at, which is what a fortnight looks like
 * before you commit a clinic to it.
 *
 * Moving between months is a link rather than client state, because
 * next month's bookings are not in the browser. Picking a day opens the
 * same form the button does, on that day.
 */
export default function Month({
  month,
  days,
  busy,
  today,
  onPick,
}: {
  /** "2026-09". */
  month: string;
  /** Every square, whole weeks, Monday first. */
  days: string[];
  busy: Map<string, DayBusy>;
  today: string;
  onPick: (date: string) => void;
}) {
  return (
    <section className="card">
      <div className="row" style={{ paddingTop: 0, borderBottom: 'none' }}>
        <div className="row-main">
          <h2 className="row-name" style={{ fontSize: 21 }}>{monthLabel(month)}</h2>
        </div>
        <div className="row-actions">
          <Link
            className="btn btn-small btn-quiet"
            href={`/admin/diary?month=${shiftMonth(month, -1)}`}
            aria-label={`${monthLabel(shiftMonth(month, -1))}`}
          >
            &larr;
          </Link>
          <Link
            className="btn btn-small btn-quiet"
            href={`/admin/diary?month=${shiftMonth(month, 1)}`}
            aria-label={`${monthLabel(shiftMonth(month, 1))}`}
          >
            &rarr;
          </Link>
        </div>
      </div>

      <div className="cal">
        {WEEKDAY_INITIALS.map((w, i) => (
          <span className="cal-head" key={i} aria-hidden="true">{w}</span>
        ))}

        {days.map((d) => {
          const here = monthOf(d) === month;
          const past = d < today;
          const on = busy.get(d);
          const count = (on?.events.length ?? 0) + (on?.slots ?? 0);

          return (
            <button
              key={d}
              type="button"
              className={[
                'cal-cell',
                here ? '' : 'is-away',
                past ? 'is-past' : '',
                d === today ? 'is-today' : '',
              ].filter(Boolean).join(' ')}
              // Blocking time out in the past helps nobody, and the form
              // will not take it either.
              disabled={past}
              aria-label={`${longDate(d)}${count ? `, ${count} on` : ', nothing on'}`}
              onClick={() => onPick(d)}
            >
              <span className="cal-num">{dayOfMonth(d)}</span>

              {/* A square is about 40px across on a phone, so it gets a
                  dot and a number there and the titles further up. */}
              {count > 0 && (
                <span className="cal-mini" aria-hidden="true">
                  {on!.events.length > 0 && <i className="cal-dot" />}
                  {on!.slots > 0 && on!.slots}
                </span>
              )}

              {count > 0 && (
                <span className="cal-full" aria-hidden="true">
                  {on!.events.slice(0, 2).map((t, i) => (
                    <span className="cal-ev" key={i}>{t}</span>
                  ))}
                  {on!.events.length > 2 && (
                    <span className="cal-more">+{on!.events.length - 2} more</span>
                  )}
                  {on!.slots > 0 && (
                    <span className="cal-slots">
                      {on!.slots} booked
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
