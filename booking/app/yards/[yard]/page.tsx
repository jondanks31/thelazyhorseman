import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import './yard.css';

type Props = { params: Promise<{ yard: string }> };

async function loadYard(subdomain: string) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .rpc('yard_by_subdomain', { p_subdomain: subdomain })
    .maybeSingle<{ id: string; name: string }>();

  if (error) throw new Error(error.message);
  return data;
}

export async function generateMetadata({ params }: Props) {
  const { yard: subdomain } = await params;
  const yard = await loadYard(subdomain);
  return {
    title: yard ? `${yard.name} · Booking` : 'Yard not found',
    description: yard ? `Book the arena at ${yard.name}.` : undefined,
  };
}

export default async function YardPage({ params }: Props) {
  const { yard: subdomain } = await params;
  const yard = await loadYard(subdomain);
  if (!yard) notFound();

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase
        .from('membership')
        .select('role, status')
        .eq('business_id', yard.id)
        .eq('user_id', user.id)
        .maybeSingle<{ role: string; status: string }>()
    : { data: null };

  const onTheYard = membership?.status === 'approved';
  const admin = onTheYard && (membership?.role === 'owner' || membership?.role === 'admin');

  return (
    <main className="yard">
      <header className="yard-head">
        <h1 className="yard-name">{yard.name}</h1>
        <p className="yard-sub">Arena booking</p>
      </header>

      <section className="card">
        {!user && (
          <>
            <h2 className="q">Sign in.</h2>
            <div className="actions">
              <Link className="btn" href="/sign-in">Sign in</Link>
            </div>
            <p className="field-hint">Riders join with a link or code from the yard.</p>
          </>
        )}

        {user && !onTheYard && (
          <>
            <h2 className="q">You need an invite.</h2>
            <p className="sub">Ask {yard.name} for a link, or scan their code.</p>
          </>
        )}

        {onTheYard && (
          <>
            <h2 className="q">You are on {yard.name}.</h2>
            {admin && (
              <div className="actions">
                <Link className="btn" href="/admin">Yard controls</Link>
              </div>
            )}
          </>
        )}
      </section>

      <p className="yard-foot">
        Runs on <a href="https://www.thelazyhorseman.com/">The Lazy Horseman</a>
      </p>
    </main>
  );
}
