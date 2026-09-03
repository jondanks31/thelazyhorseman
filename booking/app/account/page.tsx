import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Wordmark from '@/components/Wordmark';
import { supabaseServer } from '@/lib/supabase-server';
import { yardUrl } from '@/lib/tenant';
import SignOut from './SignOut';

export const metadata: Metadata = {
  title: 'Your yards · Facility Booking',
};

type MyYard = {
  business_id: string;
  name: string;
  subdomain: string | null;
  role: 'owner' | 'admin' | 'rider';
  status: 'pending' | 'approved' | 'blocked';
};

export default async function AccountPage() {
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent('/account')}`);

  // my_yards() reads auth.uid() itself and reaches the subdomain table,
  // which clients cannot read directly. See migration 0011.
  const { data } = await supabase.rpc('my_yards');
  const all = (data ?? []) as MyYard[];

  // This page is for people who run a yard. A rider reaches their yard
  // by its own address and has no reason to come here at all, but one
  // who does should be pointed at it rather than told they have nothing.
  const yards = all.filter((y) => y.role === 'owner' || y.role === 'admin');
  const asRider = all.filter((y) => y.role === 'rider' && y.status !== 'blocked');

  const host = (await headers()).get('host');

  return (
    <main className="gate">
      <Wordmark tag="FACILITY BOOKING" />

      <div className="card">
        <h1 className="q">Your yards.</h1>

        <p className="sub">Signed in as <strong>{user.email}</strong>.</p>

        {/* Signed in and on nobody's list. Usually somebody who has moved
            yards, so the useful thing is the sentence they can forward to
            their new one, not an apology. */}
        {yards.length === 0 && asRider.length === 0 && (
          <>
            <div className="empty">You are not on a yard.</div>
            <p className="field-hint">
              Yards hand out their own booking link. If yours does not use
              The Lazy Horseman yet, tell them: it is free for one facility
              and takes about five minutes to set up.
            </p>
          </>
        )}

        {yards.length === 0 && asRider.map((y) => (
          <div className="yard-row" key={y.business_id}>
            <span className="yard-row-main">
              <span className="yard-row-name">{y.name}</span>
              <span className="yard-row-addr">
                {y.subdomain ? yardUrl(y.subdomain, host).replace(/^https?:\/\//, '') : 'No address'}
              </span>
            </span>
            {y.subdomain && (
              <a className="btn btn-small" href={yardUrl(y.subdomain, host)}>
                Book a slot
              </a>
            )}
          </div>
        ))}

        {yards.map((y) => {
          const admin = y.role === 'owner' || y.role === 'admin';
          const base = y.subdomain ? yardUrl(y.subdomain, host) : null;
          // Always the yard's own front door. It works out whether this
          // is a rider or somebody who runs the place, so the role is
          // decided in one spot rather than three.
          const href = base;

          return (
            <div className="yard-row" key={y.business_id}>
              <span className="yard-row-main">
                <span className="yard-row-name">
                  {y.name}{' '}
                  {admin && <span className="pill">{y.role === 'owner' ? 'Owner' : 'Admin'}</span>}
                  {y.status === 'pending' && <span className="pill off">Waiting</span>}
                  {y.status === 'blocked' && <span className="pill off">No access</span>}
                </span>
                <span className="yard-row-addr">
                  {base ? base.replace(/^https?:\/\//, '') : 'No address'}
                </span>
              </span>

              {href && y.status !== 'blocked' ? (
                <a className="btn btn-small" href={href}>
                  {admin ? 'Yard controls' : 'Book a slot'}
                </a>
              ) : (
                <span className="field-hint">
                  {y.status === 'blocked'
                    ? 'Ask the yard to let you back on.'
                    : 'This yard has no address.'}
                </span>
              )}
            </div>
          );
        })}

        <div className="actions">
          <SignOut />
          <Link className="btn" href="/start">Set up a yard</Link>
        </div>
      </div>

    </main>
  );
}
