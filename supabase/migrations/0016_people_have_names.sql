-- Who somebody actually is.
--
-- An admin looking at the diary saw rider@example.co.uk against a slot,
-- which tells them nothing about who is in the school. Emails are often
-- nothing like a person's name, and plenty are shared or nonsense.
--
-- The name is captured at signup rather than asked for later, because
-- later never comes and the yard needs it from the first booking.

create table public.profile (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  -- Nullable, because accounts that predate this have no name and a
  -- made up one is worse than falling back to the email.
  name       text check (name is null or length(btrim(name)) between 1 and 60),
  horse_name text check (horse_name is null or length(btrim(horse_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profile_set_updated_at
  before update on public.profile
  for each row execute function public.set_updated_at();

-- ── filled at signup ───────────────────────────────────────────
-- signUp() runs before there is a session, so the client cannot insert
-- this row itself. It passes the name as user metadata instead and this
-- copies it across the moment the account exists.
--
-- Metadata is whatever the browser sent, so it is trimmed and cut to
-- length here rather than trusted. A check constraint alone would raise
-- inside the trigger and take the whole signup down with it.
create or replace function private.copy_signup_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile (user_id, name, horse_name)
  values (
    new.id,
    nullif(btrim(left(new.raw_user_meta_data ->> 'name', 60)), ''),
    nullif(btrim(left(new.raw_user_meta_data ->> 'horse_name', 60)), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.copy_signup_name() from public, anon, authenticated;

create trigger auth_user_gets_a_profile
  after insert on auth.users
  for each row execute function private.copy_signup_name();

-- Accounts that already existed. They get an empty row so every member
-- has one, and the screens fall back to the email until they fill it in.
insert into public.profile (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ── who may read it ────────────────────────────────────────────
alter table public.profile enable row level security;

-- Your own, and nobody else's. Riders still see "Taken" rather than a
-- name; an admin reads their members through yard_riders() below, which
-- checks that they run the yard before answering.
create policy profile_select_own on public.profile
  for select to authenticated
  using (user_id = auth.uid());

create policy profile_update_own on public.profile
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Row level security cannot say which columns an update touches, so the
-- grant does. Without this a rider could repoint their profile at
-- somebody else's user_id. Same lesson as migration 0012.
revoke update on public.profile from authenticated;
grant update (name, horse_name) on public.profile to authenticated;

-- ── the riders screen, now with names ──────────────────────────
-- Return type changes, so it has to go and come back rather than being
-- replaced in place.
drop function if exists public.yard_riders(uuid);

create function public.yard_riders(p_business_id uuid)
returns table (
  membership_id uuid,
  member_id     uuid,
  email         text,
  rider_name    text,
  rider_horse   text,
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

  -- Output columns are plpgsql variables and shadow real ones, which is
  -- why these are named apart from the columns they are selected from.
  return query
    select m.id, m.user_id, u.email::text, p.name, p.horse_name,
           m.role, m.status, m.created_at
    from public.membership m
    join auth.users u on u.id = m.user_id
    left join public.profile p on p.user_id = m.user_id
    where m.business_id = p_business_id
    order by m.created_at;
end;
$$;

revoke all on function public.yard_riders(uuid) from public;
grant execute on function public.yard_riders(uuid) to authenticated;

comment on table public.profile is
  'One row per account. Name is captured at signup through user metadata; the yard sees it through yard_riders().';
