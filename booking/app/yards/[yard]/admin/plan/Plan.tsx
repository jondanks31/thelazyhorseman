'use client';

import { useState } from 'react';
import {
  PLANS,
  allowanceLabel,
  planById,
  priceLabel,
  type PlanId,
} from '@/lib/plans';

export default function Plan({
  current,
  used,
}: {
  current: PlanId;
  used: number;
}) {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [holding, setHolding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plan = planById(current);
  const allowance = plan.facilities;
  const atLimit = allowance !== null && used >= allowance;

  async function choose(id: PlanId) {
    setBusy(id);
    setError(null);
    setHolding(null);

    try {
      const res = await fetch('/admin/plan/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: id }),
      });
      const body = await res.json().catch(() => ({}));

      // Once Stripe is wired up the route answers with a Checkout url
      // and this is the whole of the client's job.
      if (res.ok && body.url) {
        window.location.href = body.url;
        return;
      }

      if (body.error === 'notConfigured') {
        setHolding(body.planName ?? planById(id).name);
        return;
      }

      setError(body.error ?? 'That did not work. Try again in a minute.');
    } catch {
      setError('Could not reach us. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className="card">
        <div className="row" style={{ paddingTop: 0, borderBottom: 'none' }}>
          <div className="row-main">
            <h2 className="row-name" style={{ fontSize: 21 }}>
              You are on {plan.name}
            </h2>
            <p className="row-meta">
              {allowance === null
                ? `${used} ${used === 1 ? 'FACILITY' : 'FACILITIES'} ON, NO LIMIT`
                : `${used} OF ${allowance} ${allowance === 1 ? 'FACILITY' : 'FACILITIES'} USED`}
            </p>
          </div>
          <span className={atLimit ? 'pill off' : 'pill'}>
            {atLimit ? 'Full' : 'Room to spare'}
          </span>
        </div>

        {allowance !== null && (
          <div
            className="meter"
            role="img"
            aria-label={`${used} of ${allowance} facilities used`}
          >
            {Array.from({ length: allowance }, (_, i) => (
              <span key={i} className={i < used ? 'meter-pip on' : 'meter-pip'} />
            ))}
          </div>
        )}

        {atLimit && (
          <p className="sub">
            Every facility you are allowed is switched on. To add another, move
            up a plan.
          </p>
        )}
      </section>

      <div className="plans">
        {PLANS.map((p) => {
          const isCurrent = p.id === current;
          const isDown = PLANS.indexOf(p) < PLANS.findIndex((x) => x.id === current);

          return (
            <section
              className={isCurrent ? 'plan-card is-current' : 'plan-card'}
              key={p.id}
            >
              <div className="plan-head">
                <h3 className="plan-name">{p.name}</h3>
                {isCurrent && <span className="pill">Yours</span>}
              </div>

              <p className="plan-price">
                {priceLabel(p.pence)}
                {p.pence > 0 && <span className="plan-per">/month</span>}
              </p>

              <p className="plan-blurb">{p.blurb}</p>

              <ul className="plan-list">
                {p.includes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>

              <p className="plan-allow">{allowanceLabel(p.facilities)}</p>

              {isCurrent ? (
                <button className="btn btn-quiet" type="button" disabled>
                  Your plan
                </button>
              ) : isDown ? (
                <a className="btn btn-quiet" href="mailto:Hello@thelazyhorseman.com?subject=Changing%20our%20plan">
                  Talk to us
                </a>
              ) : (
                <button
                  className="btn"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => choose(p.id)}
                >
                  {busy === p.id ? 'One moment…' : `Move to ${p.name}`}
                </button>
              )}
            </section>
          );
        })}
      </div>

      {holding && (
        <section className="card">
          <h2 className="q" style={{ fontSize: 24 }}>Nearly.</h2>
          <p className="sub">
            Card payment is not switched on yet, so {holding} cannot be bought
            in here today. Email us and we will put you on it, and you will not
            pay for anything until it is running.
          </p>
          <div className="actions">
            <a
              className="btn"
              href={`mailto:Hello@thelazyhorseman.com?subject=${encodeURIComponent(`Moving to ${holding}`)}`}
            >
              Email us
            </a>
            <button className="btn btn-quiet" type="button" onClick={() => setHolding(null)}>
              Not now
            </button>
          </div>
        </section>
      )}

      {error && (
        <section className="card">
          <p className="field-error" role="alert">{error}</p>
        </section>
      )}
    </>
  );
}
