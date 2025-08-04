import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Add security headers to all responses
  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  // Content Security Policy - Updated for Google OAuth
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://telegram.org",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    "style-src-elem 'self' 'unsafe-inline' https://accounts.google.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self'",
    "connect-src 'self' https://accounts.google.com https://telegram.org",
    "frame-src 'self' https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  // Handle API routes
  if (pathname.startsWith("/api/")) {
    // For now, skip rate limiting until database is properly configured
    // We'll add it back once the database connection is working

    // Special handling for auth routes
    if (pathname.startsWith("/api/auth/")) {
      // Skip session validation for login/register endpoints
      if (
        pathname === "/api/auth/telegram" ||
        pathname === "/api/auth/google"
      ) {
        return response;
      }

      // For now, allow all auth routes to pass through
      // We'll add proper session validation once database is working
    }
  }

  return response;
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
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
