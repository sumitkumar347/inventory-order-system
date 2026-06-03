import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public routes that don't require authentication
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') || // Allow login API endpoints
    pathname === '/login' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const tokenCookie = request.cookies.get('session_token');
  const token = tokenCookie?.value;

  // If visiting login, handle redirect if already authenticated
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

  // If no token exists for other routes, redirect to /login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Verify the JWT token
  const user = await verifySessionToken(token);
  if (!user) {
    // Invalid token, clear cookie and redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session_token');
    return response;
  }

  // Admin routing check
  if (pathname.startsWith('/admin') && user.role !== 'ADMIN') {
    // If trying to access admin but not admin, redirect to seller home
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Add the user metadata to request headers so pages/actions can read it easily
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
    /*
     * Match all request paths except:
     * - api/auth (auth api endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes that might be public (if any)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
