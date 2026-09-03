import { notFound } from 'next/navigation';
import { getYard, requireAdmin } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import { personLabel, yardPeople } from '@/lib/people';
import Diary, { type DiaryEntry, type DiaryFacility } from './Diary';

type Props = { params: Promise<{ yard: string }> };

export default async function DiaryPage({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();
  await requireAdmin(yard, found.id);

  const supabase = await supabaseServer();

  const [{ data: business }, { data: facilities }, { data: entries }] = await Promise.all([
    supabase.from('business').select('timezone').eq('id', found.id)
      .maybeSingle<{ timezone: string }>(),
    supabase.from('facility')
      .select('id, name, slot_minutes, opens_at, closes_at')
      .eq('business_id', found.id).eq('is_active', true).order('created_at'),
    supabase.from('booking')
      .select('id, facility_id, user_id, starts_at, ends_at, kind, title, status')
      .eq('business_id', found.id)
      .eq('status', 'confirmed')
      .gte('ends_at', new Date().toISOString())
      .order('starts_at')
      .limit(100),
  ]);

  // This page is admin only, so every booking gets a name. "Rider
  // booking" told the yard nothing about who was in the school.
  const people = await yardPeople(found.id);
  const named = ((entries ?? []) as (DiaryEntry & { user_id: string })[]).map(
    (e): DiaryEntry => {
      const p = people.get(e.user_id);
      return { ...e, who: p ? personLabel(p) : null };
    },
  );

  return (
    <>
      <div>
        <h1 className="admin-h">Diary</h1>
        <p className="admin-lead">What is booked, and what you have blocked out.</p>
      </div>
      <Diary
        yardId={found.id}
        timezone={business?.timezone ?? 'Europe/London'}
        facilities={(facilities ?? []) as DiaryFacility[]}
        entries={named}
      />
    </>
  );
}
