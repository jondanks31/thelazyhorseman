/**
 * The two values every Supabase client here needs, checked once.
 *
 * Both are inlined at build time, so a missing one takes the build down
 * rather than the site, which is the right way round. Supabase's own
 * message for this says the URL and key are required and points at
 * whichever component happened to be prerendered first, which sends you
 * reading that component instead of the deployment settings. This says
 * what to go and set.
 */
export function supabaseCredentials(): [url: string, key: string] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const missing = [
    url ? null : 'NEXT_PUBLIC_SUPABASE_URL',
    key ? null : 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ].filter((v): v is string => v !== null);

  if (missing.length > 0) {
    throw new Error(
      `Supabase is not configured: ${missing.join(' and ')} ` +
        `${missing.length > 1 ? 'are' : 'is'} missing. ` +
        'Set both in booking/.env.local for local work, and in the Vercel ' +
        'project settings for a deployment. See booking/.env.example.',
    );
  }

  return [url as string, key as string];
}
