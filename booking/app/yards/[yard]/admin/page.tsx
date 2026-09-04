import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getYard, requireAdmin } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';

type Props = { params: Promise<{ yard: string }> };

export async function generateMetadata({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  return { title: found ? `Overview · ${found.name}` : 'Overview' };
}

export default async function AdminOverview({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();
  await requireAdmin(yard, found.id);

  const supabase = await supabaseServer();

  const [facilities, riders, pending] = await Promise.all([
    supabase.from('facility').select('id', { count: 'exact', head: true })
      .eq('business_id', found.id).eq('is_active', true),
    supabase.from('membership').select('id', { count: 'exact', head: true })
      .eq('business_id', found.id).eq('status', 'approved'),
    // Nobody waits for approval any more, so what is outstanding is
    // invites that have been sent and not taken up.
    supabase.from('invite').select('id', { count: 'exact', head: true })
      .eq('business_id', found.id).is('accepted_at', null),
  ]);

  return (
    <>
      <div>
        {/* The yard's name is in the header now, so this says where you
            are instead of saying it twice. */}
        <h1 className="page-h">Overview</h1>
        <p className="page-lead">
          Riders book at <strong>{yard}.thelazyhorseman.com</strong>.
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
          <span className="tile-label">Invites out</span>
          <span className="tile-note">
            <Link href="/admin/riders">Invite someone</Link>
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
