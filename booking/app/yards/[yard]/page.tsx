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

  return (
    <main className="yard">
      <header className="yard-head">
        <h1 className="yard-name">{yard.name}</h1>
        <p className="yard-sub">Arena booking</p>
      </header>

      <section className="card">
        {user ? (
          <>
            <h2 className="q">You are signed in.</h2>
            <p className="sub">
              The diary is next. For now this proves the yard resolved from its own
              address and that the session came with you.
            </p>
          </>
        ) : (
          <>
            <h2 className="q">Ask to join {yard.name}.</h2>
            <p className="sub">
              Bookings are for people on the yard, so {yard.name} approves everyone
              before they can take a slot.
            </p>
            <p className="field-hint">Joining is next on the list.</p>
          </>
        )}
      </section>

      <p className="yard-foot">
        Runs on <a href="https://www.thelazyhorseman.com/">The Lazy Horseman</a>
      </p>
    </main>
  );
}
