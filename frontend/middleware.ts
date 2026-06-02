import { NextRequest, NextResponse } from 'next/server';

// Use cookie-based auth check instead of NextAuth auth() to avoid
// URL construction issues in Next.js 16 proxy runtime.
export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow auth routes and API routes through
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for any NextAuth session cookie (v4 or v5)
  const sessionCookie =
    req.cookies.get('next-auth.session-token') ||
    req.cookies.get('__Secure-next-auth.session-token') ||
    req.cookies.get('authjs.session-token') ||
    req.cookies.get('__Secure-authjs.session-token');

  if (!sessionCookie) {
    const signIn = req.nextUrl.clone();
    signIn.pathname = '/auth/sign-in';
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',],
};
