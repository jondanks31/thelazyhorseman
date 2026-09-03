-- Who is on a yard, by email.
--
-- membership only carries a user_id, and auth.users is not readable by
-- clients, so the riders screen had no way to show an admin who anybody
-- actually is. Rather than copying emails into a profile table that then
-- has to be kept in step, this reads them for admins of that one yard.
create or replace function public.yard_riders(p_business_id uuid)
returns table (
  membership_id uuid,
  user_id       uuid,
  email         text,
  role          public.membership_role,
  status        public.membership_status,
  joined_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- The check is the whole point of the function. Without it this hands
  -- every email in the database to anybody who calls it.
  if not private.is_admin_of(p_business_id) then
    raise exception 'not yours' using errcode = '42501';
  end if;

  return query
    select m.id, m.user_id, u.email::text, m.role, m.status, m.created_at
    from public.membership m
    join auth.users u on u.id = m.user_id
    where m.business_id = p_business_id
    order by m.created_at;
end;
$$;

revoke all on function public.yard_riders(uuid) from public;
grant execute on function public.yard_riders(uuid) to authenticated;
