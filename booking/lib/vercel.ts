/**
 * Getting a yard's address on to Vercel.
 *
 * DNS already sends every `*.thelazyhorseman.com` to the booking
 * project, but Vercel serves nothing for a host it has no domain object
 * for, and issues no certificate. So a yard is not actually reachable
 * until this has run for it.
 *
 * Never a wildcard domain in Vercel: that would need DNS-01 and
 * therefore Vercel's nameservers, and the zone lives at Hostinger. Each
 * yard gets its own domain object, verified over the CNAME that is
 * already there.
 *
 * Like lib/email.ts, nothing here throws. The yard exists whether or
 * not this works, and the account page offers to try again.
 */

const API = 'https://api.vercel.com';

/** Twenty seconds, across up to three calls. */
const TIMEOUT_MS = 20_000;

export type DomainState =
  /** Registered and serving. */
  | 'live'
  /** On the project, but Vercel has not verified it yet. */
  | 'pending'
  /** Somebody else's Vercel project has it. */
  | 'taken'
  /** No token in the environment. Local work, mostly. */
  | 'notConfigured'
  /** Refused, timed out, or the network went. Why is in the log. */
  | 'failed';

type Domain = { name: string; verified: boolean };

export function vercelIsConfigured(): boolean {
  return !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
}

async function call(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; body: Domain | null }> {
  const team = process.env.VERCEL_TEAM_ID;
  const url = `${API}${path}${team ? `${path.includes('?') ? '&' : '?'}teamId=${team}` : ''}`;

  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      'content-type': 'application/json',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  if (!response.ok) {
    // Vercel says why. It goes to the log and no further: it talks about
    // projects and tokens, which is nothing to do with whoever pressed
    // the button.
    console.error('vercel refused', method, path, response.status, text);
    return { ok: false, status: response.status, body: null };
  }

  try {
    return { ok: true, status: response.status, body: JSON.parse(text) as Domain };
  } catch {
    return { ok: true, status: response.status, body: null };
  }
}

/**
 * Puts one yard's host on the project and reports where it got to.
 *
 * Safe to run again on a yard that already has it: adding a domain that
 * is there answers 400, which is the answer we wanted, and the rest of
 * the function carries on to find out whether it is verified.
 */
export async function claimYardDomain(host: string): Promise<DomainState> {
  const project = process.env.VERCEL_PROJECT_ID;
  if (!process.env.VERCEL_TOKEN || !project) return 'notConfigured';

  try {
    const added = await call('POST', `/v10/projects/${project}/domains`, { name: host });

    // 409 is another Vercel project holding it. Nothing this app can do,
    // and worth saying plainly rather than retrying forever.
    if (added.status === 409) return 'taken';
    if (!added.ok && added.status !== 400) return 'failed';

    if (added.body?.verified) return 'live';

    // Either it went on unverified, or it was already there and we have
    // no idea of its state. Asking Vercel to check the CNAME is the same
    // move in both cases.
    await call('POST', `/v9/projects/${project}/domains/${host}/verify`);
    const now = await call('GET', `/v9/projects/${project}/domains/${host}`);

    if (!now.ok) return 'failed';
    return now.body?.verified ? 'live' : 'pending';
  } catch (cause) {
    console.error('vercel failed', host, cause);
    return 'failed';
  }
}
