import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { claimYardDomain } from '@/lib/vercel';
import { validateSubdomain } from '@/lib/subdomain';

/**
 * Registering a yard's address with Vercel.
 *
 * On the platform host on purpose, not under the yard. A yard whose
 * address has not been registered cannot be reached at that address, so
 * a route living there could never be called to fix it. This is reached
 * from the end of the signup wizard and from the account page.
 *
 * Set VERCEL_TOKEN, VERCEL_PROJECT_ID and, on a team account,
 * VERCEL_TEAM_ID. Without them this answers notConfigured and the yard
 * is still made, which is what local work wants.
 */

type Yard = { business_id: string; subdomain: string | null; role: string; status: string };

export async function POST(request: Request) {
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  let wanted: unknown;
  try {
    wanted = (await request.json())?.subdomain;
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const check = typeof wanted === 'string' ? validateSubdomain(wanted) : null;
  if (!check?.ok) {
    return NextResponse.json({ error: 'That is not a yard address.' }, { status: 400 });
  }
  const subdomain = check.value;

  // my_yards() reads auth.uid() itself, so this is the whole of the
  // authorisation: a name that is not one of theirs is not registered.
  // Without it, anybody signed in could point any subdomain at us.
  const { data } = await supabase.rpc('my_yards');
  const mine = ((data ?? []) as Yard[]).find(
    (y) => y.subdomain === subdomain
      && y.status === 'approved'
      && (y.role === 'owner' || y.role === 'admin'),
  );

  if (!mine) {
    return NextResponse.json({ error: 'That is not your yard.' }, { status: 403 });
  }

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'thelazyhorseman.com';
  const state = await claimYardDomain(`${subdomain}.${root}`);

  // Only "live" means a rider following the link gets a page. Anything
  // else leaves the prompt on the account page where the owner can try
  // again, so the flag follows the truth rather than the attempt.
  //
  // No token means nothing was learned, so nothing is written. Otherwise
  // every yard made on a machine without one would be marked broken.
  if (state !== 'notConfigured') {
    const { error: markError } = await supabase.rpc('set_domain_ready', {
      p_business_id: mine.business_id,
      p_ready: state === 'live',
    });
    if (markError) console.error('could not record domain state', markError.message);
  }

  return NextResponse.json({ ok: true, state, host: `${subdomain}.${root}` });
}
