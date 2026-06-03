import { NextRequest, NextResponse } from 'next/server';

// Minimal middleware — only protects non-auth, non-api routes.
// Does NOT interact with NextAuth to avoid edge runtime URL issues.
export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check for any NextAuth session cookie
  const sessionCookie =
    req.cookies.get('next-auth.session-token') ||
    req.cookies.get('__Secure-next-auth.session-token') ||
    req.cookies.get('authjs.session-token') ||
    req.cookies.get('__Secure-authjs.session-token');

  if (!sessionCookie) {
    const signIn = new URL('/auth/sign-in', req.nextUrl.origin);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

// Only protect app pages — NEVER run middleware on /api or /auth routes
export const config = {
  matcher: [
    '/dashboard',
    '/coach',
    '/analytics',
    '/reports',
    '/fitness/:path*',
    '/sleep',
    '/habits',
    '/english',
    '/kannada',
    '/career',
    '/checkin',
    '/profile',
  ],
};
