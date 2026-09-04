/**
 * Sending email, through Resend.
 *
 * One POST rather than their SDK. This is the only outbound call the
 * app makes and it does not need a dependency to make it.
 *
 * Nothing in here throws. An email is always the second half of
 * something that has already happened: an invite is written, a slot is
 * cancelled. A failure to send must report itself and leave the first
 * half standing, so every caller gets a result it can put on screen
 * rather than an exception that loses the work.
 *
 * RESEND_API_KEY is server only. It must never be NEXT_PUBLIC_,
 * which would inline it into the browser bundle.
 */

const ENDPOINT = 'https://api.resend.com/emails';

/** Ten seconds, so a slow Resend cannot hold a request open. */
const TIMEOUT_MS = 10_000;

export type Sent =
  | { sent: true; id: string }
  /** No key in the environment. Local work, mostly. */
  | { sent: false; reason: 'notConfigured' }
  /** Refused, timed out, or the network went. Why is in the log. */
  | { sent: false; reason: 'failed' };

export type Message = {
  subject: string;
  text: string;
  html: string;
};

/**
 * Who it comes from. The address has to sit on a domain verified in
 * Resend or every send is refused, so this is a setting rather than a
 * literal: a preview deployment can send from somewhere else.
 */
export function emailFrom(): string {
  return process.env.EMAIL_FROM ?? 'The Lazy Horseman <bookings@thelazyhorseman.com>';
}

export function emailIsConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * `replyTo` is the person the message is really from, usually whoever
 * runs the yard. A rider wanting to know why their slot went should
 * reach them by pressing reply, not by finding the yard's number.
 */
export async function sendEmail(
  to: string,
  message: Message,
  replyTo?: string | null,
): Promise<Sent> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: 'notConfigured' };

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        from: emailFrom(),
        to: [to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(replyTo ? { reply_to: [replyTo] } : {}),
      }),
    });

    if (!response.ok) {
      // Resend says why in the body. That goes to the log and no
      // further: it talks about sending domains and key permissions,
      // which is nothing to do with whoever pressed the button.
      console.error('email refused', response.status, await response.text());
      return { sent: false, reason: 'failed' };
    }

    const body = (await response.json()) as { id?: string };
    return { sent: true, id: body.id ?? '' };
  } catch (cause) {
    console.error('email failed', cause);
    return { sent: false, reason: 'failed' };
  }
}
