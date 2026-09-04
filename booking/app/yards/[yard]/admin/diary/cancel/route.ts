import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminOrReason, getYard } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import { yardUrl } from '@/lib/tenant';
import { personName, yardHorses, yardPeople } from '@/lib/people';
import { sendEmail } from '@/lib/email';
import { cancelledNotice } from '@/lib/notices';

/**
 * The yard cancelling something in its diary, and telling the rider.
 *
 * A yard can always cancel a rider's slot; a clinic goes in, the school
 * floods, somebody needs the arena. What was missing is that the rider
 * found out by turning up. That is a correctness problem rather than a
 * convenience one, which is why cancelling moved off the browser and
 * in here: the rider's email address is not readable from a rider's
 * own screen, and the sending key must never reach a browser at all.
 *
 * The cancel is what matters. It happens first and stands whether or
 * not the email goes, and the reply says which so the yard knows
 * whether to pick up the phone.
 */

type Booking = {
  id: string;
  user_id: string;
  horse_id: string | null;
  facility_id: string;
  starts_at: string;
  kind: 'slot' | 'event';
  status: 'confirmed' | 'cancelled';
};

/** Sent, tried and failed, or nobody to tell. */
type Notified = 'sent' | 'failed' | 'none';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ yard: string }> },
) {
  const { yard } = await params;

  const found = await getYard(yard);
  if (!found) {
    return NextResponse.json({ error: 'No such yard.' }, { status: 404 });
  }

  const who = await adminOrReason(found.id);
  if (!who.ok) {
    return NextResponse.json({ error: who.error }, { status: who.status });
  }

  let bookingId: unknown;
  try {
    bookingId = (await request.json())?.bookingId;
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  if (typeof bookingId !== 'string') {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const supabase = await supabaseServer();

  const { data: booking } = await supabase
    .from('booking')
    .select('id, user_id, horse_id, facility_id, starts_at, kind, status')
    .eq('id', bookingId)
    .eq('business_id', found.id)
    .maybeSingle<Booking>();

  if (!booking) {
    return NextResponse.json({ error: 'That booking has gone.' }, { status: 404 });
  }

  if (booking.status === 'confirmed') {
    const { error } = await supabase
      .from('booking')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', booking.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  // Nobody to tell when the yard cancels its own clinic, when an admin
  // drops their own slot, or when the time has already been and gone.
  const worthTelling =
    booking.kind === 'slot' &&
    booking.user_id !== who.user.id &&
    new Date(booking.starts_at) > new Date();

  if (!worthTelling) {
    return NextResponse.json({ ok: true, notified: 'none' as Notified, who: null });
  }

  const [people, horses, { data: business }, { data: facility }] = await Promise.all([
    yardPeople(found.id),
    yardHorses(found.id),
    supabase.from('business').select('timezone').eq('id', found.id)
      .maybeSingle<{ timezone: string }>(),
    supabase.from('facility').select('name').eq('id', booking.facility_id)
      .maybeSingle<{ name: string }>(),
  ]);

  const rider = people.get(booking.user_id);
  if (!rider) {
    // They have left the yard since booking, so there is no address to
    // reach them at. The cancel still stands.
    return NextResponse.json({ ok: true, notified: 'none' as Notified, who: null });
  }

  const canceller = people.get(who.user.id);

  const result = await sendEmail(
    rider.email,
    cancelledNotice({
      yardName: found.name,
      cancelledBy: canceller ? personName(canceller) : found.name,
      facilityName: facility?.name ?? 'the arena',
      horseName: (booking.horse_id && horses.get(booking.horse_id)?.horse) || null,
      startsAt: booking.starts_at,
      timezone: business?.timezone ?? 'Europe/London',
      bookUrl: `${yardUrl(yard, (await headers()).get('host'))}/book`,
    }),
    who.user.email,
  );

  return NextResponse.json({
    ok: true,
    notified: (result.sent ? 'sent' : 'failed') satisfies Notified,
    who: personName(rider),
  });
}
