import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server client for server components and route handlers. Reads the
 * session from cookies so RLS sees the right user.
 *
 * Server components cannot set cookies, so writes are swallowed. The
 * middleware is what refreshes the session, which is why it exists.
 */
export async function supabaseServer() {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: () => {
          /* refreshed in middleware, not here */
        },
      },
    },
  );
}
