'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import CopyButton from '@/components/CopyButton';
import { timezoneOptions } from '@/lib/timezones';

type Props = {
  yardId: string;
  initialName: string;
  initialTimezone: string;
  /** The yard's own address, which is what it hands out to riders. */
  joinLink: string;
};

export default function Settings({
  yardId,
  initialName,
  initialTimezone,
  joinLink,
}: Props) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => timezoneOptions(initialTimezone), [initialTimezone]);

  const changed = name.trim() !== initialName || timezone !== initialTimezone;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);

    // Only name and timezone are grantable on business, so this cannot
    // reach plan or status even if it tried. See migration 0012.
    const { error: writeError } = await supabase
      .from('business')
      .update({ name: name.trim(), timezone })
      .eq('id', yardId);

    setBusy(false);
    if (writeError) {
      setError(writeError.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <>
      <section className="card">
        <div className="field">
          <label htmlFor="yname">Yard name</label>
          <input
            id="yname" value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
          />
        </div>

        <div className="field">
          <label htmlFor="ytz">Where the yard is</label>
          <select
            id="ytz" value={timezone}
            onChange={(e) => { setTimezone(e.target.value); setSaved(false); }}
          >
            {options.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {error && <p className="field-error" role="alert">{error}</p>}
        {saved && !changed && <p className="field-ok" role="status">Saved.</p>}

        <div className="actions">
          <button
            className="btn" type="button" onClick={save}
            disabled={!changed || !name.trim() || busy}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      {/* The one link a yard hands out. It was only ever readable as a
          sentence on the overview, which is no use to somebody trying to
          paste it into a group chat. */}
      <section className="card">
        <h2 className="q" style={{ fontSize: 24 }}>Your address</h2>
        <p className="join-link">{joinLink}</p>

        <div className="actions">
          <CopyButton value={joinLink} label="Copy address" />
        </div>
      </section>
    </>
  );
}
