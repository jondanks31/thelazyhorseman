/**
 * The details the legal pages need and nothing else knows.
 *
 * These are in one file because a privacy policy has to name a real
 * controller at a real address, and getting that wrong in three places
 * is worse than getting it wrong in one.
 *
 * ─────────────────────────────────────────────────────────────
 *  BEFORE THESE PAGES GO LIVE, FILL IN EVERY VALUE MARKED TODO.
 * ─────────────────────────────────────────────────────────────
 */

export const LEGAL = {
  /**
   * TODO. Whoever is actually the data controller.
   *
   * Sole trader: your own name, with `tradingAs` below.
   * Limited company: the registered company name, plus `companyNumber`.
   */
  controller: 'Jon Danks',

  /** Null for a limited company, where the registered name stands alone. */
  tradingAs: 'The Lazy Horseman',

  /** TODO if you incorporate. Companies House number, else null. */
  companyNumber: null as string | null,

  /**
   * TODO. A postal address is required and it will be public.
   *
   * A home address is allowed and plenty of sole traders use one. If you
   * would rather not, a registered office or mail forwarding service is
   * the usual answer and costs about £30 a year.
   */
  address: ['TODO: street', 'TODO: town', 'Shropshire', 'TODO: postcode'],

  email: 'hello@thelazyhorseman.com',

  /**
   * TODO. Register with the ICO before taking a paying yard, then put
   * the number here. It is an annual fee, tier 1, and the number is
   * expected on a privacy policy.
   *
   * https://ico.org.uk/registration/
   */
  icoNumber: null as string | null,

  /** Bump whenever either page changes in substance. */
  updated: '2026-09-05',
} as const;

export const updatedLong = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(`${LEGAL.updated}T00:00:00Z`));

/** "Jon Danks, trading as The Lazy Horseman" or the company line. */
export const controllerLine = [
  LEGAL.controller,
  LEGAL.tradingAs ? `trading as ${LEGAL.tradingAs}` : null,
  LEGAL.companyNumber ? `company number ${LEGAL.companyNumber}` : null,
].filter(Boolean).join(', ');
