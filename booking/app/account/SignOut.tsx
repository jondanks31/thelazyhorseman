'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

export default function SignOut() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function out() {
    setBusy(true);
    await supabase.auth.signOut();
    // Sessions belong to one host, so this ends the one here and leaves
    // any yard you are signed into alone.
    router.replace('/');
    router.refresh();
  }

  return (
    <button className="btn btn-quiet" type="button" onClick={out} disabled={busy}>
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
