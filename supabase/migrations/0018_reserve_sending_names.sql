-- Sending email puts real DNS records on names a yard could otherwise
-- have claimed.
--
-- The return path for Resend is send.thelazyhorseman.com, which now
-- carries an MX and a TXT record. The wildcard CNAME that points every
-- yard subdomain at the booking app only applies to names with no
-- records of their own, so a yard called "send" would have an address
-- that never resolves. Reserve it before anybody finds out the hard
-- way, along with the rest of the mail furniture.
--
-- Same list as validateSubdomain() in the app. Keep the two in step.
insert into public.subdomain (name, business_id, available_from)
select n, null, 'infinity'::timestamptz
from unnest(array[
  'send','resend','bounce','bounces','dkim','dmarc','spf'
]) as n
on conflict (name) do nothing;
