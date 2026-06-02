import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isAuthPage = pathname.startsWith('/auth');
  const isApiAuth = pathname.startsWith('/api/auth');

  if (isApiAuth) return NextResponse.next();

  // Use req.nextUrl (always a full URL in Next.js middleware) as the base
  if (!isLoggedIn && !isAuthPage) {
    const signIn = req.nextUrl.clone();
    signIn.pathname = '/auth/sign-in';
    return NextResponse.redirect(signIn);
  }
  if (isLoggedIn && isAuthPage) {
    const dashboard = req.nextUrl.clone();
    dashboard.pathname = '/dashboard';
    return NextResponse.redirect(dashboard);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',],
};
