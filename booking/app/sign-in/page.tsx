import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Wordmark from '@/components/Wordmark';
import SignInForm from '@/components/SignInForm';
import { supabaseServer } from '@/lib/supabase-server';

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
        <SignInForm
          heading="Sign in."
          fallback="/account"
          footer={
            <p className="field-hint">
              Not on a yard yet? <Link href="/start">Set one up</Link>.
            </p>
          }
        />
      </Suspense>
    </main>
  );
}
