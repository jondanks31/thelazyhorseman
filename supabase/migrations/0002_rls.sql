-- ═══════════════════════════════════════════════════════════════
-- Row level security.
--
-- Every table is locked by default. A table with RLS enabled and no
-- matching policy returns nothing, so anything not granted below is
-- denied. Policies are written for `authenticated` only; anon gets
-- nothing at all.
--
-- The service role bypasses RLS, so server routes still do whatever
-- they need. That is deliberate: business creation, subdomain claims
-- and subscriber writes all happen server side.
-- ═══════════════════════════════════════════════════════════════

-- ── helpers ────────────────────────────────────────────────────
-- SECURITY DEFINER so the policy can read membership without the
-- caller needing rights on it. search_path is pinned, otherwise a
-- caller could shadow `membership` with their own table.

create or replace function public.is_member_of(b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.membership m
     where m.business_id = b
       and m.user_id = auth.uid()
       and m.status = 'approved'
  );
$$;

create or replace function public.is_admin_of(b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.membership m
     where m.business_id = b
       and m.user_id = auth.uid()
       and m.status = 'approved'
       and m.role in ('owner', 'admin')
  );
$$;

-- Answers "can this name be claimed" without exposing the table.
-- A name is free when no row exists, or when it was released and its
-- cooling off has passed. Reserved rows carry available_from
-- 'infinity', so they are never free.
create or replace function public.subdomain_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
      from public.subdomain s
     where s.name = lower(candidate)
       and (s.available_from is null or s.available_from > now())
  );
$$;

revoke all on function public.is_member_of(uuid)        from public, anon;
revoke all on function public.is_admin_of(uuid)         from public, anon;
grant execute on function public.is_member_of(uuid)     to authenticated;
grant execute on function public.is_admin_of(uuid)      to authenticated;
grant execute on function public.subdomain_available(text) to authenticated, anon;

-- ── enable ─────────────────────────────────────────────────────
alter table public.business   enable row level security;
alter table public.subdomain  enable row level security;
alter table public.membership enable row level security;
alter table public.facility   enable row level security;
alter table public.booking    enable row level security;
alter table public.subscriber enable row level security;

-- ── business ───────────────────────────────────────────────────
-- Members read their own yard. Admins edit it. Creating and deleting a
-- business is server side only.
create policy business_select_own on public.business
  for select to authenticated
  using (public.is_member_of(id));

create policy business_update_admin on public.business
  for update to authenticated
  using (public.is_admin_of(id))
  with check (public.is_admin_of(id));

-- ── subdomain ──────────────────────────────────────────────────
-- No client access. Availability goes through subdomain_available(),
-- claims and releases happen server side. Reading the table would hand
-- out the reserved list and every yard name in one query.

-- ── membership ─────────────────────────────────────────────────
create policy membership_select_self_or_admin on public.membership
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_of(business_id));

-- A rider may ask to join, and only as a pending rider. Without the
-- role and status pins here, anyone could insert themselves as an
-- approved owner of any yard.
create policy membership_request_join on public.membership
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'rider'
    and status = 'pending'
    and approved_at is null
    and approved_by is null
  );

create policy membership_admin_manages on public.membership
  for update to authenticated
  using (public.is_admin_of(business_id))
  with check (public.is_admin_of(business_id));

-- leave a yard yourself, or be removed by an admin
create policy membership_delete_self_or_admin on public.membership
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin_of(business_id));

-- ── facility ───────────────────────────────────────────────────
create policy facility_select_members on public.facility
  for select to authenticated
  using (public.is_member_of(business_id));

create policy facility_write_admin on public.facility
  for all to authenticated
  using (public.is_admin_of(business_id))
  with check (public.is_admin_of(business_id));

-- ── booking ────────────────────────────────────────────────────
-- Members see the whole yard diary, which is the point of a shared
-- calendar, but can only create bookings in their own name.
create policy booking_select_members on public.booking
  for select to authenticated
  using (public.is_member_of(business_id));

create policy booking_insert_own on public.booking
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member_of(business_id)
    and status = 'confirmed'
  );

create policy booking_update_own_or_admin on public.booking
  for update to authenticated
  using (
    (user_id = auth.uid() and public.is_member_of(business_id))
    or public.is_admin_of(business_id)
  )
  with check (
    (user_id = auth.uid() and public.is_member_of(business_id))
    or public.is_admin_of(business_id)
  );

-- No delete policy. Bookings are cancelled, never removed, so the
-- no-show record survives.

-- ── subscriber ─────────────────────────────────────────────────
-- No client access at all. Sign-ups post to a server route that holds
-- the service key, so the list can never be read back or enumerated
-- from the browser.

revoke all on table public.subdomain  from anon, authenticated;
revoke all on table public.subscriber from anon, authenticated;
