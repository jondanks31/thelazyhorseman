import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabaseServer } from './supabase-server';

export type Yard = { id: string; name: string };

/** Resolves a yard from its subdomain, or null when there is none. */
export async function getYard(subdomain: string): Promise<Yard | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .rpc('yard_by_subdomain', { p_subdomain: subdomain })
    .maybeSingle<Yard>();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Whether whoever is asking runs this yard, without deciding what to do
 * about it. A page redirects, a route handler answers with a status,
 * and both need the same question asked the same way.
 */
async function adminOf(yardId: string): Promise<
  | { user: User; role: string }
  | { user: User | null; role: null }
> {
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null };

  const { data: membership } = await supabase
    .from('membership')
    .select('role, status')
    .eq('business_id', yardId)
    .eq('user_id', user.id)
    .maybeSingle<{ role: string; status: string }>();

  const isAdmin =
    membership?.status === 'approved' &&
    (membership.role === 'owner' || membership.role === 'admin');

  return isAdmin ? { user, role: membership.role } : { user, role: null };
}

/**
 * Guards the admin area. RLS already stops a non-admin reading or
 * writing anything, so this exists to send people somewhere sensible
 * rather than showing them an empty page they cannot act on.
 */
export async function requireAdmin(subdomain: string, yardId: string) {
  const who = await adminOf(yardId);

  if (!who.user) redirect(`/sign-in?next=${encodeURIComponent('/admin')}`);
  if (!who.role) redirect('/');

  return { user: who.user, role: who.role };
}

/**
 * The same guard for a route handler. Redirecting a fetch is no use to
 * the browser, so this hands back a status and a sentence to show.
 */
export async function adminOrReason(yardId: string): Promise<
  | { ok: true; user: User; role: string }
  | { ok: false; status: 401 | 403; error: string }
> {
  const who = await adminOf(yardId);

  if (!who.user) return { ok: false, status: 401, error: 'Sign in first.' };
  if (!who.role) return { ok: false, status: 403, error: 'Only the yard can do that.' };

  return { ok: true, user: who.user, role: who.role };
}
