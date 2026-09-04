-- A yard's own address has to exist at Vercel, not just in DNS.
--
-- The wildcard CNAME resolves every subdomain to the booking project,
-- but Vercel will not serve a host it has no domain object for, and
-- issues no certificate for one. Until now nothing registered the
-- subdomain when a yard signed up, so every yard address in existence
-- failed to load. The link a yard hands out is the whole product.
--
-- Registering happens in the app, which is the only place that can hold
-- a Vercel token. This column is what the app writes back, so the
-- account page can offer to try again for a yard whose registration
-- never happened or did not stick.
alter table public.business
  add column if not exists domain_ready boolean not null default false;

-- Deliberately false for yards that already exist. None of them were
-- ever registered, so false is the truth, and their owner gets the
-- prompt on their own account page.

-- The app runs as the signed-in owner, and column privileges stop that
-- role touching anything on business except name and timezone. This is
-- the narrow way through, admin gated like the rest.
--
-- An admin lying to it can only suppress their own prompt, which is why
-- it takes the value rather than always setting true: turning it back
-- off is how you ask for the check again.
create or replace function public.set_domain_ready(p_business_id uuid, p_ready boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin_of(p_business_id) then
    raise exception 'not yours' using errcode = '42501';
  end if;

  update public.business
     set domain_ready = p_ready
   where id = p_business_id;
end;
$$;

-- ── revoking from public is not enough ──────────────────────────
--
-- Supabase ships ALTER DEFAULT PRIVILEGES on this schema that grants
-- EXECUTE on every new function straight to `anon`, `authenticated` and
-- `service_role`. That is a direct grant, so `revoke ... from public`
-- leaves it exactly where it was, and every SECURITY DEFINER function
-- written here so far has been callable by anonymous visitors despite
-- the migration that made it saying otherwise.
--
--   select has_function_privilege('anon', 'public.f(args)', 'EXECUTE');
--
-- is how to check, and `anon` has to be named to be removed.
revoke all on function public.set_domain_ready(uuid, boolean) from public, anon;
grant execute on function public.set_domain_ready(uuid, boolean) to authenticated;

-- The same slip, on everything that was meant to be signed-in only.
-- None of them were exploitable: each checks private.is_admin_of or
-- auth.uid() first and answers an anonymous caller with nothing or
-- 42501. The database simply disagreed with the intent.
revoke all on function public.rotate_join_code(uuid) from public, anon;
grant execute on function public.rotate_join_code(uuid) to authenticated;

revoke all on function public.yard_riders(uuid) from public, anon;
grant execute on function public.yard_riders(uuid) to authenticated;

revoke all on function public.yard_horses(uuid) from public, anon;
grant execute on function public.yard_horses(uuid) to authenticated;

revoke all on function public.my_yards() from public, anon;
grant execute on function public.my_yards() to authenticated;

-- Left alone on purpose:
--   yard_by_subdomain   a signed-out visitor has to resolve the yard
--                       before they can be shown its sign in page
--   join_yard           raises 28000 with no session, and the join page
--                       signs somebody in before calling it
--   subdomain_available the signup wizard asks after the account step,
--                       so it could be narrowed, but a wrong guess here
--                       breaks signup and it leaks nothing you could not
--                       learn by visiting the address
