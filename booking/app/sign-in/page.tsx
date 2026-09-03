import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Wordmark from '@/components/Wordmark';
import { supabaseServer } from '@/lib/supabase-server';
import SignIn from './SignIn';

export const metadata: Metadata = {
  title: 'Sign in · Facility Booking',
};

export default async function SignInPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/account');

  return (
    <main className="gate">
      <Wordmark tag="FACILITY BOOKING" />
      {/* useSearchParams needs a boundary, or the whole route opts out
          of static rendering. */}
      <Suspense>
        <SignIn />
      </Suspense>
      <p className="gate-foot">
        Signing in on your yard&rsquo;s own address takes you straight to its
        diary. This one is for finding your way back to it.
      </p>
    </main>
  );
}
