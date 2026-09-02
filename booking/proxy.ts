import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { tenantFromHost } from '@/lib/tenant';

/**
 * Two jobs, in this order. Named proxy.ts because Next 16 renamed the
 * middleware convention; the behaviour is unchanged.
 *
 * 1. Work out which yard the request is for, from the Host header, and
 *    rewrite it under /yards/<name>. The URL in the address bar stays
 *    the yard's own, which is the whole point of giving them one.
 *
 * 2. Refresh the Supabase auth cookie. Sessions expire, and without a
 *    refresh in here every server component would see a signed-in visitor
 *    as anonymous partway through the day.
 *
 * No database work happens here. This runs on every request,
 * including assets, so resolving the yard for real is left to the page
 * where the answer can be cached.
 */
export async function proxy(request: NextRequest) {
  const tenant = tenantFromHost(request.headers.get('host'));
  const path = request.nextUrl.pathname;

  let response: NextResponse;

  if (tenant && !path.startsWith('/yards/')) {
    const url = request.nextUrl.clone();
    url.pathname = `/yards/${tenant}${path === '/' ? '' : path}`;
    response = NextResponse.rewrite(url);
  } else if (!tenant && path.startsWith('/yards/')) {
    // /yards/* is an implementation detail of the rewrite above. Reaching
    // it directly on the platform host would let anyone read a yard
    // without going through its own address, so send them to signup.
    response = NextResponse.redirect(new URL('/start', request.url));
  } else {
    response = NextResponse.next({ request });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          // Written without a Domain attribute, so the session belongs
          // to one host only. A cookie scoped to .thelazyhorseman.com
          // would be readable by every other yard, and sharing sign-ins
          // across yards is a decision to take deliberately rather than
          // to inherit from a default.
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touching the user is what performs the refresh. The result is not
  // needed here; the pages read it themselves.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own assets, the favicon and image files.
     * Running on those would mean a pointless auth refresh per asset.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
