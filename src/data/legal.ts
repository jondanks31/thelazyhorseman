/**
 * The details the legal pages need and nothing else knows.
 *
 * In one file because a privacy policy naming the wrong controller in
 * three places is worse than in one.
 *
 * ── Where this stands, and what changes it ──────────────────────
 *
 * Right now: no payments, no ICO number, a trading name and an email
 * address. That holds while the service is free, because the rules that
 * force a trader to publish a geographic address are consumer and
 * ecommerce ones, and they bite when you sell something.
 *
 * BEFORE THE FIRST PAYING YARD, all three of these have to be true:
 *
 *   1. `company` and `companyNumber` filled in, once the Ltd exists.
 *   2. `address` filled in. A registered office service is the usual
 *      answer if you would rather it were not your house, and is about
 *      £30 a year.
 *   3. `icoNumber` filled in. Registration is an annual fee, tier 1,
 *      and takes about five minutes: https://ico.org.uk/registration/
 *
 * Everything below renders only when it has a value, so filling one in
 * is the whole of the job. Nothing needs editing in the pages.
 */

export const LEGAL = {
  /** The trading name, and for now the whole of the identity. */
  name: 'The Lazy Horseman',

  /** TODO before taking payment. Registered company name. */
  company: null as string | null,

  /** TODO before taking payment. Companies House number. */
  companyNumber: null as string | null,

  /** TODO before taking payment. Shown publicly when set. */
  address: null as string[] | null,

  email: 'hello@thelazyhorseman.com',

  /** TODO before real users. Register, then put the number here. */
  icoNumber: null as string | null,

  /** Bump whenever either page changes in substance. */
  updated: '2026-09-05',
} as const;

export const updatedLong = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(`${LEGAL.updated}T00:00:00Z`));

/**
 * Who you are dealing with, in as many words as there currently are.
 * "The Lazy Horseman" today; the registered name and number once the
 * company exists.
 */
export const controllerLine = LEGAL.company
  ? [
      LEGAL.company,
      `trading as ${LEGAL.name}`,
      LEGAL.companyNumber ? `company number ${LEGAL.companyNumber}` : null,
    ].filter(Boolean).join(', ')
  : LEGAL.name;
