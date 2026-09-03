'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

export default function Me({
  userId,
  email,
  initialName,
  initialHorse,
}: {
  userId: string;
  email: string;
  initialName: string;
  initialHorse: string;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [horse, setHorse] = useState(initialHorse);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = name.trim() !== initialName || horse.trim() !== initialHorse;
  const valid = name.trim().length >= 2 && name.trim().length <= 60 && horse.trim().length <= 60;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);

    // The row already exists: a trigger makes one with the account. Only
    // name and horse_name are grantable, so this cannot touch anything
    // else even if it tried.
    const { error: writeError } = await supabase
      .from('profile')
      .update({ name: name.trim(), horse_name: horse.trim() || null })
      .eq('user_id', userId);

    setBusy(false);
    if (writeError) {
      setError(writeError.message);
      return;
    }
    setSaved(true);
    // The header shows the name, so it has to be re-read.
    router.refresh();
  }

  return (
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
        <label htmlFor="me-horse">Your horse</label>
        <input
          id="me-horse" type="text" value={horse}
          placeholder="Bramble" maxLength={60}
          onChange={(e) => { setHorse(e.target.value); setSaved(false); }}
        />
      </div>

      <div className="field">
        <label htmlFor="me-email">Your email</label>
        <input id="me-email" type="email" value={email} disabled readOnly />
        <p className="field-hint">This is how you sign in, so it stays put.</p>
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}
      {saved && !changed && <p className="field-ok" role="status">Saved.</p>}

      <div className="actions">
        <button
          className="btn" type="button"
          disabled={busy || !changed || !valid}
          onClick={save}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
  );
}
