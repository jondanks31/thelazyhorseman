/** Facility kinds, matching the facility_kind enum in the database. */
export const FACILITY_KINDS = [
  { value: 'arena', label: 'Outdoor arena' },
  { value: 'school', label: 'Indoor school' },
  { value: 'horsewalker', label: 'Horsewalker' },
  { value: 'lunge_pen', label: 'Lunge pen' },
  { value: 'gallops', label: 'Gallops' },
  { value: 'solarium', label: 'Solarium' },
  { value: 'wash_box', label: 'Wash box' },
  { value: 'other', label: 'Something else' },
] as const;

export type FacilityKind = (typeof FACILITY_KINDS)[number]['value'];

export const kindLabel = (v: string) =>
  FACILITY_KINDS.find((k) => k.value === v)?.label ?? 'Facility';

/** Slot lengths a yard is likely to want. Anything else is unusual. */
export const SLOT_MINUTES = [30, 45, 60, 90, 120] as const;

export const prettyMinutes = (m: number) =>
  m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} hr` : `${Math.floor(m / 60)} hr ${m % 60}`;
