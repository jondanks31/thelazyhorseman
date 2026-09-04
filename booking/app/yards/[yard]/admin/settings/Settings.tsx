'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { clockAt, timezoneOptions } from '@/lib/timezones';

/** Nothing pushes the time at us, so there is nothing to subscribe to. */
const neverChanges = () => () => {};

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
  const [copied, setCopied] = useState(false);

  /**
   * The clock where the yard is, so a wrong zone shows up here rather
   * than later as a clinic filed an hour out.
   *
   * Blank on the server and read in the browser, because the two would
   * otherwise disagree about the time and React would call it a
   * hydration mismatch. useSyncExternalStore is how you say "this value
   * only exists on the client" without an effect that writes state on
   * every render.
   */
  const clock = useSyncExternalStore(
    neverChanges,
    () => clockAt(timezone),
    () => '',
  );

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

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Select the address and copy it by hand.');
    }
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
          <p className="field-hint">What riders see at the top of every screen.</p>
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
          <p className="field-hint">
            Every booking is kept against this, so six o&rsquo;clock means six at the
            yard however far from it you happen to be.
            {clock && ` It is ${clock} there now.`}
          </p>
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
        <p className="sub">
          This is where riders book. Put it in the group chat and on the
          noticeboard.
        </p>

        <p className="join-link">{joinLink}</p>

        <div className="actions">
          <button className="btn" type="button" onClick={copy}>
            {copied ? 'Copied' : 'Copy address'}
          </button>
        </div>
      </section>
    </>
  );
}
