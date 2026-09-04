import { instantToZoned } from './time';
import type { Message } from './email';

/**
 * The messages the app sends, and the paper they are written on.
 *
 * Two rules hold this file together.
 *
 * Every message has a plain text version, written first, and the HTML
 * follows it. Text is what lands in a watch, a screen reader and every
 * client that refuses HTML, and writing it first stops the wording
 * leaning on a button that might never render.
 *
 * The look is the app's own, inline. Email clients strip stylesheets
 * and ignore anything clever, so this is a table, a border and a
 * background colour. The shadow and the real fonts are left behind on
 * purpose; what survives is the brown ground, the paper card and the
 * wonky corners.
 */

const INK = '#3C2E22';
const PAPER = '#F4F1E9';
const ON_PAPER = '#33291F';
const ON_PAPER_SOFT = '#5B4E40';
const ACCENT = '#7ED957';
const MUTED = '#BCAE9B';
const RULE = '#D8CFC0';

/** Archivo is on nobody's machine, so this is the nearest safe stack. */
const SANS = "Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'SF Mono',Menlo,Consolas,monospace";

/** Yard names, rider names and horse names are all typed by people. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const heading = (copy: string) =>
  `<h1 style="margin:0 0 16px;font-family:${SANS};font-size:26px;line-height:1.15;letter-spacing:-.02em;font-weight:800;color:${INK};">${esc(copy)}</h1>`;

const para = (copy: string) =>
  `<p style="margin:0 0 20px;font-family:${SANS};font-size:16px;line-height:1.6;color:${ON_PAPER};">${esc(copy)}</p>`;

const fine = (copy: string) =>
  `<p style="margin:18px 0 0;font-family:${SANS};font-size:14px;line-height:1.5;color:${ON_PAPER_SOFT};">${esc(copy)}</p>`;

/**
 * Bordered as well as filled, because a client that drops the
 * background colour still leaves something that reads as a button.
 */
const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 8px;"><tr>
    <td style="background:${ACCENT};border:3px solid ${INK};border-radius:22px 8px 24px 9px;">
      <a href="${esc(href)}" style="display:inline-block;padding:13px 24px;font-family:${SANS};font-size:16px;font-weight:700;color:${INK};text-decoration:none;">${esc(label)}</a>
    </td>
  </tr></table>`;

/** The same link written out, for a client that eats the button. */
const spelledOut = (href: string) =>
  `<p style="margin:0;font-family:${MONO};font-size:12px;line-height:1.5;word-break:break-all;color:${ON_PAPER_SOFT};"><a href="${esc(href)}" style="color:${ON_PAPER_SOFT};">${esc(href)}</a></p>`;

/** When, where, which horse. Labelled the way the app labels a field. */
const facts = (rows: [string, string][]) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;border-top:2px solid ${RULE};">
    ${rows
      .map(
        ([label, value]) => `<tr>
      <td width="1%" style="padding:11px 20px 11px 0;border-bottom:2px solid ${RULE};font-family:${MONO};font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:${ON_PAPER_SOFT};white-space:nowrap;vertical-align:top;">${esc(label)}</td>
      <td style="padding:10px 0;border-bottom:2px solid ${RULE};font-family:${SANS};font-size:16px;line-height:1.4;color:${ON_PAPER};">${esc(value)}</td>
    </tr>`,
      )
      .join('')}
  </table>`;

function shell({
  preheader,
  body,
  footer,
}: {
  /** What the inbox shows under the subject before anybody opens it. */
  preheader: string;
  body: string;
  footer: string;
}): string {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>The Lazy Horseman</title>
</head>
<body style="margin:0;padding:0;width:100%;background:${INK};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}${'&#8203;&nbsp;'.repeat(50)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${INK};">
<tr><td align="center" style="padding:32px 14px 44px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
  <tr><td style="padding:0 8px 16px;font-family:${MONO};font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:700;color:${MUTED};">
    The Lazy Horseman
  </td></tr>
  <tr><td style="background:${PAPER};border:3px solid ${INK};border-radius:30px 11px 32px 12px;padding:30px 28px;">
    ${body}
  </td></tr>
  <tr><td style="padding:18px 8px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED};">
    ${esc(footer)}
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Joins the plain text version and trims the ends off it. */
const text = (...lines: string[]) => `${lines.join('\n').trim()}\n`;

/** "10 Oct", for a date somebody only needs to the day. */
function shortDay(iso: string, timezone: string): string {
  return instantToZoned(iso, timezone, {
    weekday: undefined,
    hour: undefined,
    minute: undefined,
  });
}

// ── the invite ──────────────────────────────────────────────────

export function inviteNotice({
  yardName,
  invitedBy,
  joinUrl,
  expiresAt,
  timezone,
}: {
  yardName: string;
  /** Whoever pressed Invite: their name, or their email if they have none. */
  invitedBy: string;
  joinUrl: string;
  expiresAt: string;
  timezone: string;
}): Message {
  const runsOut = `The link is yours alone and stops working on ${shortDay(expiresAt, timezone)}.`;
  const sender = `${invitedBy} invited you. Reply to this email and it goes to them.`;

  return {
    subject: `Arena booking at ${yardName}`,
    text: text(
      `${yardName} has put you on the list.`,
      '',
      'You can see what is free and book yourself in from your phone.',
      '',
      `Join ${yardName}:`,
      joinUrl,
      '',
      runsOut,
      '',
      sender,
      '',
      'The Lazy Horseman',
    ),
    html: shell({
      preheader: `${yardName} has put you on the list.`,
      body: [
        heading(`${yardName} has put you on the list.`),
        para('You can see what is free and book yourself in from your phone.'),
        button(joinUrl, `Join ${yardName}`),
        spelledOut(joinUrl),
        fine(runsOut),
      ].join('\n'),
      footer: sender,
    }),
  };
}

// ── the yard has cancelled a rider's slot ───────────────────────

export function cancelledNotice({
  yardName,
  cancelledBy,
  facilityName,
  horseName,
  startsAt,
  timezone,
  bookUrl,
}: {
  yardName: string;
  cancelledBy: string;
  facilityName: string;
  horseName: string | null;
  startsAt: string;
  timezone: string;
  bookUrl: string;
}): Message {
  const when = instantToZoned(startsAt, timezone);
  // No reason field exists, so the yard is named and reply goes to
  // them. A rider who wants to know why has somewhere to ask.
  const sender = `${cancelledBy} cancelled it. Reply to this email and it goes to them.`;

  const rows: [string, string][] = [
    ['When', when],
    ['Where', facilityName],
  ];
  if (horseName) rows.push(['Horse', horseName]);

  return {
    subject: `${yardName} has cancelled your slot on ${shortDay(startsAt, timezone)}`,
    text: text(
      `${yardName} has cancelled your booking.`,
      '',
      ...rows.map(([label, value]) => `${label}: ${value}`),
      '',
      'Book another time:',
      bookUrl,
      '',
      sender,
      '',
      'The Lazy Horseman',
    ),
    html: shell({
      preheader: `${when}, ${facilityName}.`,
      body: [
        heading(`${yardName} has cancelled your booking.`),
        facts(rows),
        button(bookUrl, 'Book another time'),
      ].join('\n'),
      footer: sender,
    }),
  };
}
