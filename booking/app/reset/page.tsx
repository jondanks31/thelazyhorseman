import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Wordmark from '@/components/Wordmark';
import ResetRequest from '@/components/ResetRequest';
import { supabaseServer } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: 'Forgotten password · Facility Booking',
};

export default async function ResetPage() {
  // Already in, so there is nothing to recover. Same as sign in.
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/account');

  return (
    <main className="gate">
      <Wordmark tag="FACILITY BOOKING" />
      <ResetRequest />
    </main>
  );
}
