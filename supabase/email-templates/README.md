# Supabase auth emails

Confirming an address and resetting a password are the two emails
Supabase sends rather than the app. Everything else goes through
`booking/lib/notices.ts`.

All of this is dashboard configuration. None of it can be applied from
the repo, so this file is the record of what to set.

## 1. Send them through Resend

Authentication → Emails → SMTP Settings → Enable custom SMTP.

| Field | Value |
|---|---|
| Sender email | `bookings@thelazyhorseman.com` |
| Sender name | `The Lazy Horseman` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a Resend API key |

Two reasons, and the second matters more than the branding. Supabase's
built-in sender is shared and rate limited hard enough that it has
already blocked repeat signup testing on this project. Its own limit
also applies per hour across every project on the free tier.

Make a **second** Resend key for this, named for Supabase, rather than
reusing `RESEND_API_KEY` from the app. Sending access, restricted to
`thelazyhorseman.com`. One key per thing that sends means either can be
rotated on its own.

## 2. Redirect URLs

Authentication → URL Configuration → Redirect URLs. Reset links land on
whichever host asked for them, and for a rider that is their yard's own
address, so the wildcard is doing real work.

```
https://book.thelazyhorseman.com/**
https://*.thelazyhorseman.com/**
http://localhost:4330/**
```

Site URL stays `https://book.thelazyhorseman.com`. The app passes
`emailRedirectTo` on both signup paths, so Site URL is only the fallback.

## 3. The templates

Authentication → Emails. Paste each file into the matching Message body:

- `confirm-signup.html` → **Confirm signup**
- `reset-password.html` → **Reset password**

Subjects worth setting at the same time:

- Confirm signup: `Confirm your email`
- Reset password: `A way back into your booking`

Magic Link, Invite and Change Email are not used. Invites are the app's
own, in `lib/notices.ts`, because they carry the yard's name and go
through `join_yard()` rather than Supabase's own invite flow.

The two files repeat the shell from `booking/lib/notices.ts` rather than
sharing it, because Supabase renders them and the app never sees them.
Change the look in one place and change it in the other.
