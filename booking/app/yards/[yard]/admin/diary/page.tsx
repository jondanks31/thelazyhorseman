import { notFound } from 'next/navigation';
import { getYard, requireAdmin } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import { personName, yardHorses, yardPeople } from '@/lib/people';
import { addDays, dayAt, todayAt, zonedToInstant } from '@/lib/time';
import { monthGrid, monthOf } from '@/lib/month';
import Diary, { type DiaryEntry, type DiaryFacility } from './Diary';
import type { DayBusy } from './Month';

type Props = {
  params: Promise<{ yard: string }>;
  searchParams: Promise<{ month?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  return { title: found ? `Diary · ${found.name}` : 'Diary' };
}

/** "2026-09", or this month at the yard when the query says nothing sane. */
function wantedMonth(raw: string | undefined, today: string): string {
  return raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : monthOf(today);
}

export default async function DiaryPage({ params, searchParams }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();
  await requireAdmin(yard, found.id);

  const supabase = await supabaseServer();

  const { data: business } = await supabase
    .from('business').select('timezone').eq('id', found.id)
    .maybeSingle<{ timezone: string }>();
  const timezone = business?.timezone ?? 'Europe/London';

  const today = todayAt(timezone);
  const month = wantedMonth((await searchParams).month, today);

  // The squares run to whole weeks, so the query has to cover the days
  // either side of the month that share a row with it.
  const grid = monthGrid(month);
  const from = zonedToInstant(grid[0], '00:00', timezone).toISOString();
  const to = zonedToInstant(addDays(grid[grid.length - 1], 1), '00:00', timezone).toISOString();

  const [{ data: facilities }, { data: entries }, { data: inMonth }] = await Promise.all([
    supabase.from('facility')
      .select('id, name, slot_minutes, opens_at, closes_at')
      .eq('business_id', found.id).eq('is_active', true).order('created_at'),
    supabase.from('booking')
      .select('id, facility_id, user_id, horse_id, starts_at, ends_at, kind, title, status')
      .eq('business_id', found.id)
      .eq('status', 'confirmed')
      .gte('ends_at', new Date().toISOString())
      .order('starts_at')
      .limit(100),
    supabase.from('booking')
      .select('starts_at, kind, title')
      .eq('business_id', found.id)
      .eq('status', 'confirmed')
      .gte('starts_at', from)
      .lt('starts_at', to)
      .limit(2000),
  ]);

  // This page is admin only, so every booking gets a name. "Rider
  // booking" told the yard nothing about who was in the school.
  const [people, horses] = await Promise.all([
    yardPeople(found.id),
    yardHorses(found.id),
  ]);

  type Row = DiaryEntry & { user_id: string; horse_id: string | null };
  const named = ((entries ?? []) as Row[]).map((e): DiaryEntry => {
    const p = people.get(e.user_id);
    return {
      ...e,
      who: p ? personName(p) : null,
      horse: (e.horse_id && horses.get(e.horse_id)?.horse) || null,
    };
  });

  // Which square each booking belongs in is a question about the yard's
  // clock, not UTC.
  const busy = new Map<string, DayBusy>();
  for (const b of (inMonth ?? []) as { starts_at: string; kind: string; title: string | null }[]) {
    const key = dayAt(new Date(b.starts_at), timezone);
    const day = busy.get(key) ?? { events: [], slots: 0 };
    if (b.kind === 'event') day.events.push(b.title ?? 'Yard');
    else day.slots += 1;
    busy.set(key, day);
  }

  return (
    <>
      <div>
        <h1 className="page-h">Diary</h1>
        <p className="page-lead">What is booked, and what you have blocked out.</p>
      </div>
      <Diary
        yardId={found.id}
        timezone={timezone}
        facilities={(facilities ?? []) as DiaryFacility[]}
        entries={named}
        month={month}
        monthDays={grid}
        monthBusy={[...busy.entries()]}
        today={today}
      />
    </>
  );
}
