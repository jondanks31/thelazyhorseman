'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

type Props = {
  yardId: string;
  initialName: string;
};

export default function Settings({ yardId, initialName }: Props) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = name.trim() !== initialName;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const { error: writeError } = await supabase
      .from('business')
      .update({ name: name.trim() })
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
    <section className="card">
      <div className="field">
        <label htmlFor="yname">Yard name</label>
        <input
          id="yname" value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
        />
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}
      {saved && !changed && <p className="field-ok" role="status">Saved.</p>}

      <div className="actions">
        <button className="btn" type="button" onClick={save} disabled={!changed || !name.trim() || busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
  );
}
