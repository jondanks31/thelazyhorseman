'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { REJECTION_MESSAGE, suggestSubdomain, validateSubdomain } from '@/lib/subdomain';

/* One question per screen. The whole point is that a yard owner on a
   phone in a tack room never sees a wall of boxes. */
const STEPS = ['Account', 'Yard', 'Address', 'Arena'] as const;
type StepName = (typeof STEPS)[number];

const FACILITY_KINDS = [
  { value: 'arena', label: 'Outdoor arena' },
  { value: 'school', label: 'Indoor school' },
  { value: 'horsewalker', label: 'Horsewalker' },
  { value: 'lunge_pen', label: 'Lunge pen' },
  { value: 'gallops', label: 'Gallops' },
  { value: 'other', label: 'Something else' },
] as const;

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'invalid';

export default function Wizard() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const [yardName, setYardName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [subdomainTouched, setSubdomainTouched] = useState(false);
  const [availability, setAvailability] = useState<Availability>('idle');
  const [availabilityNote, setAvailabilityNote] = useState('');

  const [facilityName, setFacilityName] = useState('');
  const [facilityKind, setFacilityKind] = useState<string>('arena');

  const [done, setDone] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the heading on every step, or a keyboard user is left
  // at the top of the document after each Next.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step, done]);

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
        return /.+@.+\..+/.test(email) && password.length >= 8;
      case 'Yard':
        return yardName.trim().length >= 2;
      case 'Address':
        return availability === 'free';
      case 'Arena':
        return facilityName.trim().length >= 1;
    }
  };

  const createAccount = useCallback(async () => {
    const { data, error: authError } = await supabase.auth.signUp({ email, password });
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
  }, [email, password, supabase]);

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

    setDone(subdomain);
  }, [facilityKind, facilityName, subdomain, supabase, yardName]);

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

  if (needsConfirm) {
    return (
      <section className="card">
        <h1 ref={headingRef} tabIndex={-1} className="q">Check your email</h1>
        <p className="sub">
          We have sent a link to <strong>{email}</strong>. Open it, come back here, and
          you can finish setting the yard up.
        </p>
      </section>
    );
  }

  if (done) {
    return (
      <section className="card">
        <h1 ref={headingRef} tabIndex={-1} className="q">That is the yard set up.</h1>
        <p className="sub">Your riders go here. Put it on the noticeboard and in the group chat.</p>
        <p className="done-url">{done}.thelazyhorseman.com</p>
        <p className="sub">
          Nobody can book until you approve them, so share it whenever you are ready.
        </p>
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

      {current === 'Account' && (
        <>
          <h1 ref={headingRef} tabIndex={-1} className="q">First, an account.</h1>
          <p className="sub">This is yours, not the yard&rsquo;s. Riders get their own later.</p>
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
              onChange={(e) => setFacilityName(e.target.value)}
            />
          </div>
          <div className="field">
            <label id="kind-label">What sort</label>
            <div className="choices" role="group" aria-labelledby="kind-label">
              {FACILITY_KINDS.map((k) => (
                <button
                  key={k.value} type="button" className="choice"
                  aria-pressed={facilityKind === k.value}
                  onClick={() => setFacilityKind(k.value)}
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
        {step > 0 && (
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
