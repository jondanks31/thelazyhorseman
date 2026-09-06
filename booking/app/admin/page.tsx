import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Wordmark from '@/components/Wordmark';
import { supabaseServer } from '@/lib/supabase-server';
import Yards, { type StaffYard } from './Yards';

export const metadata: Metadata = {
  title: 'Yards · Staff',
  robots: { index: false, follow: false },
};

/**
 * The staff screen, on the platform host only.
 *
 * Not linked from anywhere on purpose. It is reached by typing the
 * address, and it is the only screen in the product that can see across
 * yards, so the less it advertises itself the better.
 *
 * The gate is in the database, not here: platform_yards() raises 42501
 * for anybody who is not on private.platform_admin, and this page just
 * reports the result honestly.
 */
export default async function StaffPage() {
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent('/admin')}`);

  const { data, error } = await supabase.rpc('platform_yards');

  // Signed in, and not staff. For them the page simply is not here,
  // rather than a refusal that confirms there is something to refuse.
  if (error?.code === '42501') notFound();
  if (error) throw new Error(error.message);

  const yards = (data ?? []) as StaffYard[];

  return (
    <main className="gate staff">
      <Wordmark tag="STAFF" />
      <Yards yards={yards} />
    </main>
  );
}
