import type { Metadata } from 'next';
import Link from 'next/link';
import LegalLinks from '@/components/LegalLinks';
import { redirect } from 'next/navigation';
import Wordmark from '@/components/Wordmark';
import { supabaseServer } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: 'Facility Booking · The Lazy Horseman',
  description: 'Sign in to your yard, or set one up.',
};

/**
 * The platform host's front door. A yard's own address never lands here,
 * because the proxy rewrites those under /yards.
 *
 * This used to redirect straight to /start, which met everybody who
 * already had a yard with a form asking them to make another one.
 */
export default async function Home() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Somebody already signed in wants their yards, not the front door.
  if (user) redirect('/account');

  return (
    <main className="gate">
      <Wordmark tag="FACILITY BOOKING" />

      <div className="card">
        <h1 className="q">Arena bookings, off the group chat.</h1>
        <p className="sub">Riders book their own slots.</p>

        <div className="doors">
          <Link className="door primary" href="/sign-in">
            <span className="door-main">
              <span className="door-name">Sign in</span>
              <span className="door-note">Owners and riders.</span>
            </span>
            <span className="door-go" aria-hidden="true">&rarr;</span>
          </Link>

          <Link className="door" href="/start">
            <span className="door-main">
              <span className="door-name">Set up a yard</span>
              <span className="door-note">Free for one facility.</span>
            </span>
            <span className="door-go" aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>

      <LegalLinks className="gate-foot legal-links" />
    </main>
  );
}
