'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import Modal from '@/components/Modal';

export type MyHorse = {
  id: string;
  name: string;
  retired_at: string | null;
};

export default function Me({
  userId,
  email,
  initialName,
  horses,
}: {
  userId: string;
  email: string;
  initialName: string;
  horses: MyHorse[];
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Null when adding, the horse itself when renaming. */
  const [editing, setEditing] = useState<MyHorse | null | undefined>(undefined);
  const [horseName, setHorseName] = useState('');
  const [horseError, setHorseError] = useState<string | null>(null);

  const nameChanged = name.trim() !== initialName;
  const nameValid = name.trim().length >= 2 && name.trim().length <= 60;

  const here = horses.filter((h) => !h.retired_at);
  const gone = horses.filter((h) => h.retired_at);

  async function saveName() {
    setBusy(true);
    setError(null);
    setSaved(false);

    // The row already exists: a trigger makes one with the account. Only
    // name is grantable, so this cannot touch anything else if it tried.
    const { error: writeError } = await supabase
      .from('profile')
      .update({ name: name.trim() })
      .eq('user_id', userId);

    setBusy(false);
    if (writeError) return setError(writeError.message);
    setSaved(true);
    // The header shows the name, so it has to be re-read.
    router.refresh();
  }

  function startAdd() {
    setHorseName('');
    setHorseError(null);
    setEditing(null);
  }

  function startRename(h: MyHorse) {
    setHorseName(h.name);
    setHorseError(null);
    setEditing(h);
  }

  async function saveHorse() {
    setBusy(true);
    setHorseError(null);

    const trimmed = horseName.trim();
    const { error: writeError } =
      editing === null
        ? await supabase.from('horse').insert({ user_id: userId, name: trimmed })
        : await supabase.from('horse').update({ name: trimmed }).eq('id', editing!.id);

    setBusy(false);
    if (writeError) {
      // 23505 is the one live name per person index. It is the expected
      // answer to naming two horses the same, not a fault.
      setHorseError(
        writeError.code === '23505'
          ? `You already have a horse called ${trimmed}.`
          : writeError.message,
      );
      return;
    }
    setEditing(undefined);
    router.refresh();
  }

  async function retire(h: MyHorse, put: boolean) {
    setBusy(true);
    setError(null);

    const { error: writeError } = await supabase
      .from('horse')
      .update({ retired_at: put ? new Date().toISOString() : null })
      .eq('id', h.id);

    setBusy(false);
    if (writeError) {
      setError(
        writeError.code === '23505'
          ? `You already have a horse called ${h.name}. Rename that one first.`
          : writeError.message,
      );
      return;
    }
    router.refresh();
  }

  return (
    <>
      <section className="card">
        <h1 className="q">Your details</h1>

        <div className="field">
          <label htmlFor="me-name">Your name</label>
          <input
            id="me-name" type="text" autoComplete="name" value={name}
            placeholder="Sarah Bell" maxLength={60}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
          />
          <p className="field-hint">What the yard sees against your bookings.</p>
        </div>

        <div className="field">
          <label htmlFor="me-email">Your email</label>
          <input id="me-email" type="email" value={email} disabled readOnly />
          <p className="field-hint">This is how you sign in, so it stays put.</p>
        </div>

        {error && <p className="field-error" role="alert">{error}</p>}
        {saved && !nameChanged && <p className="field-ok" role="status">Saved.</p>}

        <div className="actions">
          <button
            className="btn" type="button"
            disabled={busy || !nameChanged || !nameValid}
            onClick={saveName}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ paddingTop: 0, borderBottom: 'none' }}>
          <div className="row-main">
            <h2 className="row-name" style={{ fontSize: 21 }}>Your horses</h2>
            <p className="row-meta">
              {here.length === 1 ? '1 HORSE' : `${here.length} HORSES`}
            </p>
          </div>
          <button className="btn btn-small" type="button" onClick={startAdd}>
            Add a horse
          </button>
        </div>

        {horses.length === 0 && (
          <p className="field-hint">
            Add one and you can say which horse a booking is for. The yard
            sees it too, which saves them asking.
          </p>
        )}

        {[...here, ...gone].map((h) => (
          <div className="row" key={h.id}>
            <div className="row-main">
              <span className="row-name">
                {h.name}{' '}
                {h.retired_at && <span className="pill off">Retired</span>}
              </span>
            </div>
            <div className="row-actions">
              <button
                className="btn btn-small btn-quiet" type="button" disabled={busy}
                onClick={() => startRename(h)}
              >
                Rename
              </button>
              <button
                className="btn btn-small btn-quiet" type="button" disabled={busy}
                onClick={() => retire(h, !h.retired_at)}
              >
                {h.retired_at ? 'Bring back' : 'Retire'}
              </button>
            </div>
          </div>
        ))}

        {gone.length > 0 && (
          <p className="field-hint">
            A retired horse is not offered when you book, and stays named on
            the bookings it was already down for.
          </p>
        )}
      </section>

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        busy={busy}
        error={horseError}
        title={editing === null ? 'Add a horse' : 'Rename'}
        footer={
          <div className="actions">
            <button
              className="btn btn-quiet" type="button"
              onClick={() => setEditing(undefined)} disabled={busy}
            >
              Cancel
            </button>
            <button
              className="btn" type="button" onClick={saveHorse}
              disabled={busy || horseName.trim().length < 1}
            >
              {busy ? 'Saving…' : editing === null ? 'Add' : 'Rename'}
            </button>
          </div>
        }
      >
        <div className="field">
          <label htmlFor="horse-name">What are they called</label>
          <input
            id="horse-name" type="text" value={horseName}
            placeholder="Bramble" maxLength={60}
            onChange={(e) => setHorseName(e.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}
