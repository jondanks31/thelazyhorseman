-- Creating a yard touches three tables and must be all or nothing, and
-- RLS deliberately denies clients any insert on business or subdomain.
-- Rather than hand the app a service role key, which would bypass RLS
-- everywhere, onboarding gets this one narrow entry point. It always
-- acts for auth.uid(), so it cannot be used to create a yard for
-- somebody else.
create or replace function public.create_yard(p_name text, p_subdomain text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_name     text := btrim(coalesce(p_name, ''));
  v_sub      text := lower(btrim(coalesce(p_subdomain, '')));
  v_business uuid;
  v_owned    int;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Give the yard a name between 2 and 120 characters.' using errcode = '22023';
  end if;

  -- same shape rule as the subdomain CHECK and validateSubdomain()
  if v_sub !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
     or substring(v_sub from 3 for 2) = '--' then
    raise exception 'That address will not work. Use 3 to 40 letters, numbers or hyphens.' using errcode = '22023';
  end if;

  if not public.subdomain_available(v_sub) then
    raise exception 'That address is taken.' using errcode = '23505';
  end if;

  -- stops one account scripting a land grab on good names
  select count(*) into v_owned
    from public.membership m
   where m.user_id = v_uid and m.role = 'owner';

  if v_owned >= 3 then
    raise exception 'You already run the maximum number of yards.' using errcode = 'P0001';
  end if;

  insert into public.business (name) values (v_name) returning id into v_business;

  -- The availability check above can race. The primary key is the real
  -- arbiter, so translate its error into something a person can read.
  begin
    insert into public.subdomain (name, business_id, claimed_at)
    values (v_sub, v_business, now());
  exception when unique_violation then
    raise exception 'That address is taken.' using errcode = '23505';
  end;

  insert into public.membership (business_id, user_id, role, status, approved_at)
  values (v_business, v_uid, 'owner', 'approved', now());

  return v_business;
end;
$$;

revoke all on function public.create_yard(text, text) from public, anon;
grant execute on function public.create_yard(text, text) to authenticated;

comment on function public.create_yard(text, text) is
  'Intentionally exposed to authenticated. The only way a client can create a business, claim a subdomain and become its owner, all atomically, without a service role key. Always acts for auth.uid().';
