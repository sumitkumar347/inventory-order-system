import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from './lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/login' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const tokenCookie = request.cookies.get('session_token');
  const token = tokenCookie?.value;

  if (pathname === '/login') {
    if (token) {
      const user = await verifySessionToken(token);
      if (user) {
        if (user.role === 'ADMIN') {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        }
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const user = await verifySessionToken(token);
  if (!user) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session_token');
    return response;
  }

  if (pathname.startsWith('/admin') && user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', user.id);
  requestHeaders.set('x-user-email', user.email);
  requestHeaders.set('x-user-role', user.role);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
