-- ═══════════════════════════════════════════════════════════════
-- Facility Booking, core schema.
--
-- One business per yard, one subdomain per business, riders join by
-- membership, facilities belong to a business, bookings belong to a
-- facility. Every table carries business_id so row level security can
-- scope on it without walking joins.
-- ═══════════════════════════════════════════════════════════════

-- btree_gist lets a GiST index handle uuid equality, which the
-- no-overlap exclusion constraint on booking needs.
create extension if not exists btree_gist;

-- ── enums ──────────────────────────────────────────────────────
create type business_plan   as enum ('free', 'yard', 'centre');
create type business_status as enum ('active', 'dormant', 'warned', 'suspended', 'released');
create type membership_role   as enum ('owner', 'admin', 'rider');
create type membership_status as enum ('pending', 'approved', 'blocked');
create type facility_kind  as enum ('arena', 'school', 'horsewalker', 'lunge_pen', 'gallops', 'solarium', 'wash_box', 'other');
create type booking_status as enum ('confirmed', 'cancelled');
create type booking_source as enum ('web', 'whatsapp', 'admin');
create type subscriber_list as enum ('letter', 'yards');

-- ── shared trigger ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── business ───────────────────────────────────────────────────
create table public.business (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(btrim(name)) between 2 and 120),
  plan                business_plan   not null default 'free',
  status              business_status not null default 'active',
  stripe_customer_id  text unique,
  -- touched on login and on every booking; the dormancy sweep reads it
  last_active_at      timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger business_set_updated_at
  before update on public.business
  for each row execute function public.set_updated_at();

create index business_status_activity_idx
  on public.business (status, last_active_at);

-- ── subdomain ──────────────────────────────────────────────────
-- The registry of names. Reserved words and released names live here
-- too, so one lookup answers "can this be claimed" with no special
-- cases: reserved rows carry available_from = 'infinity', released
-- rows carry released_at + a cooling off period.
create table public.subdomain (
  name            text primary key,
  business_id     uuid references public.business(id) on delete set null,
  claimed_at      timestamptz,
  released_at     timestamptz,
  available_from  timestamptz,
  created_at      timestamptz not null default now(),

  -- mirrors validateSubdomain() in the app: lowercase, 3 to 40 chars,
  -- starts and ends alphanumeric, and never the RFC 5891 reserved form
  -- with two hyphens in positions 3 and 4, which is how xn-- punycode
  -- and homograph spoofing would get in.
  constraint subdomain_shape check (
    name ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
    and substring(name from 3 for 2) <> '--'
  ),
  constraint subdomain_released_has_time check (
    (released_at is null) or (business_id is not null)
  )
);

-- a business may hold at most one live name, but keeps its history
create unique index subdomain_one_live_per_business
  on public.subdomain (business_id)
  where business_id is not null and released_at is null;

create index subdomain_availability_idx
  on public.subdomain (available_from)
  where released_at is not null;

-- ── membership ─────────────────────────────────────────────────
-- Join table on purpose. People move yards, and plenty keep a horse at
-- one and ride at another, so one login belongs to many businesses.
create table public.membership (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.business(id) on delete cascade,
  user_id      uuid not null references auth.users(id)      on delete cascade,
  role         membership_role   not null default 'rider',
  status       membership_status not null default 'pending',
  approved_at  timestamptz,
  approved_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, user_id)
);

create trigger membership_set_updated_at
  before update on public.membership
  for each row execute function public.set_updated_at();

create index membership_user_idx     on public.membership (user_id, status);
create index membership_business_idx on public.membership (business_id, status);

-- ── facility ───────────────────────────────────────────────────
create table public.facility (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.business(id) on delete cascade,
  name           text not null check (length(btrim(name)) between 1 and 80),
  kind           facility_kind not null default 'arena',
  slot_minutes   int  not null default 60 check (slot_minutes between 15 and 480),
  max_days_ahead int  not null default 14 check (max_days_ahead between 1 and 365),
  opening_hours  jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- lets booking carry a denormalised business_id that cannot drift
  unique (id, business_id)
);

create trigger facility_set_updated_at
  before update on public.facility
  for each row execute function public.set_updated_at();

create index facility_business_idx on public.facility (business_id) where is_active;

-- ── booking ────────────────────────────────────────────────────
create table public.booking (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null,
  business_id  uuid not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       booking_status not null default 'confirmed',
  source       booking_source not null default 'web',
  note         text check (note is null or length(note) <= 500),
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz,

  constraint booking_ends_after_start check (ends_at > starts_at),
  constraint booking_cancelled_has_time check (
    (status = 'cancelled') = (cancelled_at is not null)
  ),
  -- composite reference, so business_id always matches the facility's
  constraint booking_facility_fk
    foreign key (facility_id, business_id)
    references public.facility (id, business_id) on delete cascade
);

-- Two people tapping "book 6pm" in the same second both pass an
-- application level "is this free" check. This makes the overlap
-- impossible in the database rather than merely unlikely.
alter table public.booking
  add constraint booking_no_overlap
  exclude using gist (
    facility_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed');

create index booking_business_time_idx on public.booking (business_id, starts_at);
create index booking_user_idx          on public.booking (user_id, starts_at desc);

-- a booking counts as activity for the yard
create or replace function public.touch_business_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.business
     set last_active_at = now()
   where id = new.business_id;
  return new;
end;
$$;

create trigger booking_touches_business
  after insert on public.booking
  for each row execute function public.touch_business_activity();

-- ── subscriber ─────────────────────────────────────────────────
-- Two separate lists that must never be merged. consent_text stores the
-- exact wording shown at the time, because a boolean is not evidence.
create table public.subscriber (
  id              uuid primary key default gen_random_uuid(),
  email           text not null check (email = lower(email) and position('@' in email) > 1),
  list            subscriber_list not null,
  consent_at      timestamptz not null default now(),
  consent_text    text not null,
  source          text,
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (email, list)
);

create index subscriber_list_idx on public.subscriber (list) where unsubscribed_at is null;
