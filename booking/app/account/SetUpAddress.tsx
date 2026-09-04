'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SAID: Record<string, string> = {
  pending: 'Nearly. Give it a minute, then check again.',
  taken: 'Another Vercel project already holds that address.',
  notConfigured: 'Address registration is not switched on here.',
  failed: 'That did not work. Try again in a minute.',
};

/**
 * The way back for a yard whose address was never registered.
 *
 * It lives here rather than on the yard's own admin screens because a
 * yard with no address cannot be reached at its address, so a button
 * over there could never be pressed.
 */
export default function SetUpAddress({ subdomain }: { subdomain: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setSaid(null);

    try {
      const res = await fetch('/start/domain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subdomain }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSaid(body.error ?? SAID.failed);
        return;
      }
      if (body.state === 'live') {
        router.refresh();
        return;
      }
      setSaid(SAID[body.state] ?? SAID.failed);
    } catch {
      setSaid(SAID.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="yard-row-fix">
      <button className="btn btn-small" type="button" onClick={go} disabled={busy}>
        {busy ? 'Setting up…' : 'Set up address'}
      </button>
      {said && <span className="field-hint">{said}</span>}
    </span>
  );
}
