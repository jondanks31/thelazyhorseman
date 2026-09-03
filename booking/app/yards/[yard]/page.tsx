import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import Book from './Book';
import type { Held, SlotFacility } from '@/lib/slots';
import './yard.css';

type Props = { params: Promise<{ yard: string }> };

async function loadYard(subdomain: string) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .rpc('yard_by_subdomain', { p_subdomain: subdomain })
    .maybeSingle<{ id: string; name: string }>();

  if (error) throw new Error(error.message);
  return data;
}

export async function generateMetadata({ params }: Props) {
  const { yard: subdomain } = await params;
  const yard = await loadYard(subdomain);
  return {
    title: yard ? `${yard.name} · Booking` : 'Yard not found',
    description: yard ? `Book the arena at ${yard.name}.` : undefined,
  };
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

export default async function YardPage({ params }: Props) {
  const { yard: subdomain } = await params;
  const yard = await loadYard(subdomain);
  if (!yard) notFound();

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase
        .from('membership')
        .select('role, status')
        .eq('business_id', yard.id)
        .eq('user_id', user.id)
        .maybeSingle<{ role: string; status: string }>()
    : { data: null };

  const onTheYard = membership?.status === 'approved';
  const admin = onTheYard && (membership?.role === 'owner' || membership?.role === 'admin');

  const booking = onTheYard && user ? await loadBooking(yard.id, user.id) : null;

  return (
    <main className="yard">
      <header className="yard-head">
        <h1 className="yard-name">{yard.name}</h1>
        <p className="yard-sub">Arena booking</p>
      </header>

      {!user && (
        <section className="card">
          <h2 className="q">Sign in.</h2>
          <div className="actions">
            <Link className="btn" href="/sign-in">Sign in</Link>
          </div>
          <p className="field-hint">Riders join with a link or code from the yard.</p>
        </section>
      )}

      {user && !onTheYard && (
        <section className="card">
          <h2 className="q">You need an invite.</h2>
          <p className="sub">Ask {yard.name} for a link, or scan their code.</p>
        </section>
      )}

      {booking && user && (
        <Book
          yardId={yard.id}
          userId={user.id}
          timezone={booking.timezone}
          facilities={booking.facilities}
          held={booking.held}
          now={booking.now}
        />
      )}

      {admin && <Link className="yard-nav" href="/admin">Yard controls</Link>}

      <p className="yard-foot">
        Runs on <a href="https://www.thelazyhorseman.com/">The Lazy Horseman</a>
      </p>
    </main>
  );
}
