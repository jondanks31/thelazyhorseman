-- The yards the signed-in person belongs to.
--
-- Needed because `subdomain` has all client access revoked, so somebody
-- cannot read the address of their own yard to get back to it. Rather
-- than opening that table up, this hands back only the rows that belong
-- to the caller.
--
-- Lives in public, unlike the helpers in private, because it is meant to
-- be called as RPC. It is safe to expose: it never takes a user id, it
-- reads auth.uid() itself, so it cannot be asked about anybody else.
create or replace function public.my_yards()
returns table (
  business_id uuid,
  name        text,
  subdomain   text,
  role        public.membership_role,
  status      public.membership_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    b.name,
    s.name,
    m.role,
    m.status
  from public.membership m
  join public.business b on b.id = m.business_id
  -- A yard whose subdomain was released has no address to link to, so
  -- the join stays outer and the caller decides what to show.
  left join public.subdomain s
    on s.business_id = b.id
   and s.released_at is null
  where m.user_id = auth.uid()
    and b.status <> 'released'
  order by b.name;
$$;

comment on function public.my_yards() is
  'Yards the caller belongs to, with the address to reach each one. Reads auth.uid(); takes no user id.';

revoke all on function public.my_yards() from public;
grant execute on function public.my_yards() to authenticated;
