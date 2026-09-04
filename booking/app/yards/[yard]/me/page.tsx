import { notFound, redirect } from 'next/navigation';
import { getYard } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import Me, { type MyHorse } from './Me';

type Props = { params: Promise<{ yard: string }> };

export async function generateMetadata({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  return { title: found ? `Your details · ${found.name}` : 'Your details' };
}

export default async function MePage({ params }: Props) {
  const { yard: subdomain } = await params;
  const found = await getYard(subdomain);
  if (!found) notFound();

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in?next=%2Fme');

  const [{ data: profile }, { data: horses }] = await Promise.all([
    supabase.from('profile').select('name').eq('user_id', user.id)
      .maybeSingle<{ name: string | null }>(),
    // Row level security limits this to their own, so no admin function
    // is needed and it works for a rider as well as an owner.
    supabase.from('horse').select('id, name, retired_at')
      .eq('user_id', user.id).order('name'),
  ]);

  return (
    <main className="yard is-page">
      <Me
        userId={user.id}
        email={user.email ?? ''}
        initialName={profile?.name ?? ''}
        horses={(horses ?? []) as MyHorse[]}
      />
    </main>
  );
}
