import { notFound } from 'next/navigation';
import { getYard } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import YardHeader, { type Role } from '@/components/YardHeader';
import LegalLinks from '@/components/LegalLinks';
import './yard.css';

type Props = { children: React.ReactNode; params: Promise<{ yard: string }> };

/**
 * Wraps every screen on a yard's own address, so the header is defined
 * once instead of on each page.
 *
 * It renders nothing for a stranger. Sign in and the join links live
 * under here too, and a nav bar full of places they cannot go would be
 * both useless and a hint about what exists.
 */
export default async function YardLayout({ children, params }: Props) {
  const { yard: subdomain } = await params;
  const found = await getYard(subdomain);
  if (!found) notFound();

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase
        .from('membership')
        .select('role, status')
        .eq('business_id', found.id)
        .eq('user_id', user.id)
        .maybeSingle<{ role: Role; status: string }>()
    : { data: null };

  // Their own name, which they can read on their own profile without
  // any of the admin machinery. Falls back to the email until set.
  const { data: profile } = user
    ? await supabase
        .from('profile')
        .select('name')
        .eq('user_id', user.id)
        .maybeSingle<{ name: string | null }>()
    : { data: null };

  const onTheYard = membership?.status === 'approved';

  return (
    <div className="shell">
      {user && onTheYard && (
        <YardHeader
          yardName={found.name}
          personName={profile?.name?.trim() || user.email || 'You'}
          role={membership.role}
        />
      )}
      {children}
      <LegalLinks />
    </div>
  );
}
