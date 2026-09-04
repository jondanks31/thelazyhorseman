import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminOrReason, getYard } from '@/lib/yard';
import { supabaseServer } from '@/lib/supabase-server';
import { yardUrl } from '@/lib/tenant';
import { personName, yardPeople } from '@/lib/people';
import { sendEmail } from '@/lib/email';
import { inviteNotice } from '@/lib/notices';

/**
 * Inviting a rider, and sending them the link.
 *
 * The row used to be written straight from the browser, which is why
 * invites were created and never delivered. Writing it here changes
 * nothing about who is allowed to do it: this runs as the signed-in
 * admin, so row level security is still the guard and there is still
 * no service role key anywhere. What the server adds is the ability to
 * hold RESEND_API_KEY, which the browser must never see.
 *
 * Two shapes of request:
 *   { email }    invite somebody new, or send an outstanding invite
 *                for that address again rather than making a second
 *   { inviteId } send an existing invite again, from the list
 *
 * The reply always carries the link. Sending can be off, or Resend can
 * refuse, and the yard needs a way to get the rider on regardless.
 */

type Invite = {
  id: string;
  email: string;
  token: string;
  expires_at: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ yard: string }> },
) {
  const { yard } = await params;

  const found = await getYard(yard);
  if (!found) {
    return NextResponse.json({ error: 'No such yard.' }, { status: 404 });
  }

  const who = await adminOrReason(found.id);
  if (!who.ok) {
    return NextResponse.json({ error: who.error }, { status: who.status });
  }

  let body: { email?: unknown; inviteId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const supabase = await supabaseServer();

  let invite: Invite;

  if (typeof body.inviteId === 'string') {
    const { data } = await supabase
      .from('invite')
      .select('id, email, token, expires_at')
      .eq('id', body.inviteId)
      .eq('business_id', found.id)
      .is('accepted_at', null)
      .maybeSingle<Invite>();

    if (!data) {
      return NextResponse.json(
        { error: 'That invite has gone. Invite them again.' },
        { status: 404 },
      );
    }
    if (new Date(data.expires_at) <= new Date()) {
      return NextResponse.json(
        { error: 'That invite has run out. Invite them again.' },
        { status: 409 },
      );
    }
    invite = data;
  } else {
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (email.indexOf('@') < 1 || email.endsWith('@')) {
      return NextResponse.json({ error: 'That is not an email address.' }, { status: 400 });
    }

    // Inviting somebody the yard already has does no harm, join_yard()
    // ignores it, but the yard is left waiting for an acceptance that
    // will never come. Blocked is worth its own sentence: accepting an
    // invite deliberately does not undo a block, so an invite is the
    // wrong button and saying "already on the yard" would be a lie.
    const people = await yardPeople(found.id);
    const already = [...people.values()].find((p) => p.email.toLowerCase() === email);
    if (already) {
      return NextResponse.json(
        {
          error:
            already.status === 'blocked'
              ? `${personName(already)} is blocked. Let them back on instead.`
              : `${personName(already)} is already on the yard.`,
        },
        { status: 409 },
      );
    }

    // An outstanding invite for the same address gets sent again
    // instead of a second one being made. Two live links to the same
    // inbox only confuse whoever is looking at the list later.
    const { data: outstanding } = await supabase
      .from('invite')
      .select('id, email, token, expires_at')
      .eq('business_id', found.id)
      .eq('email', email)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<Invite>();

    if (outstanding) {
      invite = outstanding;
    } else {
      const { data, error } = await supabase
        .from('invite')
        .insert({ business_id: found.id, email, invited_by: who.user.id })
        .select('id, email, token, expires_at')
        .single<Invite>();

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message ?? 'Could not make that invite.' },
          { status: 400 },
        );
      }
      invite = data;
    }
  }

  const link = `${yardUrl(yard, (await headers()).get('host'))}/join/${invite.token}`;

  // The yard's timezone, so "runs out on 4 Oct" is the yard's 4 Oct.
  const { data: business } = await supabase
    .from('business')
    .select('timezone')
    .eq('id', found.id)
    .maybeSingle<{ timezone: string }>();

  const { data: profile } = await supabase
    .from('profile')
    .select('name')
    .eq('user_id', who.user.id)
    .maybeSingle<{ name: string | null }>();

  const result = await sendEmail(
    invite.email,
    inviteNotice({
      yardName: found.name,
      invitedBy: profile?.name?.trim() || who.user.email || 'The yard',
      joinUrl: link,
      expiresAt: invite.expires_at,
      timezone: business?.timezone ?? 'Europe/London',
    }),
    // A rider replying to an invite means to reach the person who sent
    // it, not us.
    who.user.email,
  );

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    email: invite.email,
    link,
  });
}
