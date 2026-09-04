import { notFound } from 'next/navigation';
import { getYard, requireAdmin } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import type { PlanId } from '@/lib/plans';
import Plan from './Plan';

type Props = { params: Promise<{ yard: string }> };

export async function generateMetadata({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  return { title: found ? `Plan · ${found.name}` : 'Plan' };
}

export default async function PlanPage({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();
  await requireAdmin(yard, found.id);

  const supabase = await supabaseServer();

  const [business, facilities] = await Promise.all([
    supabase.from('business').select('plan').eq('id', found.id)
      .maybeSingle<{ plan: PlanId }>(),
    supabase.from('facility').select('id', { count: 'exact', head: true })
      .eq('business_id', found.id).eq('is_active', true),
  ]);

  return (
    <>
      <div>
        <h1 className="page-h">Plan</h1>
        <p className="page-lead">Riders are never counted, on any plan.</p>
      </div>
      <Plan
        current={business.data?.plan ?? 'free'}
        used={facilities.count ?? 0}
      />
    </>
  );
}
