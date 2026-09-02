'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { addMinutes, instantToZoned, todayAt, zonedToInstant } from '@/lib/time';

export type DiaryFacility = {
  id: string;
  name: string;
  slot_minutes: number;
  opens_at: string;
  closes_at: string;
};

export type DiaryEntry = {
  id: string;
  facility_id: string;
  starts_at: string;
  ends_at: string;
  kind: 'slot' | 'event';
  title: string | null;
  status: 'confirmed' | 'cancelled';
};

const hhmm = (t: string) => t.slice(0, 5);

export default function Diary({
  yardId,
  timezone,
  facilities,
  entries,
}: {
  yardId: string;
  timezone: string;
  facilities: DiaryFacility[];
  entries: DiaryEntry[];
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const first = facilities[0];
  const [open, setOpen] = useState(false);
  const [facilityId, setFacilityId] = useState(first?.id ?? '');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayAt(timezone));
  const [from, setFrom] = useState('18:00');
  const [to, setTo] = useState('19:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const facility = facilities.find((f) => f.id === facilityId) ?? first;
  const byId = useMemo(
    () => Object.fromEntries(facilities.map((f) => [f.id, f.name])),
    [facilities],
  );

  const outsideHours =
    !!facility && (from < hhmm(facility.opens_at) || to > hhmm(facility.closes_at));
  const valid = !!facilityId && title.trim().length > 0 && to > from;

  function startNew() {
    setTitle('');
    setDate(todayAt(timezone));
    setFrom('18:00');
    setTo(addMinutes('18:00', first?.slot_minutes ?? 60));
    setError(null);
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setError(null);

    const { error: writeError } = await supabase.from('booking').insert({
      business_id: yardId,
      facility_id: facilityId,
      // an event still belongs to whoever put it in the diary
      user_id: (await supabase.auth.getUser()).data.user?.id,
      starts_at: zonedToInstant(date, from, timezone).toISOString(),
      ends_at: zonedToInstant(date, to, timezone).toISOString(),
      kind: 'event',
      title: title.trim(),
      source: 'admin',
    });

    setBusy(false);

    if (writeError) {
      // 23P01 is the exclusion constraint. It is the expected answer to
      // double booking, not a fault, so it gets a plain sentence.
      setError(
        writeError.code === '23P01'
          ? 'Something else already has that facility then. Pick another time.'
          : writeError.message,
      );
      return;
    }

    setOpen(false);
    router.refresh();
  }

  async function cancel(entry: DiaryEntry) {
    setBusy(true);
    const { error: writeError } = await supabase
      .from('booking')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', entry.id);
    setBusy(false);
    if (writeError) setError(writeError.message);
    else router.refresh();
  }

  if (facilities.length === 0) {
    return (
      <section className="card">
        <h2 className="q" style={{ fontSize: 24 }}>Nothing to put anything in yet.</h2>
        <p className="sub">Add a facility first and the diary has somewhere to go.</p>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <div className="row" style={{ paddingTop: 0, borderBottom: 'none' }}>
          <div className="row-main">
            <h2 className="row-name" style={{ fontSize: 21 }}>Coming up</h2>
            <p className="row-meta">{entries.length} IN THE DIARY</p>
          </div>
          {!open && (
            <button className="btn btn-small" type="button" onClick={startNew}>
              Block out time
            </button>
          )}
        </div>

        {entries.length === 0 && (
          <div className="empty">
            Nothing booked yet. Clinics, farrier days and lessons go in here so
            riders cannot book over them.
          </div>
        )}

        {entries.map((e) => (
          <div className="row" key={e.id}>
            <div className="row-main">
              <span className="row-name">
                {e.title ?? 'Rider booking'}{' '}
                <span className={e.kind === 'event' ? 'pill' : 'pill off'}>
                  {e.kind === 'event' ? 'Yard' : 'Rider'}
                </span>
              </span>
              <span className="row-meta">
                {byId[e.facility_id]?.toUpperCase()} ·{' '}
                {instantToZoned(e.starts_at, timezone)} TO{' '}
                {instantToZoned(e.ends_at, timezone, {
                  weekday: undefined, day: undefined, month: undefined,
                })}
              </span>
            </div>
            <div className="row-actions">
              <button
                className="btn btn-small btn-quiet"
                type="button"
                disabled={busy}
                onClick={() => cancel(e)}
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      </section>

      {open && (
        <section className="card">
          <h2 className="q" style={{ fontSize: 26 }}>Block out some time</h2>
          <p className="sub">
            A clinic, a farrier day, anything that should stop riders booking.
            They will see the name, so it is worth writing what it is.
          </p>

          <div className="field">
            <label htmlFor="etitle">What is it</label>
            <input
              id="etitle" value={title} placeholder="Jumping clinic"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="field">
            <label id="fac-label">Which facility</label>
            <div className="choices" role="group" aria-labelledby="fac-label">
              {facilities.map((f) => (
                <button
                  key={f.id} type="button" className="choice"
                  aria-pressed={facilityId === f.id}
                  onClick={() => setFacilityId(f.id)}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="edate">Which day</label>
            <input
              id="edate" type="date" value={date} min={todayAt(timezone)}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="two-up">
            <div className="field">
              <label htmlFor="efrom">From</label>
              <input
                id="efrom" type="time" value={from}
                onChange={(e) => {
                  const v = e.target.value;
                  setFrom(v);
                  // keep the end after the start without making them redo it
                  if (v >= to) setTo(addMinutes(v, facility?.slot_minutes ?? 60));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="eto">Until</label>
              <input
                id="eto" type="time" value={to} aria-invalid={to <= from}
                onChange={(e) => setTo(e.target.value)}
              />
              {to <= from && <p className="field-error">Has to end after it starts.</p>}
            </div>
          </div>

          {outsideHours && facility && (
            <p className="field-hint">
              That runs outside {facility.name}&rsquo;s usual {hhmm(facility.opens_at)} to{' '}
              {hhmm(facility.closes_at)}. Fine for the yard to do, riders just cannot book then.
            </p>
          )}

          {error && <p className="field-error" role="alert">{error}</p>}

          <div className="actions">
            <button className="btn btn-quiet" type="button" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn" type="button" onClick={save} disabled={!valid || busy}>
              {busy ? 'Saving…' : 'Put it in the diary'}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
