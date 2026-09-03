'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import Modal from '@/components/Modal';

export type Rider = {
  membership_id: string;
  member_id: string;
  email: string;
  /** Null on accounts made before names were asked for. */
  rider_name: string | null;
  role: 'owner' | 'admin' | 'rider';
  status: 'pending' | 'approved' | 'blocked';
  joined_at: string;
  /** Their horses, worked out on the server. Retired ones left out. */
  horses: string[];
};

export type Invite = {
  id: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

const day = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso));

export default function Riders({
  yardId,
  riders,
  invites,
  joinLink,
  qrSvg,
}: {
  yardId: string;
  riders: Rider[];
  invites: Invite[];
  joinLink: string;
  qrSvg: string;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [inviting, setInviting] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const outstanding = invites.filter((i) => !i.accepted_at);

  async function invite() {
    setBusy(true);
    setError(null);
    const { error: writeError } = await supabase.from('invite').insert({
      business_id: yardId,
      email: email.trim().toLowerCase(),
      invited_by: (await supabase.auth.getUser()).data.user?.id,
    });
    setBusy(false);
    if (writeError) {
      setError(writeError.message);
      return;
    }
    setEmail('');
    setInviting(false);
    router.refresh();
  }

  async function setStatus(r: Rider, status: 'approved' | 'blocked') {
    setBusy(true);
    const { error: writeError } = await supabase
      .from('membership')
      .update({ status })
      .eq('id', r.membership_id);
    setBusy(false);
    if (writeError) setError(writeError.message);
    else router.refresh();
  }

  async function remove(r: Rider) {
    setBusy(true);
    const { error: writeError } = await supabase
      .from('membership')
      .delete()
      .eq('id', r.membership_id);
    setBusy(false);
    if (writeError) setError(writeError.message);
    else router.refresh();
  }

  async function dropInvite(i: Invite) {
    setBusy(true);
    const { error: writeError } = await supabase.from('invite').delete().eq('id', i.id);
    setBusy(false);
    if (writeError) setError(writeError.message);
    else router.refresh();
  }

  async function rotate() {
    setBusy(true);
    const { error: writeError } = await supabase.rpc('rotate_join_code', {
      p_business_id: yardId,
    });
    setBusy(false);
    if (writeError) setError(writeError.message);
    else {
      setShowCode(false);
      router.refresh();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Select the link and copy it by hand.');
    }
  }

  return (
    <>
      <section className="card">
        <div className="row" style={{ paddingTop: 0, borderBottom: 'none' }}>
          <div className="row-main">
            <h2 className="row-name" style={{ fontSize: 21 }}>On the yard</h2>
            <p className="row-meta">
              {riders.filter((r) => r.status === 'approved').length} ON
              {outstanding.length > 0 && ` · ${outstanding.length} INVITED`}
            </p>
          </div>
          <div className="row-actions">
            <button className="btn btn-small btn-quiet" type="button" onClick={() => setShowCode(true)}>
              Join code
            </button>
            <button className="btn btn-small" type="button" onClick={() => setInviting(true)}>
              Invite
            </button>
          </div>
        </div>

        {riders.map((r) => (
          <div className="row" key={r.membership_id}>
            <div className="row-main">
              <span className="row-name">
                {/* The email is the fallback, not the label. It is what an
                    admin had to read before, and often says nothing. */}
                {r.rider_name ?? r.email}{' '}
                {r.horses.length > 0 && (
                  <span className="row-horse">{r.horses.join(', ')}</span>
                )}{' '}
                {r.role !== 'rider' && (
                  <span className="pill">{r.role === 'owner' ? 'Owner' : 'Admin'}</span>
                )}
                {r.status === 'blocked' && <span className="pill off">Blocked</span>}
              </span>
              <span className="row-meta">
                {r.rider_name ? `${r.email} · ` : ''}JOINED {day(r.joined_at).toUpperCase()}
              </span>
            </div>

            {r.role === 'rider' && (
              <div className="row-actions">
                {r.status === 'blocked' ? (
                  <button
                    className="btn btn-small btn-quiet" type="button" disabled={busy}
                    onClick={() => setStatus(r, 'approved')}
                  >
                    Let back on
                  </button>
                ) : (
                  <button
                    className="btn btn-small btn-quiet" type="button" disabled={busy}
                    onClick={() => setStatus(r, 'blocked')}
                  >
                    Block
                  </button>
                )}
                <button
                  className="btn btn-small btn-quiet" type="button" disabled={busy}
                  onClick={() => remove(r)}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}

        {error && <p className="field-error" role="alert">{error}</p>}
      </section>

      {outstanding.length > 0 && (
        <section className="card">
          <div className="row" style={{ paddingTop: 0, borderBottom: 'none' }}>
            <div className="row-main">
              <h2 className="row-name" style={{ fontSize: 21 }}>Invited, not on yet</h2>
            </div>
          </div>

          {outstanding.map((i) => (
            <div className="row" key={i.id}>
              <div className="row-main">
                <span className="row-name">{i.email}</span>
                <span className="row-meta">
                  SENT {day(i.created_at).toUpperCase()} · RUNS OUT {day(i.expires_at).toUpperCase()}
                </span>
              </div>
              <div className="row-actions">
                <button
                  className="btn btn-small btn-quiet" type="button" disabled={busy}
                  onClick={() => dropInvite(i)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        busy={busy}
        error={error}
        title="Invite a rider"
        footer={
          <div className="actions">
            <button className="btn btn-quiet" type="button" onClick={() => setInviting(false)} disabled={busy}>
              Cancel
            </button>
            <button
              className="btn" type="button" onClick={invite}
              disabled={busy || !email.includes('@')}
            >
              {busy ? 'Saving…' : 'Invite'}
            </button>
          </div>
        }
      >
        <div className="field">
          <label htmlFor="invite-email">Their email</label>
          <input
            id="invite-email" type="email" value={email} placeholder="rider@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={showCode}
        onClose={() => setShowCode(false)}
        busy={busy}
        title="Your join code"
        footer={
          <div className="actions">
            <button className="btn btn-quiet" type="button" onClick={rotate} disabled={busy}>
              New code
            </button>
            <button className="btn" type="button" onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        }
      >
        <p className="sub">Print it, pin it up. Anyone who scans it is on.</p>

        {qrSvg && (
          <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        )}

        <p className="join-link">{joinLink}</p>

        <p className="field-hint">
          A new code stops the old one working. Riders already on stay on.
        </p>
      </Modal>
    </>
  );
}
