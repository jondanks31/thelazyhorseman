import { createBrowserClient } from '@supabase/ssr';
import { supabaseCredentials } from './supabase-config';

/**
 * Browser client. The publishable key is safe here by design: every
 * table is behind row level security, so this key only ever reaches
 * what the signed-in user is allowed to reach.
 */
export function supabaseBrowser() {
  return createBrowserClient(...supabaseCredentials());
}
