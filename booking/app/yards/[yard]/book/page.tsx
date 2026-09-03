import { notFound, redirect } from 'next/navigation';
import { getYard } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import { personName, yardHorses, yardPeople } from '@/lib/people';
import Book from './Book';
import type { Held, SlotFacility } from '@/lib/slots';

type Props = { params: Promise<{ yard: string }> };

export async function generateMetadata({ params }: Props) {
  const { yard: subdomain } = await params;
  const yard = await getYard(subdomain);
  return { title: yard ? `${yard.name} · Booking` : 'Yard not found' };
}

/**
 * Everything a member needs to draw the whole horizon, in two rounds.
 *
 * The bookings query is bounded by the furthest a facility looks ahead,
 * so the facilities have to come back first. In exchange the rider can
 * flick between days and facilities without another request.
 */
async function loadBooking(yardId: string, userId: string, runsIt: boolean) {
  const supabase = await supabaseServer();

  const [{ data: business }, { data: facilities }] = await Promise.all([
    supabase.from('business').select('timezone').eq('id', yardId)
      .maybeSingle<{ timezone: string }>(),
    supabase.from('facility')
      .select('id, name, kind, slot_minutes, opens_at, closes_at, min_notice_minutes, max_days_ahead')
      .eq('business_id', yardId).eq('is_active', true).order('created_at'),
  ]);

  const open = (facilities ?? []) as SlotFacility[];
  const horizon = Math.max(0, ...open.map((f) => f.max_days_ahead));
  const now = new Date();

  const { data: bookings } = await supabase
    .from('booking')
    .select('id, facility_id, user_id, horse_id, starts_at, ends_at, kind, title')
    .eq('business_id', yardId)
    .eq('status', 'confirmed')
    .gte('ends_at', now.toISOString())
    .lt('starts_at', new Date(now.getTime() + (horizon + 1) * 86_400_000).toISOString())
    .order('starts_at')
    .limit(2000);

  type Row = Omit<Held, 'mine' | 'who' | 'horse'> & {
    user_id: string;
    horse_id: string | null;
  };

  // Names are fetched only for somebody who runs the yard, so a rider's
  // browser never receives anybody else's.
  const [people, horses] = runsIt
    ? await Promise.all([yardPeople(yardId), yardHorses(yardId)])
    : [null, null];

  // The rider's own horses and name, read under row level security
  // rather than through the admin functions, so this works for anybody
  // on the yard. Retired ones come too: they are not offered for a new
  // booking, but an existing booking still has to be able to say which
  // horse it was for.
  const [{ data: ownHorses }, { data: profile }] = await Promise.all([
    supabase.from('horse').select('id, name, retired_at')
      .eq('user_id', userId).order('name'),
    supabase.from('profile').select('name').eq('user_id', userId)
      .maybeSingle<{ name: string | null }>(),
  ]);

  const own = (ownHorses ?? []) as { id: string; name: string; retired_at: string | null }[];
  const ownNames = new Map(own.map((h) => [h.id, h.name]));

  return {
    timezone: business?.timezone ?? 'Europe/London',
    facilities: open,
    now: now.toISOString(),
    myName: profile?.name?.trim() || '',
    myHorses: own.filter((h) => !h.retired_at).map((h) => ({ id: h.id, name: h.name })),
    // Whose booking it is never leaves the server as an id. A member may
    // read the whole diary, which is the point of a shared one, but a
    // rider only needs to know which are their own.
    held: ((bookings ?? []) as Row[]).map((b): Held => {
      const p = people?.get(b.user_id);
      return {
        id: b.id,
        facility_id: b.facility_id,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        kind: b.kind,
        title: b.title,
        mine: b.user_id === userId,
        // The name alone on the chip. A slot is 92px wide, so the horse
        // rides along for the hover label only.
        who: p ? personName(p) : null,
        // Their own bookings are labelled from their own horses, so a
        // rider can see which horse they put down without the yard's
        // admin-only view of everybody else's.
        horse: b.horse_id
          ? (b.user_id === userId
              ? ownNames.get(b.horse_id)
              : horses?.get(b.horse_id)?.horse) ?? null
          : null,
      };
    }),
  };
}

export default async function BookPage({ params }: Props) {
  const { yard: subdomain } = await params;
  const yard = await getYard(subdomain);
  if (!yard) notFound();

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: membership } = await supabase
    .from('membership')
    .select('role, status')
    .eq('business_id', yard.id)
    .eq('user_id', user.id)
    .maybeSingle<{ role: string; status: string }>();

  // Row level security would refuse the writes anyway. This sends them
  // back to the front door, which is the one place that explains why.
  if (membership?.status !== 'approved') redirect('/');

  const runsIt = membership.role === 'owner' || membership.role === 'admin';
  const booking = await loadBooking(yard.id, user.id, runsIt);

  // The yard's name and the way to its controls are both in the header
  // now, so this page is only the grid.
  return (
    <main className="yard is-wide">
      <Book
        yardId={yard.id}
        userId={user.id}
        timezone={booking.timezone}
        facilities={booking.facilities}
        held={booking.held}
        myHorses={booking.myHorses}
        myName={booking.myName}
        now={booking.now}
      />
    </main>
  );
}
