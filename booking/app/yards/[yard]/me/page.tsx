import { notFound, redirect } from 'next/navigation';
import { getYard } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import Me from './Me';

type Props = { params: Promise<{ yard: string }> };

export const metadata = { title: 'Your details' };

export default async function MePage({ params }: Props) {
  const { yard: subdomain } = await params;
  const found = await getYard(subdomain);
  if (!found) notFound();

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in?next=%2Fme');

  const { data: profile } = await supabase
    .from('profile')
    .select('name, horse_name')
    .eq('user_id', user.id)
    .maybeSingle<{ name: string | null; horse_name: string | null }>();

  return (
    <main className="yard">
      <Me
        userId={user.id}
        email={user.email ?? ''}
        initialName={profile?.name ?? ''}
        initialHorse={profile?.horse_name ?? ''}
      />
    </main>
  );
}
