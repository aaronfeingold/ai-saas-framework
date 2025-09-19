import { type NextRequest, NextResponse } from 'next/server';

import { createServerClient } from '@supabase/ssr';

const AUTH_PROVIDER = process.env.AUTH_PROVIDER || 'supabase';

async function supabaseMiddleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user: session },
  } = await supabase.auth.getUser();

  return { session, response };
}

async function nextAuthMiddleware() {
  try {
    const { auth } = await import('@/lib/auth/nextauth/auth');
    const session = await auth();
    return { session, response: NextResponse.next() };
  } catch {
    // NextAuth.js not available, fallback to no session
    return { session: null, response: NextResponse.next() };
  }
}

export async function middleware(request: NextRequest) {
  let session = null;
  let response = NextResponse.next();

  // Use the appropriate auth middleware based on configuration
  if (AUTH_PROVIDER === 'nextauth') {
    const result = await nextAuthMiddleware(request);
    session = result.session;
    response = result.response;
  } else {
    const result = await supabaseMiddleware(request);
    session = result.session;
    response = result.response;
  }

  // Handle route-specific redirects
  const currentRoute = request.nextUrl.pathname;
  if (currentRoute.startsWith('/protected') && !session) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = '/signin';
    return NextResponse.redirect(redirectUrl);
  }

  if (currentRoute.startsWith('/chat') && !session) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = '/signin';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
// Matcher to exclude certain paths from middleware
export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|favicons/.*\\.png|manifest.webmanifest|manifest.json|api/.*|fonts/.*|sitemap.xml|robots.txt|manifest.json|manifest.webmanifest|\\.well-known/.*).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
