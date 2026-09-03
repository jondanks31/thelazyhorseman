import { notFound } from 'next/navigation';
import { getYard, requireAdmin } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import Facilities, { type Facility } from './Facilities';
import type { PlanId } from '@/lib/plans';

type Props = { params: Promise<{ yard: string }> };

export default async function FacilitiesPage({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();
  await requireAdmin(yard, found.id);

  const supabase = await supabaseServer();
  const [{ data }, business] = await Promise.all([
    supabase
      .from('facility')
      .select('id, name, kind, slot_minutes, max_days_ahead, min_notice_minutes, opens_at, closes_at, is_active')
      .eq('business_id', found.id)
      .order('created_at'),
    supabase.from('business').select('plan').eq('id', found.id)
      .maybeSingle<{ plan: PlanId }>(),
  ]);

  return (
    <>
      <div>
        <h1 className="admin-h">Facilities</h1>
        <p className="admin-lead">Everything a rider can take a slot on.</p>
      </div>
      <Facilities
        yardId={found.id}
        initial={(data ?? []) as Facility[]}
        plan={business.data?.plan ?? 'free'}
      />
    </>
  );
}
