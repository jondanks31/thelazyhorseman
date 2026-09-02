import { notFound } from 'next/navigation';
import { getYard, requireAdmin } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import type { PlanId } from '@/lib/plans';
import Plan from './Plan';

type Props = { params: Promise<{ yard: string }> };

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
        <h1 className="admin-h">Plan</h1>
        <p className="admin-lead">
          What you are on, and what the next one up gives you. Riders are
          never counted, so signing the whole yard up costs nothing extra.
        </p>
      </div>
      <Plan
        current={business.data?.plan ?? 'free'}
        used={facilities.count ?? 0}
      />
    </>
  );
}
