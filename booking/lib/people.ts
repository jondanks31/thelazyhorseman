import { supabaseServer } from './supabase-server';

export type YardPerson = {
  membership_id: string;
  member_id: string;
  email: string;
  /** Null on accounts made before names were asked for. */
  rider_name: string | null;
  role: 'owner' | 'admin' | 'rider';
  status: 'pending' | 'approved' | 'blocked';
  joined_at: string;
};

export type YardHorse = {
  horse_id: string;
  owner_id: string;
  horse: string;
  retired: boolean;
};

/**
 * What to call somebody on an admin screen.
 *
 * The email is the fallback rather than the label. Accounts made before
 * names were asked for have none, and plenty of addresses say nothing
 * about who their owner is, which is the whole reason names exist.
 */
export function personName(p: { rider_name: string | null; email: string }): string {
  return p.rider_name?.trim() || p.email;
}

/**
 * Everyone on a yard, by id, for turning a booking's user_id into a
 * person. Only ever call this for somebody who runs the yard: the
 * function refuses anybody else with 42501, which would surface as an
 * error rather than an empty list.
 */
export async function yardPeople(yardId: string): Promise<Map<string, YardPerson>> {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('yard_riders', { p_business_id: yardId });
  return new Map(((data ?? []) as YardPerson[]).map((p) => [p.member_id, p]));
}

/**
 * Every horse on a yard, by its own id, for naming the one a booking is
 * for. Riders can read their own horses under row level security, but
 * not each other's, so this is how the yard's screens see them all.
 * Admin only, same as the people above.
 */
export async function yardHorses(yardId: string): Promise<Map<string, YardHorse>> {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('yard_horses', { p_business_id: yardId });
  return new Map(((data ?? []) as YardHorse[]).map((h) => [h.horse_id, h]));
}

/** The same horses, gathered under whoever owns them. */
export function horsesByOwner(horses: Map<string, YardHorse>): Map<string, YardHorse[]> {
  const out = new Map<string, YardHorse[]>();
  for (const h of horses.values()) {
    const list = out.get(h.owner_id);
    if (list) list.push(h);
    else out.set(h.owner_id, [h]);
  }
  return out;
}
