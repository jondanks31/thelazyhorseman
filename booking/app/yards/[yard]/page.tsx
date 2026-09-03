import { notFound, redirect } from 'next/navigation';
import SignOutButton from '@/components/SignOutButton';
import { getYard } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';

type Props = { params: Promise<{ yard: string }> };

export async function generateMetadata({ params }: Props) {
  const { yard: subdomain } = await params;
  const yard = await getYard(subdomain);
  return {
    title: yard ? `${yard.name} · Booking` : 'Yard not found',
    description: yard ? `Book the arena at ${yard.name}.` : undefined,
  };
}

/**
 * The yard's own address, and the only link a yard ever has to hand out.
 * Whoever follows it should end up where they belong without choosing
 * anything, so this decides and sends them on.
 *
 * Signed out goes to the yard's sign in, which comes back here, so the
 * decision lives in one place rather than being duplicated in the form.
 * The one case that stops here is somebody signed in who is not on this
 * yard, because there is nowhere to send them.
 */
export default async function YardPage({ params }: Props) {
  const { yard: subdomain } = await params;
  const yard = await getYard(subdomain);
  if (!yard) notFound();

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: membership } = await supabase
    .from('membership')
    .select('role, status')
    .eq('business_id', yard.id)
    .eq('user_id', user.id)
    .maybeSingle<{ role: string; status: string }>();

  if (membership?.status === 'approved') {
    const runsIt = membership.role === 'owner' || membership.role === 'admin';
    redirect(runsIt ? '/admin' : '/book');
  }

  // Never invited, taken off the list, or blocked. All three are the
  // same to the person standing here, and the yard is the only one who
  // can do anything about it.
  // No header above this one: the layout gives it only to members, and
  // a nav bar full of places they cannot go would be no help at all.
  return (
    <main className="yard">
      <header className="yard-head">
        <h1 className="yard-name">{yard.name}</h1>
        <p className="yard-sub">Arena booking</p>
      </header>

      <section className="card">
        <h2 className="q">You are not on {yard.name}&rsquo;s list.</h2>
        <p className="sub">
          Ask them for their booking link or code, and you are back on in a
          couple of taps.
        </p>
        {/* Their only way out. There is no header on this page, and
            somebody signed in on the wrong account would otherwise be
            stuck here with no way to try the right one. */}
        <div className="actions">
          <SignOutButton />
        </div>
      </section>

      <p className="yard-foot">
        Runs on <a href="https://www.thelazyhorseman.com/">The Lazy Horseman</a>
      </p>
    </main>
  );
}
