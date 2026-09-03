import { supabaseServer } from './supabase-server';

export type YardPerson = {
  membership_id: string;
  member_id: string;
  email: string;
  rider_name: string | null;
  rider_horse: string | null;
  role: 'owner' | 'admin' | 'rider';
  status: 'pending' | 'approved' | 'blocked';
  joined_at: string;
};

/**
 * What to call somebody on an admin screen.
 *
 * The email is the fallback rather than the label. Accounts made before
 * names were asked for have none, and plenty of addresses say nothing
 * about who their owner is, which is the whole reason names exist.
 */
export function personName(p: {
  rider_name: string | null;
  email: string;
}): string {
  return p.rider_name?.trim() || p.email;
}

/** The same, with the horse, where there is room for both. */
export function personLabel(p: {
  rider_name: string | null;
  rider_horse: string | null;
  email: string;
}): string {
  const who = personName(p);
  return p.rider_horse?.trim() ? `${who} · ${p.rider_horse.trim()}` : who;
}

/**
 * Everyone on a yard, by id, for turning a booking's user_id into a
 * person. Only ever call this for somebody who runs the yard: the
 * function refuses anybody else with 42501, which would surface as an
 * error rather than an empty list.
 *
 * Returns the people rather than finished strings, because a dense slot
 * grid wants the name alone and the diary has room for the horse too.
 */
export async function yardPeople(yardId: string): Promise<Map<string, YardPerson>> {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('yard_riders', { p_business_id: yardId });
  return new Map(((data ?? []) as YardPerson[]).map((p) => [p.member_id, p]));
}
