import { isReservedSubdomain } from './subdomain';

/**
 * Which yard, if any, a request is for.
 *
 * Pure string work on purpose. This runs in middleware on every single
 * request, so it never touches the network. Resolving the yard against
 * the database happens later, in the page, where the result can be
 * cached.
 */

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'thelazyhorseman.com';

/** Hosts that belong to the platform rather than to a yard. */
const PLATFORM = new Set(['book', 'www']);

export function tenantFromHost(rawHost: string | null | undefined): string | null {
  if (!rawHost) return null;

  // strip the port, lowercase, drop a trailing dot on a fully qualified name
  const host = rawHost.split(':')[0].trim().toLowerCase().replace(/\.$/, '');
  if (!host) return null;

  // Vercel preview and production build URLs are never a yard. Without
  // this, a deployment URL like tlh-booking-abc.vercel.app would be
  // read as a yard called "tlh-booking-abc".
  if (host.endsWith('.vercel.app')) return null;

  let sub: string | null = null;

  if (host === 'localhost' || host === '127.0.0.1') {
    sub = null;
  } else if (host.endsWith('.localhost')) {
    // <yard>.localhost resolves to 127.0.0.1 in Chrome and Firefox, so
    // tenants can be worked on locally without editing a hosts file.
    sub = host.slice(0, -'.localhost'.length);
  } else if (host === ROOT) {
    sub = null;
  } else if (host.endsWith(`.${ROOT}`)) {
    sub = host.slice(0, -(ROOT.length + 1));
  } else {
    // some other domain entirely, so not a yard
    return null;
  }

  if (!sub) return null;

  // Only a single label is a yard. Anything deeper, like
  // staging.manorfarm.thelazyhorseman.com, is not.
  if (sub.includes('.')) return null;

  if (PLATFORM.has(sub)) return null;

  // The reserved list is the same one the signup form and the database
  // use, so a name that could never be claimed can never route either.
  if (isReservedSubdomain(sub)) return null;

  return sub;
}

/**
 * The absolute address of a yard, built from the host this request came
 * in on so local development and production both work.
 *
 * Yards only ever exist under the root domain, so a Vercel deployment
 * URL is answered with the real domain rather than a subdomain of
 * something.vercel.app, which would not resolve.
 */
export function yardUrl(subdomain: string, rawHost: string | null | undefined): string {
  const [hostname, port] = (rawHost ?? '').split(':');
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');

  const isLocal =
    host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');

  if (isLocal) {
    return `http://${subdomain}.localhost${port ? `:${port}` : ''}`;
  }

  return `https://${subdomain}.${ROOT}`;
}
