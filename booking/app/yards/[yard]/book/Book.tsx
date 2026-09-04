'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { bookableDays, buildDay, type Held, type Slot, type SlotFacility } from '@/lib/slots';
import { dayLabel, instantToZoned } from '@/lib/time';
import { kindLabel } from '@/lib/kinds';
import Modal from '@/components/Modal';

const hhmm = (t: string) => t.slice(0, 5);

const WORD: Record<Slot['state'], string> = {
  free: '',
  yours: 'Yours',
  taken: 'Taken',
  event: '',
  gone: 'Gone',
};

export type MyHorse = { id: string; name: string };

export default function Book({
  yardId,
  userId,
  timezone,
  facilities,
  held,
  myHorses,
  myName,
  now,
}: {
  yardId: string;
  userId: string;
  timezone: string;
  facilities: SlotFacility[];
  /** Everything already standing in the way, across the whole horizon. */
  held: Held[];
  /** The rider's own horses, retired ones left out. */
  myHorses: MyHorse[];
  /** Their own name, blank if they never set one. */
  myName: string;
  /** The server's clock, so what renders matches what was sent. */
  now: string;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? '');
  const [wanted, setWanted] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** The slot being checked over, and which horse it is for. */
  const [pending, setPending] = useState<Slot | null>(null);
  const [horseId, setHorseId] = useState(myHorses[0]?.id ?? '');

  const facility = facilities.find((f) => f.id === facilityId) ?? facilities[0];

  const days = useMemo(
    () => (facility ? bookableDays(facility, timezone) : []),
    [facility, timezone],
  );
  // Facilities can look different distances ahead, so the day chosen on
  // one may not exist on the next. Fall back rather than showing nothing.
  const day = wanted && days.includes(wanted) ? wanted : days[0];

  const slots = useMemo(
    () => (facility ? buildDay(facility, day, timezone, held, new Date(now)) : []),
    [facility, day, timezone, held, now],
  );

  /**
   * Tells the day strip which of its ends still has days behind it, so
   * only those ends fade. Written straight to the element rather than
   * held in state: it is a scroll position being mirrored onto the DOM,
   * which is what an effect is actually for, and re-rendering the whole
   * grid on every scroll frame would be daft.
   */
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;

    const mark = () => {
      const room = el.scrollWidth - el.clientWidth;
      const ends: string[] = [];
      // A pixel of slack, because scrollLeft is fractional under zoom.
      if (el.scrollLeft > 1) ends.push('start');
      if (el.scrollLeft < room - 1) ends.push('end');
      el.dataset.more = ends.join(' ');
    };

    mark();
    el.addEventListener('scroll', mark, { passive: true });
    // The row is inside a card that reflows, so width changes too.
    const watch = new ResizeObserver(mark);
    watch.observe(el);
    return () => {
      el.removeEventListener('scroll', mark);
      watch.disconnect();
    };
  }, [days]);

  const mine = useMemo(
    () => held.filter((h) => h.mine && h.kind === 'slot'),
    [held],
  );

  const named = useMemo(
    () => Object.fromEntries(facilities.map((f) => [f.id, f.name])),
    [facilities],
  );

  function report(writeError: { code?: string; message: string }) {
    // 23P01 is the exclusion constraint and means somebody got there
    // first. PT422 is the rules trigger, whose messages are already
    // written for riders, so repeating them here would only let the two
    // drift apart.
    setError(
      writeError.code === '23P01'
        ? 'Somebody just took that one.'
        : writeError.message,
    );
  }

  /** Opens the check, rather than booking on the first tap. */
  function ask(slot: Slot) {
    setError(null);
    setHorseId((was) => (myHorses.some((h) => h.id === was) ? was : myHorses[0]?.id ?? ''));
    setPending(slot);
  }

  async function take() {
    if (!facility || !pending) return;
    setBusy(pending.at);
    setError(null);

    const { error: writeError } = await supabase.from('booking').insert({
      business_id: yardId,
      facility_id: facility.id,
      user_id: userId,
      starts_at: pending.startsAt,
      ends_at: pending.endsAt,
      // Null rather than an empty string when they have no horse on
      // their account yet, which the column allows.
      horse_id: horseId || null,
    });

    setBusy(null);
    if (writeError) return report(writeError);
    setPending(null);
    router.refresh();
  }

  async function give(id: string) {
    setBusy(id);
    setError(null);

    const { error: writeError } = await supabase
      .from('booking')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id);

    setBusy(null);
    if (writeError) return report(writeError);
    router.refresh();
  }

  if (!facility) {
    return (
      <section className="card">
        <div className="empty">Nothing to book here yet.</div>
      </section>
    );
  }

  return (
    <>
      {mine.length > 0 && (
        <section className="card">
          <h2 className="q" style={{ fontSize: 24 }}>Your bookings</h2>
          {mine.map((h) => (
            <div className="row" key={h.id}>
              <div className="row-main">
                <span className="row-name">
                  {instantToZoned(h.starts_at, timezone)}{' '}
                  {h.horse && <span className="row-horse">{h.horse}</span>}
                </span>
                <span className="row-meta">{named[h.facility_id]?.toUpperCase()}</span>
              </div>
              <div className="row-actions">
                <button
                  className="btn btn-small btn-quiet"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => give(h.id)}
                >
                  {busy === h.id ? 'Cancelling…' : 'Cancel'}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        {facilities.length > 1 && (
          <div className="field">
            <label className="sr" id="pick-facility">Which one</label>
            <div className="choices" role="group" aria-labelledby="pick-facility">
              {facilities.map((f) => (
                <button
                  key={f.id} type="button" className="choice"
                  aria-pressed={f.id === facility.id}
                  onClick={() => { setFacilityId(f.id); setError(null); }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="row" style={{ paddingTop: 0, borderBottom: 'none' }}>
          <div className="row-main">
            <span className="row-name">{facility.name}</span>
            <span className="row-meta">
              {kindLabel(facility.kind).toUpperCase()} ·{' '}
              {hhmm(facility.opens_at)} TO {hhmm(facility.closes_at)}
            </span>
          </div>
        </div>

        <div className="days" role="group" aria-label="Which day" ref={strip}>
          {days.map((d) => (
            <button
              key={d} type="button" className="day"
              aria-pressed={d === day}
              onClick={() => { setWanted(d); setError(null); }}
            >
              {dayLabel(d, timezone)}
            </button>
          ))}
        </div>

        {/* A day whose slots have all been and gone. The strip above is
            the way out, so this says what happened and nothing else. */}
        {slots.length === 0 && (
          <div className="empty">
            {/* Any other day is only ever empty because the facility's
                hours are shorter than one slot, which is not the rider's
                doing, so it does not claim the day is full. */}
            {day === days[0] ? 'Nothing left today.' : 'Nothing to book that day.'}
          </div>
        )}

        <div className="slots">
          {slots.map((s) => {
            const open = s.state === 'free';
            const yours = s.state === 'yours';
            // Somebody running the yard gets the name; a rider gets
            // "Taken", because the grid never carries who to them.
            const word =
              s.state === 'event' ? s.title
                : s.state === 'taken' ? s.who ?? WORD.taken
                : WORD[s.state];

            return (
              <button
                key={s.at}
                type="button"
                className={`slot is-${s.state}`}
                disabled={(!open && !yours) || busy !== null}
                onClick={() => (yours ? give(s.bookingId!) : ask(s))}
                // The horse only ever appears here: there is no room for
                // it on a chip this size.
                title={[word, s.horse].filter(Boolean).join(' · ') || undefined}
                // The time alone is what a sighted rider needs, because
                // the state is in the colour. Read aloud it is not.
                aria-label={
                  open ? `Take ${s.at}`
                    : yours ? `Cancel your ${s.at}`
                    : `${s.at}, ${word ?? WORD[s.state].toLowerCase()}`
                }
              >
                <span className="slot-at">{s.at}</span>
                {word && <span className="slot-word">{word}</span>}
              </button>
            );
          })}
        </div>

        {/* Errors from the check sit in the modal with the button that
            caused them, so out here is only ever a failed cancel. */}
        {!pending && error && <p className="field-error" role="alert">{error}</p>}
      </section>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        busy={busy !== null}
        error={error}
        title="Check this over"
        footer={
          <div className="actions">
            <button
              className="btn btn-quiet" type="button"
              onClick={() => setPending(null)} disabled={busy !== null}
            >
              Back
            </button>
            <button className="btn" type="button" onClick={take} disabled={busy !== null}>
              {busy !== null ? 'Booking…' : 'Book it'}
            </button>
          </div>
        }
      >
        <dl className="summary">
          <div>
            <dt>When</dt>
            <dd>
              {pending &&
                instantToZoned(pending.startsAt, timezone, { weekday: 'long' })}
              {' to '}
              {pending &&
                instantToZoned(pending.endsAt, timezone, {
                  weekday: undefined, day: undefined, month: undefined,
                })}
            </dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>{facility.name}</dd>
          </div>
          <div>
            <dt>Rider</dt>
            <dd>{myName || 'You'}</dd>
          </div>
        </dl>

        {/* One horse needs no choosing; several do. None at all is not an
            obstacle to booking, just a nudge, because a rider without a
            horse on their account can still want the arena. */}
        {myHorses.length === 1 && (
          <dl className="summary">
            <div>
              <dt>Horse</dt>
              <dd>{myHorses[0].name}</dd>
            </div>
          </dl>
        )}

        {myHorses.length > 1 && (
          <div className="field">
            <label htmlFor="which-horse">Which horse</label>
            <select
              id="which-horse" value={horseId}
              onChange={(e) => setHorseId(e.target.value)}
            >
              {myHorses.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        )}

        {myHorses.length === 0 && (
          <p className="field-hint">
            You have no horse on your account. Add one under your details
            and the yard will see it against your bookings.
          </p>
        )}
      </Modal>
    </>
  );
}
