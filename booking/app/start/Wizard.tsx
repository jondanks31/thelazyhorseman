'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { REJECTION_MESSAGE, suggestSubdomain, validateSubdomain } from '@/lib/subdomain';
import type { DomainState } from '@/lib/vercel';
// One list, shared with the yard's own Facilities screen. The wizard
// had its own copy and was two kinds behind it.
import { FACILITY_KINDS, kindLabel } from '@/lib/kinds';
import CopyButton from '@/components/CopyButton';

/* One question per screen. The whole point is that a yard owner on a
   phone in a tack room never sees a wall of boxes. */
const STEPS = ['Account', 'Yard', 'Address', 'Arena'] as const;
type StepName = (typeof STEPS)[number];

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'invalid';

export default function Wizard() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);

  /**
   * The account behind this browser, if there is one: 'checking' until
   * Supabase answers, then their email, or null for a stranger.
   *
   * Without this the wizard asked for an email and a password that had
   * just been given. Confirm your address, follow the link back, and
   * the first thing you met was "First, an account." again. It happens
   * to every single owner who signs up, and to anybody setting up a
   * second yard.
   */
  const [account, setAccount] = useState<'checking' | string | null>('checking');

  const [yardName, setYardName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [subdomainTouched, setSubdomainTouched] = useState(false);
  const [availability, setAvailability] = useState<Availability>('idle');
  const [availabilityNote, setAvailabilityNote] = useState('');

  const [facilityKind, setFacilityKind] = useState<string>('arena');
  /**
   * Named after what it is until somebody says otherwise, which for
   * most yards is the whole answer: an outdoor arena is called the
   * outdoor arena. Set from the chosen kind rather than watched by an
   * effect, so there is no render where the two disagree.
   */
  const [facilityName, setFacilityName] = useState(kindLabel('arena'));
  const [facilityNameTouched, setFacilityNameTouched] = useState(false);

  const [done, setDone] = useState<{ subdomain: string; domain: DomainState } | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the heading on every step, or a keyboard user is left
  // at the top of the document after each Next.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step, done]);

  // Somebody already signed in has done the account step, whether they
  // have just confirmed their address or are back for a second yard.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const who = data.user?.email ?? null;
      setAccount(who);
      if (who) setStep((s) => Math.max(s, 1));
    });
  }, [supabase]);

  // Suggest the address from the yard name until the owner edits it.
  useEffect(() => {
    if (!subdomainTouched) setSubdomain(suggestSubdomain(yardName));
  }, [yardName, subdomainTouched]);

  // Debounced availability check against the database, so a name that
  // passes the local rules but is already claimed is caught here rather
  // than at the very end.
  useEffect(() => {
    if (step !== 2) return;

    const local = validateSubdomain(subdomain);
    if (!local.ok) {
      setAvailability(subdomain.length ? 'invalid' : 'idle');
      setAvailabilityNote(subdomain.length ? REJECTION_MESSAGE[local.reason] : '');
      return;
    }

    setAvailability('checking');
    setAvailabilityNote('');
    const timer = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc('subdomain_available', {
        candidate: local.value,
      });
      if (rpcError) {
        setAvailability('idle');
        setAvailabilityNote('');
        return;
      }
      setAvailability(data ? 'free' : 'taken');
      setAvailabilityNote(data ? 'Yours if you want it.' : 'Somebody has that one.');
    }, 350);

    return () => clearTimeout(timer);
  }, [subdomain, step, supabase]);

  const canContinue = (): boolean => {
    switch (STEPS[step] as StepName) {
      case 'Account':
        return (
          fullName.trim().length >= 2 &&
          /.+@.+\..+/.test(email) &&
          password.length >= 8
        );
      case 'Yard':
        return yardName.trim().length >= 2;
      case 'Address':
        return availability === 'free';
      case 'Arena':
        return facilityName.trim().length >= 1;
    }
  };

  const createAccount = useCallback(async () => {
    // The name rides along as user metadata because there is no session
    // yet to write a profile row with. A trigger copies it across the
    // moment the account exists. See migration 0016.
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: fullName.trim() },
        // Back to the wizard, not to whatever SITE_URL happens to be.
        // Landing on the front door sent a brand new owner to "You are
        // not on a yard", and the way out of that started the whole
        // thing again. Arriving here, the session check picks them up
        // at the yard step.
        emailRedirectTo: `${window.location.origin}/start`,
      },
    });
    if (data?.session) return;

    // No session means one of two things, and Supabase deliberately
    // will not say which: either confirmation is pending, or this email
    // already has an account. It returns a user with no session in both
    // cases so that signup cannot be used to enumerate addresses.
    //
    // Trying to sign in tells them apart. It succeeds for somebody
    // coming back after confirming, and fails while confirmation is
    // still outstanding.
    const { data: signIn } = await supabase.auth.signInWithPassword({ email, password });
    if (signIn?.session) return;

    // Anything signUp actually complained about is a real problem, a
    // rejected address or a refused password, and has to be shown.
    // Only a clean signUp that yielded no session means confirmation.
    if (authError) throw new Error(authError.message);

    // Genuinely waiting on a confirmation. The account step comes first
    // precisely so this interruption costs only an email and a
    // password, never a half-filled yard.
    setNeedsConfirm(true);
    throw new Error('CONFIRM');
  }, [fullName, email, password, supabase]);

  const finish = useCallback(async () => {
    const { data: businessId, error: yardError } = await supabase.rpc('create_yard', {
      p_name: yardName.trim(),
      p_subdomain: subdomain,
    });
    if (yardError) throw new Error(yardError.message);

    const { error: facilityError } = await supabase.from('facility').insert({
      business_id: businessId,
      name: facilityName.trim(),
      kind: facilityKind,
    });
    if (facilityError) throw new Error(facilityError.message);

    // The address is not reachable until Vercel has it, so this is part
    // of making a yard rather than an afterthought. It is allowed to
    // fail: the yard exists either way, and the account page offers to
    // try again. Throwing here would tell somebody their yard had not
    // been made when it had.
    let domain: DomainState = 'failed';
    try {
      const res = await fetch('/start/domain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subdomain }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.state) domain = body.state;
    } catch {
      /* left as failed */
    }

    setDone({ subdomain, domain });
  }, [facilityKind, facilityName, subdomain, supabase, yardName]);

  /**
   * They say they have opened the link. Signing in is the only way to
   * find out, and it leaves them signed in when it works, which is
   * exactly what the next step needs.
   */
  async function carryOn() {
    setBusy(true);
    setError(null);

    const { data } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (!data?.session) {
      setError('Not confirmed yet. Open the link in that email, then try again.');
      return;
    }

    setAccount(data.session.user.email ?? email);
    setNeedsConfirm(false);
    setStep(1);
  }

  async function next() {
    setError(null);
    setBusy(true);
    try {
      if (STEPS[step] === 'Account') await createAccount();
      else if (STEPS[step] === 'Arena') {
        await finish();
        return;
      }
      setStep((s) => s + 1);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      if (message !== 'CONFIRM') setError(message);
    } finally {
      setBusy(false);
    }
  }

  // Held back rather than flashing "First, an account." at somebody who
  // is signed in and about to skip straight past it.
  if (account === 'checking') {
    return (
      <section className="card">
        <h1 ref={headingRef} tabIndex={-1} className="q">One moment.</h1>
      </section>
    );
  }

  if (needsConfirm) {
    return (
      <section className="card">
        <h1 ref={headingRef} tabIndex={-1} className="q">Check your email</h1>
        <p className="sub">
          We have sent a link to <strong>{email}</strong>. Open it, come back to this
          page, and carry on where you left off.
        </p>

        {error && <p className="field-error" role="alert">{error}</p>}

        {/* This used to be the end of the road. Confirming happened in
            another tab, nothing here noticed, and the way back through
            the front door started the whole wizard again. */}
        <div className="actions">
          <button
            type="button" className="btn btn-quiet" disabled={busy}
            onClick={() => { setNeedsConfirm(false); setError(null); }}
          >
            Wrong address
          </button>
          <button type="button" className="btn" disabled={busy} onClick={carryOn}>
            {busy ? 'Checking…' : 'Done that, carry on'}
          </button>
        </div>
      </section>
    );
  }

  if (done) {
    // Handing over a link that does not load yet is worse than saying
    // so. Certificates take a minute or two, and a registration that
    // did not happen at all has to be visible rather than silent.
    const live = done.domain === 'live' || done.domain === 'notConfigured';

    const address = `${done.subdomain}.thelazyhorseman.com`;
    const url = `https://${address}`;

    return (
      <section className="card">
        <h1 ref={headingRef} tabIndex={-1} className="q">That is the yard set up.</h1>
        <p className="sub">Your riders go here.</p>

        {/* A link only once the address actually resolves. Sending
            somebody to a certificate that is still being issued is
            worse than making them wait a minute. */}
        {live ? (
          <a className="done-url" href={url}>{address}</a>
        ) : (
          <p className="done-url">{address}</p>
        )}

        <div className="actions">
          <CopyButton value={url} label="Copy address" />
          {live && <a className="btn btn-quiet" href={url}>Open the yard</a>}
        </div>

        {live ? (
          <p className="sub">
            Nobody can book until you invite them, so share it whenever you are ready.
          </p>
        ) : done.domain === 'pending' ? (
          <p className="field-hint">
            Give the address a minute or two to come alive before you send it round.
          </p>
        ) : (
          <p className="field-error" role="alert">
            The address is not switched on yet. Open Your yards and press Set up address.
          </p>
        )}
      </section>
    );
  }

  const current = STEPS[step] as StepName;

  return (
    <section className="card">
      <ol className="steps" aria-label="Progress">
        {STEPS.map((name, i) => (
          <li
            key={name}
            className={i === step ? 'on' : i < step ? 'past' : ''}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="sr">{i < step ? 'Completed: ' : i === step ? 'Current: ' : ''}</span>
            {name}
          </li>
        ))}
      </ol>

      {/* Says whose yard this is about to be, and answers the question
          somebody arriving back from a confirmation email would
          otherwise have to guess at. */}
      {account && (
        <p className="field-hint">
          Signed in as <strong>{account}</strong>.
        </p>
      )}

      {current === 'Account' && (
        <>
          <h1 ref={headingRef} tabIndex={-1} className="q">First, an account.</h1>
          <p className="sub">This is yours, not the yard&rsquo;s. Riders get their own later.</p>
          <div className="field">
            <label htmlFor="full-name">Your name</label>
            <input
              id="full-name" type="text" autoComplete="name" value={fullName}
              placeholder="Kate Fielding"
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="email">Your email</label>
            <input
              id="email" type="email" autoComplete="email" value={email}
              placeholder="you@youryard.co.uk"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">A password</label>
            <input
              id="password" type="password" autoComplete="new-password" value={password}
              placeholder="At least eight characters"
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="field-hint">Eight characters or more. Nothing clever required.</p>
          </div>
        </>
      )}

      {current === 'Yard' && (
        <>
          <h1 ref={headingRef} tabIndex={-1} className="q">What is the yard called?</h1>
          <p className="sub">However your riders say it. You can change this later.</p>
          <div className="field">
            <label htmlFor="yard">Yard name</label>
            <input
              id="yard" type="text" value={yardName} placeholder="Manor Farm Livery"
              onChange={(e) => setYardName(e.target.value)}
            />
          </div>
        </>
      )}

      {current === 'Address' && (
        <>
          <h1 ref={headingRef} tabIndex={-1} className="q">Pick your address.</h1>
          <p className="sub">This is where your riders go to book. Short is better.</p>
          <div className="field">
            <label htmlFor="sub">Your address</label>
            <div className="addr-row">
              <input
                id="sub" type="text" value={subdomain} spellCheck={false}
                autoCapitalize="none" autoCorrect="off"
                aria-invalid={availability === 'taken' || availability === 'invalid'}
                aria-describedby="sub-note"
                onChange={(e) => { setSubdomainTouched(true); setSubdomain(e.target.value.toLowerCase()); }}
              />
              <span className="addr-suffix">.thelazyhorseman.com</span>
            </div>
            <p
              id="sub-note"
              className={
                availability === 'free' ? 'field-ok'
                  : availability === 'taken' || availability === 'invalid' ? 'field-error'
                    : 'field-hint'
              }
              role="status"
            >
              {availability === 'checking' ? 'Checking…' : availabilityNote || 'Letters, numbers and hyphens.'}
            </p>
          </div>
        </>
      )}

      {current === 'Arena' && (
        <>
          <h1 ref={headingRef} tabIndex={-1} className="q">What can they book?</h1>
          <p className="sub">Just the first one. Add the rest once you are in.</p>
          <div className="field">
            <label htmlFor="fac">What is it called?</label>
            <input
              id="fac" type="text" value={facilityName} placeholder="Indoor school"
              onChange={(e) => {
                setFacilityNameTouched(true);
                setFacilityName(e.target.value);
              }}
            />
          </div>
          <div className="field">
            <label id="kind-label">What sort</label>
            <div className="choices" role="group" aria-labelledby="kind-label">
              {FACILITY_KINDS.map((k) => (
                <button
                  key={k.value} type="button" className="choice"
                  aria-pressed={facilityKind === k.value}
                  onClick={() => {
                    setFacilityKind(k.value);
                    // "Something else" is not a name, so picking it
                    // clears the box rather than filling it with that.
                    if (!facilityNameTouched) {
                      setFacilityName(k.value === 'other' ? '' : k.label);
                    }
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {error && <p className="field-error" role="alert">{error}</p>}

      <div className="actions">
        {/* Back never reaches the account step once there is an account.
            There is nothing to do there and no way to undo it. */}
        {step > (account ? 1 : 0) && (
          <button type="button" className="btn btn-quiet" onClick={() => { setError(null); setStep((s) => s - 1); }} disabled={busy}>
            Back
          </button>
        )}
        <button type="button" className="btn" onClick={next} disabled={!canContinue() || busy}>
          {busy ? 'One moment…' : current === 'Arena' ? 'Open the yard' : 'Next'}
        </button>
      </div>
    </section>
  );
}
