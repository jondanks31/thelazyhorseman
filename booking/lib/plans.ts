/**
 * What each plan costs and allows.
 *
 * Display only. The database enforces the allowance in
 * private.facility_allowance, and that is the authority. If you change a
 * number here, change it there too, in a migration. The UI being wrong
 * shows a yard the wrong price; the database being wrong lets them past
 * the limit.
 *
 * Prices are my proposed bands, not yet confirmed by Jon.
 */

export type PlanId = 'free' | 'yard' | 'centre';

export type Plan = {
  id: PlanId;
  name: string;
  /** Pence per month, so no floating point anywhere near money. */
  pence: number;
  /** Facilities that may be switched on. Null is unlimited. */
  facilities: number | null;
  blurb: string;
  includes: string[];
};

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    pence: 0,
    facilities: 1,
    blurb: 'One facility, as many riders as you like.',
    includes: [
      'One facility',
      'Unlimited riders',
      'Your own address',
      'Clinics and farrier days',
    ],
  },
  {
    id: 'yard',
    name: 'Yard',
    pence: 1200,
    facilities: 5,
    blurb: 'For a yard with an arena, a school and a horsewalker.',
    includes: [
      'Up to five facilities',
      'Everything in Free',
      'Recurring bookings',
      'Waiting lists',
    ],
  },
  {
    id: 'centre',
    name: 'Centre',
    pence: 2900,
    facilities: null,
    blurb: 'For riding centres and anyone running more than one site.',
    includes: [
      'Unlimited facilities',
      'Everything in Yard',
      'More than one site',
      'Reporting and payments',
    ],
  },
];

export function planById(id: PlanId): Plan {
  const found = PLANS.find((p) => p.id === id);
  if (!found) throw new Error(`unknown plan: ${id}`);
  return found;
}

/** "£12" and "Free", never "£12.00". */
export function priceLabel(pence: number): string {
  if (pence === 0) return 'Free';
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

export function allowanceLabel(facilities: number | null): string {
  if (facilities === null) return 'Unlimited facilities';
  return facilities === 1 ? '1 facility' : `${facilities} facilities`;
}

/** The plan above this one, or null at the top. */
export function nextPlanUp(id: PlanId): Plan | null {
  const i = PLANS.findIndex((p) => p.id === id);
  return i >= 0 && i < PLANS.length - 1 ? PLANS[i + 1] : null;
}

/**
 * PostgREST turns the trigger's PT402 sqlstate into HTTP 402, so this is
 * how a refused write is told apart from a genuine fault.
 */
export const ALLOWANCE_REACHED = 'PT402';
