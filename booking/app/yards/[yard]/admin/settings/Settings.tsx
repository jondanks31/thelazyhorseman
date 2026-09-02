'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

type Props = {
  yardId: string;
  initialName: string;
  initialPolicy: 'request' | 'invite';
};

export default function Settings({ yardId, initialName, initialPolicy }: Props) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [policy, setPolicy] = useState<'request' | 'invite'>(initialPolicy);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = name.trim() !== initialName || policy !== initialPolicy;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const { error: writeError } = await supabase
      .from('business')
      .update({ name: name.trim(), join_policy: policy })
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
        <p className="field-hint">What riders see at the top of the page.</p>
      </div>

      <div className="field">
        <label id="policy-label">How riders get on</label>
        <div className="choices" role="group" aria-labelledby="policy-label">
          <button
            type="button" className="choice" aria-pressed={policy === 'request'}
            onClick={() => { setPolicy('request'); setSaved(false); }}
          >
            Anyone can ask
          </button>
          <button
            type="button" className="choice" aria-pressed={policy === 'invite'}
            onClick={() => { setPolicy('invite'); setSaved(false); }}
          >
            Invite only
          </button>
        </div>
        <p className="field-hint">
          {policy === 'request'
            ? 'Anyone with the link can ask to join, and waits for you to approve them. Nobody books before that.'
            : 'The request button disappears. Only people you invite by email can get on.'}
        </p>
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
