import { notFound } from 'next/navigation';
import { getYard, requireAdmin } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import Settings from './Settings';

type Props = { params: Promise<{ yard: string }> };

export default async function SettingsPage({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();
  await requireAdmin(yard, found.id);

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('business')
    .select('name')
    .eq('id', found.id)
    .maybeSingle<{ name: string }>();

  return (
    <>
      <div>
        <h1 className="admin-h">Settings</h1>
        <p className="admin-lead">The yard itself.</p>
      </div>
      <Settings yardId={found.id} initialName={data?.name ?? found.name} />
    </>
  );
}
