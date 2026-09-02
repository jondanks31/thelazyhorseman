'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { FACILITY_KINDS, SLOT_MINUTES, kindLabel, prettyMinutes } from '@/lib/kinds';
import Modal from '@/components/Modal';

export type Facility = {
  id: string;
  name: string;
  kind: string;
  slot_minutes: number;
  max_days_ahead: number;
  min_notice_minutes: number;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
};

type Draft = Omit<Facility, 'id'>;

const BLANK: Draft = {
  name: '',
  kind: 'arena',
  slot_minutes: 60,
  max_days_ahead: 14,
  min_notice_minutes: 0,
  opens_at: '07:00',
  closes_at: '21:00',
  is_active: true,
};

/** "07:00:00" from Postgres, "07:00" from an input. Both need trimming. */
const hhmm = (t: string) => t.slice(0, 5);

export default function Facilities({
  yardId,
  initial,
}: {
  yardId: string;
  initial: Facility[];
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    setDraft(BLANK);
    setEditing('new');
    setError(null);
  }

  function startEdit(f: Facility) {
    setDraft({ ...f, opens_at: hhmm(f.opens_at), closes_at: hhmm(f.closes_at) });
    setEditing(f.id);
    setError(null);
  }

  const valid =
    draft.name.trim().length > 0 && draft.closes_at > draft.opens_at;

  async function save() {
    setBusy(true);
    setError(null);

    const payload = { ...draft, name: draft.name.trim(), business_id: yardId };
    const { error: writeError } =
      editing === 'new'
        ? await supabase.from('facility').insert(payload)
        : await supabase.from('facility').update(payload).eq('id', editing!);

    setBusy(false);
    if (writeError) {
      setError(writeError.message);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function toggleActive(f: Facility) {
    setBusy(true);
    // Deactivating rather than deleting, so the bookings already taken
    // against it keep their history.
    const { error: writeError } = await supabase
      .from('facility')
      .update({ is_active: !f.is_active })
      .eq('id', f.id);
    setBusy(false);
    if (writeError) setError(writeError.message);
    else router.refresh();
  }

  return (
    <>
      <section className="card">
        <div className="row" style={{ paddingTop: 0, borderBottom: 'none' }}>
          <div className="row-main">
            <h2 className="row-name" style={{ fontSize: 21 }}>What can be booked</h2>
            <p className="row-meta">{initial.length} SET UP</p>
          </div>
          <button className="btn btn-small" type="button" onClick={startNew}>
            Add a facility
          </button>
        </div>

        {initial.length === 0 && (
          <div className="empty">
            Nothing to book yet. Add the arena, the school, whatever your riders use.
          </div>
        )}

        {initial.map((f) => (
          <div className="row" key={f.id}>
            <div className="row-main">
              <span className="row-name">
                {f.name} {!f.is_active && <span className="pill off">Off</span>}
              </span>
              <span className="row-meta">
                {kindLabel(f.kind).toUpperCase()} · {prettyMinutes(f.slot_minutes)} SLOTS ·{' '}
                {hhmm(f.opens_at)} TO {hhmm(f.closes_at)} · {f.max_days_ahead} DAYS AHEAD
              </span>
            </div>
            <div className="row-actions">
              <button className="btn btn-small btn-quiet" type="button" onClick={() => startEdit(f)}>
                Edit
              </button>
              <button
                className="btn btn-small btn-quiet"
                type="button"
                disabled={busy}
                onClick={() => toggleActive(f)}
              >
                {f.is_active ? 'Turn off' : 'Turn on'}
              </button>
            </div>
          </div>
        ))}

        {/* Turning a facility off happens out here, so its errors do too. */}
        {editing === null && error && (
          <p className="field-error" role="alert">{error}</p>
        )}
      </section>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        busy={busy}
        error={error}
        title={editing === 'new' ? 'Add a facility' : 'Edit facility'}
        footer={
          <div className="actions">
            <button className="btn btn-quiet" type="button" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </button>
            <button className="btn" type="button" onClick={save} disabled={!valid || busy}>
              {busy ? 'Saving…' : editing === 'new' ? 'Add it' : 'Save'}
            </button>
          </div>
        }
      >
        <div className="field">
          <label htmlFor="fname">What is it called?</label>
          <input
            id="fname" value={draft.name} placeholder="Indoor school"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </div>

        <div className="field">
          <label id="kind-label">What sort</label>
          <div className="choices" role="group" aria-labelledby="kind-label">
            {FACILITY_KINDS.map((k) => (
              <button
                key={k.value} type="button" className="choice"
                aria-pressed={draft.kind === k.value}
                onClick={() => setDraft((d) => ({ ...d, kind: k.value }))}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label id="slot-label">How long is a slot</label>
          <div className="choices" role="group" aria-labelledby="slot-label">
            {SLOT_MINUTES.map((m) => (
              <button
                key={m} type="button" className="choice"
                aria-pressed={draft.slot_minutes === m}
                onClick={() => setDraft((d) => ({ ...d, slot_minutes: m }))}
              >
                {prettyMinutes(m)}
              </button>
            ))}
          </div>
        </div>

        <div className="two-up">
          <div className="field">
            <label htmlFor="opens">Opens</label>
            <input
              id="opens" type="time" value={draft.opens_at}
              onChange={(e) => setDraft((d) => ({ ...d, opens_at: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="closes">Closes</label>
            <input
              id="closes" type="time" value={draft.closes_at}
              aria-invalid={draft.closes_at <= draft.opens_at}
              onChange={(e) => setDraft((d) => ({ ...d, closes_at: e.target.value }))}
            />
            {draft.closes_at <= draft.opens_at && (
              <p className="field-error">Closing has to be after opening.</p>
            )}
          </div>
        </div>

        <div className="two-up">
          <div className="field">
            <label htmlFor="ahead">How far ahead they can book</label>
            <input
              id="ahead" type="number" min={1} max={365} value={draft.max_days_ahead}
              onChange={(e) => setDraft((d) => ({ ...d, max_days_ahead: Number(e.target.value) }))}
            />
            <p className="field-hint">Days.</p>
          </div>
          <div className="field">
            <label htmlFor="notice">Cutoff before a slot</label>
            <input
              id="notice" type="number" min={0} max={10080} value={draft.min_notice_minutes}
              onChange={(e) => setDraft((d) => ({ ...d, min_notice_minutes: Number(e.target.value) }))}
            />
            <p className="field-hint">Minutes. Zero lets them book right up to the start.</p>
          </div>
        </div>

      </Modal>
    </>
  );
}
