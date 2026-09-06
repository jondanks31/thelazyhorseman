-- Somebody has to be able to put a yard on a plan by hand.
--
-- Promos, launch freebies and the odd apology all mean changing
-- business.plan, and nothing in the app can: migration 0012 narrowed
-- the column grants to name and timezone precisely so a yard admin
-- could not upgrade itself. That was right, and it left the only route
-- as the SQL editor.
--
-- This is the narrow way in. It is deliberately not a god mode: it can
-- list yards and set a plan, and it cannot read a yard's bookings, its
-- diary or its riders' names. If that is ever needed it should be its
-- own function with its own reason to exist.

-- ── who counts as staff ─────────────────────────────────────────
-- Keyed on the email rather than a user id, so the row can exist
-- before the account does and the first sign in simply works. Adding
-- somebody later is one insert.
--
-- Safe because changing an address in Supabase needs the new mailbox
-- confirmed, and /me refuses email changes outright.
create table if not exists private.platform_admin (
  email    text primary key,
  added_at timestamptz not null default now()
);

insert into private.platform_admin (email)
values ('hello@thelazyhorseman.com')
on conflict (email) do nothing;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join private.platform_admin p on lower(u.email) = p.email
    where u.id = (select auth.uid())
  );
$$;

-- ── what was changed, and why ───────────────────────────────────
-- A yard sitting on the centre plan paying nothing is fine, but only
-- if there is a record saying it was meant. Private, so no client can
-- read it.
create table if not exists private.plan_change (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(id) on delete cascade,
  from_plan   public.business_plan,
  to_plan     public.business_plan not null,
  reason      text,
  changed_by  uuid references auth.users(id) on delete set null,
  changed_at  timestamptz not null default now()
);

create index if not exists plan_change_business_idx
  on private.plan_change (business_id, changed_at desc);

-- ── the list ────────────────────────────────────────────────────
-- OUT columns are named apart from the real ones. A `returns table
-- (name ...)` shadows the column in every query in the body and raises
-- 42702, which cost an afternoon on join_yard in migration 0013.
create or replace function public.platform_yards()
returns table (
  yard_id        uuid,
  yard_name      text,
  yard_subdomain text,
  yard_plan      public.business_plan,
  yard_status    public.business_status,
  yard_created   timestamptz,
  yard_address_ready boolean,
  owner_name     text,
  owner_email    text,
  facility_count int,
  rider_count    int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'not for you' using errcode = '42501';
  end if;

  return query
  select
    b.id,
    b.name,
    s.name,
    b.plan,
    b.status,
    b.created_at,
    b.domain_ready,
    pr.name,
    u.email::text,
    (select count(*)::int from public.facility f
      where f.business_id = b.id and f.is_active),
    (select count(*)::int from public.membership m
      where m.business_id = b.id and m.status = 'approved')
  from public.business b
  left join public.subdomain s
    on s.business_id = b.id and s.released_at is null
  -- The founding owner. A yard can have several admins but the one who
  -- signed up is who you want to email about a plan.
  left join lateral (
    select m.user_id
    from public.membership m
    where m.business_id = b.id and m.role = 'owner'
    order by m.created_at
    limit 1
  ) o on true
  left join auth.users u on u.id = o.user_id
  left join public.profile pr on pr.user_id = o.user_id
  order by b.created_at desc;
end;
$$;

-- ── the one write ───────────────────────────────────────────────
create or replace function public.platform_set_plan(
  p_business_id uuid,
  p_plan public.business_plan,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was public.business_plan;
begin
  if not private.is_platform_admin() then
    raise exception 'not for you' using errcode = '42501';
  end if;

  select b.plan into v_was from public.business b where b.id = p_business_id;
  if v_was is null then
    raise exception 'no such yard' using errcode = 'PT404';
  end if;

  update public.business set plan = p_plan where id = p_business_id;

  insert into private.plan_change (business_id, from_plan, to_plan, reason, changed_by)
  values (
    p_business_id,
    v_was,
    p_plan,
    nullif(btrim(coalesce(p_reason, '')), ''),
    (select auth.uid())
  );
end;
$$;

-- Dropping a yard down a plan does not switch its extra facilities off.
-- That is deliberate, see the tail of migration 0010: nothing should
-- vanish from under a yard's riders without somebody deciding it should.

-- ── grants ──────────────────────────────────────────────────────
-- Supabase's default privileges on this schema grant EXECUTE on every
-- new function straight to anon, so revoking from public alone leaves
-- it wide open. See the note in migration 0019.
revoke all on function public.platform_yards() from public, anon;
grant execute on function public.platform_yards() to authenticated;

revoke all on function public.platform_set_plan(uuid, public.business_plan, text)
  from public, anon;
grant execute on function public.platform_set_plan(uuid, public.business_plan, text)
  to authenticated;

-- The staff list and the log are nobody's business but mine. They sit
-- in `private`, which PostgREST does not expose, and this says so.
revoke all on private.platform_admin from anon, authenticated;
revoke all on private.plan_change from anon, authenticated;
revoke all on function private.is_platform_admin() from public, anon, authenticated;
