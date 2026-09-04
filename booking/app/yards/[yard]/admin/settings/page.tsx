import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getYard, requireAdmin } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import { yardUrl } from '@/lib/tenant';
import Settings from './Settings';

type Props = { params: Promise<{ yard: string }> };

export async function generateMetadata({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  return { title: found ? `Settings · ${found.name}` : 'Settings' };
}

export default async function SettingsPage({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();
  await requireAdmin(yard, found.id);

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('business')
    .select('name, timezone')
    .eq('id', found.id)
    .maybeSingle<{ name: string; timezone: string }>();

  return (
    <>
      <div>
        <h1 className="page-h">Settings</h1>
        <p className="page-lead">The yard itself.</p>
      </div>
      <Settings
        yardId={found.id}
        initialName={data?.name ?? found.name}
        initialTimezone={data?.timezone ?? 'Europe/London'}
        joinLink={yardUrl(yard, (await headers()).get('host'))}
      />
    </>
  );
}
