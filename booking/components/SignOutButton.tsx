'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

/**
 * Ends the session on this host only. Sessions carry no Domain, so
 * signing out of one yard leaves any other you are on alone.
 *
 * `className` exists because this appears both as a menu row in the
 * header and as an ordinary button on the card shown to somebody who is
 * not on the yard, where it is their only way to try another account.
 */
export default function SignOutButton({
  className = 'btn btn-quiet',
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function out() {
    setBusy(true);
    await supabase.auth.signOut();
    // The root sends a stranger to the sign in.
    router.replace('/');
    router.refresh();
  }

  return (
    <button className={className} type="button" onClick={out} disabled={busy}>
      {children ?? <span>{busy ? 'Signing out…' : 'Sign out'}</span>}
    </button>
  );
}
