import { NextResponse } from 'next/server';
import { getYard } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import { PLANS, planById, type PlanId } from '@/lib/plans';

/**
 * ═══════════════════════════════════════════════════════════════
 *  THE STRIPE SEAM
 * ═══════════════════════════════════════════════════════════════
 *
 * Everything either side of this is built: the yard hits its facility
 * allowance, sees what the next plan costs, picks one, and lands here
 * with an authorised, validated request for a specific plan.
 *
 * What is missing is the middle. To finish it:
 *
 *   1. npm i stripe, and put STRIPE_SECRET_KEY in the environment
 *      (server only, never NEXT_PUBLIC_).
 *   2. Create a Price in Stripe for each paid plan and put the price
 *      ids in STRIPE_PRICE_YARD and STRIPE_PRICE_CENTRE.
 *   3. Replace the block marked below with a Checkout Session and
 *      return its url. The client already redirects to whatever url
 *      comes back.
 *   4. Add a webhook route for checkout.session.completed and
 *      customer.subscription.updated/deleted that writes
 *      business.plan and business.stripe_customer_id. The webhook is
 *      the only thing that may change a plan; do not trust the
 *      browser's return from Checkout, which a user can fake by
 *      visiting the success url directly.
 *
 * Note for the webhook: dropping a yard down a plan does not switch its
 * extra facilities off. See the tail of migration 0010.
 */

const PAID: PlanId[] = ['yard', 'centre'];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ yard: string }> },
) {
  const { yard } = await params;

  const found = await getYard(yard);
  if (!found) {
    return NextResponse.json({ error: 'No such yard.' }, { status: 404 });
  }

  const supabase = await supabaseServer();

  // requireAdmin() redirects, which is right for a page and wrong for a
  // fetch, so the same check is made here and answered with a status.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('membership')
    .select('role, status')
    .eq('business_id', found.id)
    .eq('user_id', user.id)
    .maybeSingle<{ role: string; status: string }>();

  const isAdmin =
    membership?.status === 'approved' &&
    (membership.role === 'owner' || membership.role === 'admin');

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Only the yard can change the plan.' },
      { status: 403 },
    );
  }

  let wanted: unknown;
  try {
    wanted = (await request.json())?.plan;
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  if (typeof wanted !== 'string' || !PAID.includes(wanted as PlanId)) {
    return NextResponse.json({ error: 'No such plan.' }, { status: 400 });
  }
  const target = planById(wanted as PlanId);

  const { data: business } = await supabase
    .from('business')
    .select('plan')
    .eq('id', found.id)
    .maybeSingle<{ plan: PlanId }>();

  const current = business?.plan ?? 'free';
  const rank = (id: PlanId) => PLANS.findIndex((p) => p.id === id);

  if (rank(target.id) <= rank(current)) {
    // Downgrades and no-ops are not a Checkout flow. They cancel or
    // amend a subscription, which is different work, so they are
    // refused here rather than quietly charging somebody again.
    return NextResponse.json(
      { error: 'Get in touch and we will sort it.' },
      { status: 409 },
    );
  }

  // ── Stripe goes here ─────────────────────────────────────────
  // const session = await stripe.checkout.sessions.create({ ... });
  // return NextResponse.json({ url: session.url });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      {
        error: 'notConfigured',
        plan: target.id,
        planName: target.name,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { error: 'Card payment is not switched on yet.' },
    { status: 503 },
  );
}
