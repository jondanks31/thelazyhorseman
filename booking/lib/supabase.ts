import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client. The publishable key is safe here by design: every
 * table is behind row level security, so this key only ever reaches
 * what the signed-in user is allowed to reach.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
