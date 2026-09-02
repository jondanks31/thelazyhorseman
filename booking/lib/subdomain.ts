/**
 * Names no yard can claim. Enforced here at input and seeded as rows in
 * the subdomain table, so a signup path that skips this check still
 * cannot take one. Keep the two in step.
 */
const RESERVED = new Set([
  // DNS and mail, several of these are live records on the zone
  'www', 'mail', 'email', 'webmail', 'smtp', 'imap', 'pop', 'pop3',
  'ns1', 'ns2', 'dns', 'ftp', 'sftp', 'autodiscover', 'autoconfig',
  'cpanel', 'whm', 'webdisk', 'cdn', 'static', 'assets', 'media', 'files',
  // the platform itself
  'app', 'api', 'admin', 'administrator', 'dashboard', 'portal', 'console',
  'account', 'accounts', 'auth', 'login', 'logout', 'signin', 'signup',
  'register', 'oauth', 'sso', 'billing', 'pay', 'payments', 'checkout',
  // TLH products and pages, present and planned
  'book', 'bookings', 'booking', 'letter', 'newsletter', 'tools', 'shop',
  'store', 'merch', 'sponsor', 'about', 'blog', 'news', 'issue', 'issues',
  'osstrack', 'stallio', 'yard', 'yards',
  // environments
  'dev', 'development', 'staging', 'stage', 'test', 'testing', 'preview',
  'demo', 'sandbox', 'local', 'localhost', 'prod', 'production', 'beta', 'alpha',
  // operations and support
  'status', 'health', 'healthz', 'monitor', 'uptime', 'support', 'help',
  'docs', 'doc', 'faq', 'contact',
  // addresses people expect to reach a human or a process
  'abuse', 'security', 'postmaster', 'hostmaster', 'webmaster', 'noc', 'root',
  'ssl', 'tls', 'acme', 'legal', 'privacy', 'terms', 'gdpr', 'dpo',
  // vendors, so nobody can impersonate infrastructure
  'vercel', 'supabase', 'hostinger', 'stripe', 'whatsapp',
  // generic words that collide with routes or confuse
  'new', 'edit', 'delete', 'settings', 'search', 'home', 'index',
  'null', 'undefined', 'true', 'false',
]);

/** lowercase, starts and ends alphanumeric, 3 to 40 characters */
const SHAPE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export type Rejection =
  | 'too_short' | 'too_long' | 'bad_shape' | 'reserved_form' | 'reserved';

export const REJECTION_MESSAGE: Record<Rejection, string> = {
  too_short: 'A bit longer, at least three characters.',
  too_long: 'That is too long. Forty characters at most.',
  bad_shape: 'Letters, numbers and hyphens only, starting and ending with a letter or number.',
  reserved_form: 'That shape is reserved. Try something else.',
  reserved: 'That one is taken by us, sorry. Try your yard name.',
};

export function isReservedSubdomain(name: string): boolean {
  return RESERVED.has(name.trim().toLowerCase());
}

export function validateSubdomain(
  input: string,
): { ok: true; value: string } | { ok: false; reason: Rejection } {
  const value = input.trim().toLowerCase();

  if (value.length < 3) return { ok: false, reason: 'too_short' };
  if (value.length > 40) return { ok: false, reason: 'too_long' };
  if (!SHAPE.test(value)) return { ok: false, reason: 'bad_shape' };

  // RFC 5891 reserves labels with two hyphens in positions 3 and 4.
  // That covers xn-- punycode, which is how homograph spoofing gets in.
  if (value.slice(2, 4) === '--') return { ok: false, reason: 'reserved_form' };

  if (RESERVED.has(value)) return { ok: false, reason: 'reserved' };

  return { ok: true, value };
}

/** Turns "Manor Farm Livery" into "manorfarmlivery" as a starting suggestion. */
export function suggestSubdomain(yardName: string): string {
  return yardName
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
}
