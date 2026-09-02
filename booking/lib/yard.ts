import { redirect } from 'next/navigation';
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
 * Guards the admin area. RLS already stops a non-admin reading or
 * writing anything, so this exists to send people somewhere sensible
 * rather than showing them an empty page they cannot act on.
 */
export async function requireAdmin(subdomain: string, yardId: string) {
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent('/admin')}`);

  const { data: membership } = await supabase
    .from('membership')
    .select('role, status')
    .eq('business_id', yardId)
    .eq('user_id', user.id)
    .maybeSingle<{ role: string; status: string }>();

  const isAdmin =
    membership?.status === 'approved' &&
    (membership.role === 'owner' || membership.role === 'admin');

  if (!isAdmin) redirect('/');

  return { user, role: membership.role };
}
