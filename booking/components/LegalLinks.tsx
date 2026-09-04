/**
 * Privacy and terms, at the bottom of the booking app.
 *
 * Both documents live on the marketing site, so there is one copy of
 * each rather than one per surface, and they open there. Absolute URLs
 * because this renders on the front door and on every yard's own
 * address, none of which serve those pages.
 *
 * Server component: two links and nothing to hydrate.
 */
const SITE = 'https://www.thelazyhorseman.com';

export default function LegalLinks({ className = 'legal-links' }: { className?: string }) {
  return (
    <p className={className}>
      <a href={`${SITE}/privacy`}>Privacy</a>
      <span aria-hidden="true"> · </span>
      <a href={`${SITE}/terms`}>Terms</a>
    </p>
  );
}
