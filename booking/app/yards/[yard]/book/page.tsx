import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getYard } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import Book from './Book';
import type { Held, SlotFacility } from '@/lib/slots';
import '../yard.css';

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
async function loadBooking(yardId: string, userId: string) {
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
    .select('id, facility_id, user_id, starts_at, ends_at, kind, title')
    .eq('business_id', yardId)
    .eq('status', 'confirmed')
    .gte('ends_at', now.toISOString())
    .lt('starts_at', new Date(now.getTime() + (horizon + 1) * 86_400_000).toISOString())
    .order('starts_at')
    .limit(2000);

  type Row = Omit<Held, 'mine'> & { user_id: string };

  return {
    timezone: business?.timezone ?? 'Europe/London',
    facilities: open,
    now: now.toISOString(),
    // Whose booking it is never leaves the server. A member may read the
    // whole diary, which is the point of a shared one, but the grid only
    // needs to know which are the rider's own.
    held: ((bookings ?? []) as Row[]).map((b): Held => ({
      id: b.id,
      facility_id: b.facility_id,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      kind: b.kind,
      title: b.title,
      mine: b.user_id === userId,
    })),
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
  const booking = await loadBooking(yard.id, user.id);

  return (
    <main className="yard">
      <header className="yard-head">
        <h1 className="yard-name">{yard.name}</h1>
        <p className="yard-sub">Arena booking</p>
      </header>

      <Book
        yardId={yard.id}
        userId={user.id}
        timezone={booking.timezone}
        facilities={booking.facilities}
        held={booking.held}
        now={booking.now}
      />

      {runsIt && <Link className="yard-nav" href="/admin">Yard controls</Link>}

      <p className="yard-foot">
        Runs on <a href="https://www.thelazyhorseman.com/">The Lazy Horseman</a>
      </p>
    </main>
  );
}
