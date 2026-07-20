import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/reset-password',
  '/auth/verify-email',
];

// Routes that require authentication
const protectedRoutes = [
  '/org',
  '/dashboard',
  '/properties',
  '/rooms',
  '/bookings',
  '/guests',
  '/payments',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get session
  const session = await auth();

  // Check if route is public
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  // Redirect authenticated users away from auth pages
  if (session && isPublicRoute) {
    return NextResponse.redirect(new URL('/org', request.url));
  }

  // Redirect unauthenticated users to sign in
  if (!session && isProtectedRoute) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }

  // Allow request to proceed
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
