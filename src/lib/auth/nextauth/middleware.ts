import { type NextRequest, NextResponse } from 'next/server';

import { auth } from './auth';

export async function nextAuthMiddleware(request: NextRequest) {
  const session = await auth();

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

  return NextResponse.next();
}
