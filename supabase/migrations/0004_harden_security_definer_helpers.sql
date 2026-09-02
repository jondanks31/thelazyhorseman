-- PostgREST exposes every function in `public` as an RPC endpoint. The
-- policy helpers and the trigger function have no business being
-- callable over HTTP, so they move to a schema PostgREST does not
-- serve. Policies and triggers reference them by OID, so both follow
-- the move without being rewritten.
create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_member_of(uuid)        set schema private;
alter function public.is_admin_of(uuid)         set schema private;
alter function public.touch_business_activity() set schema private;

revoke all on function private.is_member_of(uuid)        from public, anon;
revoke all on function private.is_admin_of(uuid)         from public, anon;
revoke all on function private.touch_business_activity() from public, anon, authenticated;

grant execute on function private.is_member_of(uuid) to authenticated;
grant execute on function private.is_admin_of(uuid)  to authenticated;

-- subdomain_available stays in public and stays callable without
-- signing in, deliberately: the yard signup form checks a name before
-- an account exists. It leaks only whether a name is taken, which is
-- already public the moment the subdomain resolves.
comment on function public.subdomain_available(text) is
  'Intentionally callable by anon. Signup checks availability before an account exists, and the answer is already public via DNS.';
