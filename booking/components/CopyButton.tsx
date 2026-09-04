'use client';

import { useEffect, useRef, useState } from 'react';

type Said = 'idle' | 'done' | 'failed';

/**
 * Copying an address to the clipboard.
 *
 * There were three of these, on the join code, on an invite that could
 * not be emailed and on the yard's own address in Settings, each with
 * its own copied flag and its own sentence for a refusal. The wizard
 * wanted a fourth.
 *
 * It says what happened on itself rather than through an error slot the
 * caller has to own. The value is always on screen next to it, so a
 * refusal is a nudge to select it, not a dead end.
 */
export default function CopyButton({
  value,
  label = 'Copy link',
  className = 'btn',
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [said, setSaid] = useState<Said>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clearing on the way out, or a copy just before the modal closes
  // sets state on something that has gone.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setSaid('done');
    } catch {
      // Blocked without a user gesture, and on an insecure origin. Both
      // leave the address readable on screen.
      setSaid('failed');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaid('idle'), 2000);
  }

  return (
    <button className={className} type="button" onClick={copy}>
      {said === 'done' ? 'Copied' : said === 'failed' ? 'Copy it by hand' : label}
    </button>
  );
}
