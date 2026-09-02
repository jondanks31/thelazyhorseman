import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getYard, requireAdmin } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';

type Props = { params: Promise<{ yard: string }> };

export default async function AdminOverview({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();
  await requireAdmin(yard, found.id);

  const supabase = await supabaseServer();

  const [facilities, riders, pending, business] = await Promise.all([
    supabase.from('facility').select('id', { count: 'exact', head: true })
      .eq('business_id', found.id).eq('is_active', true),
    supabase.from('membership').select('id', { count: 'exact', head: true })
      .eq('business_id', found.id).eq('status', 'approved'),
    supabase.from('membership').select('id', { count: 'exact', head: true })
      .eq('business_id', found.id).eq('status', 'pending'),
    supabase.from('business').select('join_policy').eq('id', found.id)
      .maybeSingle<{ join_policy: string }>(),
  ]);

  const openToRequests = business.data?.join_policy === 'request';

  return (
    <>
      <div>
        <h1 className="admin-h">{found.name}</h1>
        <p className="admin-lead">
          Riders book at <strong>{yard}.thelazyhorseman.com</strong>. Put it on the
          noticeboard and in the group chat.
        </p>
      </div>

      <div className="tiles">
        <div className="tile">
          <span className="tile-num">{facilities.count ?? 0}</span>
          <span className="tile-label">Facilities on</span>
          <span className="tile-note">
            <Link href="/admin/facilities">Add or change one</Link>
          </span>
        </div>
        <div className="tile">
          <span className="tile-num">{riders.count ?? 0}</span>
          <span className="tile-label">Riders</span>
          <span className="tile-note">Approved and able to book.</span>
        </div>
        <div className="tile">
          <span className="tile-num">{pending.count ?? 0}</span>
          <span className="tile-label">Waiting on you</span>
          <span className="tile-note">
            {openToRequests ? 'Anyone with the link can ask.' : 'Invite only, so nobody can ask.'}
          </span>
        </div>
      </div>

      {(facilities.count ?? 0) === 0 && (
        <section className="card">
          <h2 className="q" style={{ fontSize: 24 }}>Nothing can be booked yet.</h2>
          <p className="sub">
            Add at least one facility and riders will have something to take a slot on.
          </p>
          <div className="actions">
            <Link className="btn" href="/admin/facilities">Add a facility</Link>
          </div>
        </section>
      )}
    </>
  );
}
