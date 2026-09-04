import { notFound, redirect } from 'next/navigation';
import { getYard } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import ResetRequest from '@/components/ResetRequest';

type Props = { params: Promise<{ yard: string }> };

export async function generateMetadata({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  return { title: found ? `Forgotten password · ${found.name}` : 'Forgotten password' };
}

export default async function YardResetPage({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();

  // Somebody signed in changes their password on /me, and the layout
  // gives them the yard header, which would sit above this page's own
  // masthead as a second one. Same reason sign in redirects.
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/me');

  return (
    <main className="yard">
      <header className="yard-head">
        <h1 className="yard-name">{found.name}</h1>
        <p className="yard-sub">Arena booking</p>
      </header>
      <ResetRequest />
    </main>
  );
}
