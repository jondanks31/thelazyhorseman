-- Facility allowances per plan.
--
-- The admin screens write straight from the browser to PostgREST, so a
-- disabled button is decoration. The allowance is enforced here or not
-- at all.

-- How many facilities a plan may have switched on. Null is unlimited.
-- Kept as a function rather than a table because it is read on every
-- facility write and changes about once a year.
create or replace function private.facility_allowance(p_plan public.business_plan)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_plan
    when 'free'   then 1
    when 'yard'   then 5
    when 'centre' then null
  end;
$$;

comment on function private.facility_allowance(public.business_plan) is
  'Facilities a plan may have active. Null means unlimited. Mirrored in booking/lib/plans.ts, which is display only; this is the authority.';

create or replace function private.enforce_facility_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan    public.business_plan;
  v_allowed int;
  v_used    int;
begin
  -- A facility that is switched off costs nothing, which is what makes
  -- "turn off, never delete" survive a downgrade.
  if not new.is_active then
    return new;
  end if;

  -- Editing a facility that was already on does not consume anything
  -- new, so an over-allowance yard can still fix its opening hours.
  if tg_op = 'UPDATE' and old.is_active and old.business_id = new.business_id then
    return new;
  end if;

  -- Locking the business row serialises facility writes for this yard.
  -- Without it two simultaneous inserts both count the old total and
  -- both pass, which is exactly how limits get quietly exceeded.
  select b.plan into v_plan
  from public.business b
  where b.id = new.business_id
  for update;

  if not found then
    raise exception 'no such business' using errcode = '23503';
  end if;

  v_allowed := private.facility_allowance(v_plan);
  if v_allowed is null then
    return new;
  end if;

  select count(*) into v_used
  from public.facility f
  where f.business_id = new.business_id
    and f.is_active
    and f.id <> new.id;

  if v_used >= v_allowed then
    -- PostgREST turns a PTxyz sqlstate into HTTP status xyz, so this
    -- arrives at the browser as 402 Payment Required rather than a 500
    -- that looks like a fault.
    raise exception 'facility allowance reached'
      using errcode = 'PT402',
            detail  = format('%s of %s used on the %s plan', v_used, v_allowed, v_plan),
            hint    = 'upgrade';
  end if;

  return new;
end;
$$;

drop trigger if exists facility_within_allowance on public.facility;
create trigger facility_within_allowance
  before insert or update on public.facility
  for each row execute function private.enforce_facility_allowance();

-- Note for when Stripe lands: a downgrade does not retrospectively
-- switch facilities off, because this only runs on facility writes. The
-- webhook that moves a business down a plan has to decide what happens
-- to the excess, and doing nothing leaves a yard above its allowance.
