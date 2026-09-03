'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { bookableDays, buildDay, type Held, type Slot, type SlotFacility } from '@/lib/slots';
import { dayLabel, instantToZoned } from '@/lib/time';
import { kindLabel } from '@/lib/kinds';

const hhmm = (t: string) => t.slice(0, 5);

const WORD: Record<Slot['state'], string> = {
  free: '',
  yours: 'Yours',
  taken: 'Taken',
  event: '',
  gone: 'Gone',
};

export default function Book({
  yardId,
  userId,
  timezone,
  facilities,
  held,
  now,
}: {
  yardId: string;
  userId: string;
  timezone: string;
  facilities: SlotFacility[];
  /** Everything already standing in the way, across the whole horizon. */
  held: Held[];
  /** The server's clock, so what renders matches what was sent. */
  now: string;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? '');
  const [wanted, setWanted] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function take(slot: Slot) {
    if (!facility) return;
    setBusy(slot.at);
    setError(null);

    const { error: writeError } = await supabase.from('booking').insert({
      business_id: yardId,
      facility_id: facility.id,
      user_id: userId,
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
    });

    setBusy(null);
    if (writeError) return report(writeError);
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
                <span className="row-name">{instantToZoned(h.starts_at, timezone)}</span>
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

        <div className="days" role="group" aria-label="Which day">
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

        <div className="slots">
          {slots.map((s) => {
            const open = s.state === 'free';
            const yours = s.state === 'yours';
            const word = s.state === 'event' ? s.title : WORD[s.state];

            return (
              <button
                key={s.at}
                type="button"
                className={`slot is-${s.state}`}
                disabled={(!open && !yours) || busy !== null}
                onClick={() => (yours ? give(s.bookingId!) : take(s))}
                title={s.state === 'event' ? s.title ?? undefined : undefined}
                // The time alone is what a sighted rider needs, because
                // the state is in the colour. Read aloud it is not.
                aria-label={
                  open ? `Take ${s.at}`
                    : yours ? `Cancel your ${s.at}`
                    : `${s.at}, ${s.state === 'event' ? s.title : WORD[s.state].toLowerCase()}`
                }
              >
                <span className="slot-at">{s.at}</span>
                {word && <span className="slot-word">{word}</span>}
              </button>
            );
          })}
        </div>

        {error && <p className="field-error" role="alert">{error}</p>}
      </section>
    </>
  );
}
