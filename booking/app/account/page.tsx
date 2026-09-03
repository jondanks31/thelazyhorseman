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
  const yards = (data ?? []) as MyYard[];

  const host = (await headers()).get('host');

  return (
    <main className="gate">
      <Wordmark tag="FACILITY BOOKING" />

      <div className="card">
        <h1 className="q">Your yards.</h1>

        {yards.length === 0 ? (
          <>
            <p className="sub">
              You are signed in as <strong>{user.email}</strong>, and this
              account is not on a yard yet.
            </p>
            <div className="empty">
              If your yard already uses this, ask them for their address and
              join from there. Otherwise you can set one up.
            </div>
          </>
        ) : (
          <p className="sub">
            Signed in as <strong>{user.email}</strong>. Opening one takes you to
            its own address, where you sign in to that yard.
          </p>
        )}

        {yards.map((y) => {
          const admin = y.role === 'owner' || y.role === 'admin';
          const base = y.subdomain ? yardUrl(y.subdomain, host) : null;
          const href = base ? `${base}${admin ? '/admin' : '/'}` : null;

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

      <p className="gate-foot">
        A sign in belongs to one address at a time, so opening a yard asks for
        your password again. Nothing else on that yard can see this account.
      </p>
    </main>
  );
}
