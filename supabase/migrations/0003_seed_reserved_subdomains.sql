-- Reserved names carry available_from = 'infinity', so
-- subdomain_available() can never return true for them. Same list as
-- validateSubdomain() in the app; the code catches it at input, this
-- catches anything that reaches the database another way.
--
-- Names under three characters are absent on purpose. The
-- subdomain_shape constraint already makes them impossible to store,
-- so 'mx' and 'ns' need no row to be unclaimable.
insert into public.subdomain (name, business_id, available_from)
select n, null, 'infinity'::timestamptz
from unnest(array[
  'www','mail','email','webmail','smtp','imap','pop','pop3',
  'ns1','ns2','dns','ftp','sftp','autodiscover','autoconfig',
  'cpanel','whm','webdisk','cdn','static','assets','media','files',
  'app','api','admin','administrator','dashboard','portal','console',
  'account','accounts','auth','login','logout','signin','signup',
  'register','oauth','sso','billing','pay','payments','checkout',
  'book','bookings','booking','letter','newsletter','tools','shop',
  'store','merch','sponsor','about','blog','news','issue','issues',
  'osstrack','stallio','yard','yards',
  'dev','development','staging','stage','test','testing','preview',
  'demo','sandbox','local','localhost','prod','production','beta','alpha',
  'status','health','healthz','monitor','uptime','support','help',
  'docs','doc','faq','contact',
  'abuse','security','postmaster','hostmaster','webmaster','noc','root',
  'ssl','tls','acme','legal','privacy','terms','gdpr','dpo',
  'vercel','supabase','hostinger','stripe','whatsapp',
  'new','edit','delete','settings','search','home','index',
  'null','undefined','true','false'
]) as n
on conflict (name) do nothing;
