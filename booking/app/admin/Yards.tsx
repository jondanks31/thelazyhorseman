'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { PLANS, type PlanId } from '@/lib/plans';

export type StaffYard = {
  yard_id: string;
  yard_name: string;
  yard_subdomain: string | null;
  yard_plan: PlanId;
  yard_status: 'active' | 'dormant' | 'warned' | 'suspended' | 'released';
  yard_created: string;
  yard_address_ready: boolean;
  /** Null on an owner who never set a name, or a yard with no owner. */
  owner_name: string | null;
  owner_email: string | null;
  facility_count: number;
  rider_count: number;
};

const day = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(iso));

const planName = (id: PlanId) => PLANS.find((p) => p.id === id)?.name ?? id;

export default function Yards({ yards }: { yards: StaffYard[] }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  /** The yard being changed, and what to. One at a time on purpose. */
  const [editing, setEditing] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanId>('free');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function start(y: StaffYard) {
    setEditing(y.yard_id);
    setPlan(y.yard_plan);
    setReason('');
    setError(null);
    setNotice(null);
  }

  async function save(y: StaffYard) {
    setBusy(true);
    setError(null);

    const { error: writeError } = await supabase.rpc('platform_set_plan', {
      p_business_id: y.yard_id,
      p_plan: plan,
      p_reason: reason,
    });

    setBusy(false);
    if (writeError) {
      setError(writeError.message);
      return;
    }

    setEditing(null);
    setNotice(`${y.yard_name} is on ${planName(plan)}.`);
    router.refresh();
  }

  return (
    <section className="card">
      <div className="row" style={{ paddingTop: 0, borderBottom: 'none' }}>
        <div className="row-main">
          <h1 className="row-name" style={{ fontSize: 24 }}>Yards</h1>
          <p className="row-meta">{yards.length} IN TOTAL</p>
        </div>
      </div>

      {yards.length === 0 && <div className="empty">No yards yet.</div>}

      {yards.map((y) => {
        const open = editing === y.yard_id;
        const changed = open && plan !== y.yard_plan;

        return (
          <div className="row" key={y.yard_id}>
            <div className="row-main">
              <span className="row-name">
                {y.yard_name}{' '}
                <span className={y.yard_plan === 'free' ? 'pill off' : 'pill'}>
                  {planName(y.yard_plan)}
                </span>
                {y.yard_status !== 'active' && (
                  <span className="pill off">{y.yard_status}</span>
                )}
                {!y.yard_address_ready && <span className="pill off">Address off</span>}
              </span>

              <span className="row-meta">
                {y.yard_subdomain ?? 'NO ADDRESS'} ·{' '}
                {y.facility_count} FACILITY{y.facility_count === 1 ? '' : 'S'} ·{' '}
                {y.rider_count} RIDER{y.rider_count === 1 ? '' : 'S'} ·{' '}
                SINCE {day(y.yard_created).toUpperCase()}
              </span>

              {/* Who to email about a plan. The founding owner, not every
                  admin the yard has since added. */}
              <span className="row-meta">
                {y.owner_name ?? 'No name'}
                {y.owner_email ? ` · ${y.owner_email}` : ' · no owner'}
              </span>

              {open && (
                <div className="staff-change">
                  <select
                    aria-label={`Plan for ${y.yard_name}`}
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as PlanId)}
                  >
                    {PLANS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  {/* A yard on the top plan paying nothing is fine, so
                      long as there is a note saying it was meant. */}
                  {changed && (
                    <input
                      aria-label="Why"
                      value={reason}
                      placeholder="Why, for the record"
                      onChange={(e) => setReason(e.target.value)}
                    />
                  )}

                  <div className="row-actions">
                    <button
                      className="btn btn-small btn-quiet" type="button"
                      onClick={() => setEditing(null)} disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-small" type="button"
                      onClick={() => save(y)} disabled={busy || !changed}
                    >
                      {busy ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!open && (
              <div className="row-actions">
                <button className="btn btn-small btn-quiet" type="button" onClick={() => start(y)}>
                  Change plan
                </button>
              </div>
            )}
          </div>
        );
      })}

      {notice && <p className="field-ok" role="status">{notice}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </section>
  );
}
