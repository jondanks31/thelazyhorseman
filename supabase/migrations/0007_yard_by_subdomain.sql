-- A rider landing on manorfarm.thelazyhorseman.com is anonymous until
-- they sign in, and RLS quite rightly denies anonymous reads of
-- business. Resolving the yard therefore needs a narrow, deliberate
-- opening rather than a permissive policy on the whole table.
--
-- It returns the name only. No plan, no activity, no counts, nothing
-- that is not already public the moment the address resolves.
create or replace function public.yard_by_subdomain(p_subdomain text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.id, b.name
    from public.subdomain s
    join public.business  b on b.id = s.business_id
   where s.name = lower(btrim(p_subdomain))
     and s.released_at is null
     and b.status in ('active', 'dormant', 'warned');
$$;

revoke all on function public.yard_by_subdomain(text) from public;
grant execute on function public.yard_by_subdomain(text) to anon, authenticated;

comment on function public.yard_by_subdomain(text) is
  'Intentionally callable by anon. Resolves a yard subdomain to its id and name so the tenant page can render before sign in. Returns nothing for released or suspended yards. Exposes only what the address already reveals.';
