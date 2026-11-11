import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'adherium_session';
const LOGIN_PATH = '/login';

async function hasValidSession(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) return false;

  const backend = process.env.BACKEND_API_URL || 'http://127.0.0.1:4000';
  try {
    const sessionUrl = new URL('/api/v1/auth/session', backend);
    const cookie = request.headers.get('cookie');
    const response = await fetch(sessionUrl, {
      headers: cookie ? { cookie } : undefined,
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const authenticated = await hasValidSession(request);
  const pathname = request.nextUrl.pathname;

  if (!authenticated && pathname !== LOGIN_PATH) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set('reason', 'unauthenticated');
    return NextResponse.redirect(loginUrl);
  }

  if (authenticated && pathname === LOGIN_PATH)
    return NextResponse.redirect(new URL('/overview', request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|prototype|favicon.ico).*)'],
};
