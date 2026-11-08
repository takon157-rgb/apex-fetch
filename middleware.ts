import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboarding(.*)',
  '/jobs(.*)',
  '/api/public/(.*)',
  '/api/webhooks/(.*)',
  '/api/cron/(.*)',
  '/api/health(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId } = await auth();

  if (!userId) {
    // API routes get a plain 404 so we don't reveal which endpoints exist to
    // an unauthenticated caller.
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Page requests get an explicit redirect. Clerk's own `auth.protect()`
    // relies on a client-side "rewrite" that needs the dev browser script, so
    // a plain request (curl, health check, a crawler) would land on a 404
    // instead of the sign-in page. An explicit redirect behaves identically in
    // development and production.
    const signInUrl = new URL('/sign-in', req.url);
    // Keep the originally requested page so sign-in can send the user back.
    signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
