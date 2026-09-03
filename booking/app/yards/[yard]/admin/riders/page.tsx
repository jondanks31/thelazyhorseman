import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { getYard, requireAdmin } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import { yardUrl } from '@/lib/tenant';
import Riders, { type Invite, type Rider } from './Riders';

type Props = { params: Promise<{ yard: string }> };

export default async function RidersPage({ params }: Props) {
  const { yard } = await params;
  const found = await getYard(yard);
  if (!found) notFound();
  await requireAdmin(yard, found.id);

  const supabase = await supabaseServer();

  const [people, invites, business] = await Promise.all([
    // yard_riders() reaches auth.users for the email, which the client
    // cannot read directly. See migration 0014.
    supabase.rpc('yard_riders', { p_business_id: found.id }),
    supabase
      .from('invite')
      .select('id, email, token, created_at, expires_at, accepted_at')
      .eq('business_id', found.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('business')
      .select('join_code')
      .eq('id', found.id)
      .maybeSingle<{ join_code: string }>(),
  ]);

  const code = business.data?.join_code ?? '';
  const joinLink = `${yardUrl(yard, (await headers()).get('host'))}/join/${code}`;

  // Drawn on the server so the page carries no QR library to the phone
  // that is only ever going to look at it.
  const qr = code
    ? await QRCode.toString(joinLink, {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'M',
        color: { dark: '#3C2E22', light: '#0000' },
      })
    : '';

  return (
    <>
      <div>
        <h1 className="admin-h">Riders</h1>
        <p className="admin-lead">Invite them, or put the code up in the tack room.</p>
      </div>
      <Riders
        yardId={found.id}
        riders={(people.data ?? []) as Rider[]}
        invites={(invites.data ?? []) as Invite[]}
        joinLink={joinLink}
        qrSvg={qr}
      />
    </>
  );
}
