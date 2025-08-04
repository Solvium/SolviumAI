import { NextRequest, NextResponse } from "next/server";
import { SessionManager } from "@/lib/auth/session";
import { RateLimiter, RATE_LIMIT_CONFIGS } from "@/lib/auth/rateLimit";

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
    // Rate limiting for API routes
    const rateLimitResult = await RateLimiter.checkRateLimit(
      request,
      RATE_LIMIT_CONFIGS.api
    );

    if (!rateLimitResult.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: "Too many requests",
          message: "Rate limit exceeded. Please try again later.",
          resetTime: rateLimitResult.resetTime,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.resetTime.toISOString(),
          },
        }
      );
    }

    // Add rate limit headers
    response.headers.set(
      "X-RateLimit-Remaining",
      rateLimitResult.remaining.toString()
    );
    response.headers.set(
      "X-RateLimit-Reset",
      rateLimitResult.resetTime.toISOString()
    );

    // Special handling for auth routes
    if (pathname.startsWith("/api/auth/")) {
      // Rate limiting for auth routes
      const authRateLimitResult = await RateLimiter.checkRateLimit(
        request,
        RATE_LIMIT_CONFIGS.login
      );

      if (!authRateLimitResult.allowed) {
        return new NextResponse(
          JSON.stringify({
            error: "Too many authentication attempts",
            message: "Too many login attempts. Please try again later.",
            resetTime: authRateLimitResult.resetTime,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Remaining": authRateLimitResult.remaining.toString(),
              "X-RateLimit-Reset": authRateLimitResult.resetTime.toISOString(),
            },
          }
        );
      }

      // Skip session validation for login/register endpoints
      if (
        pathname === "/api/auth/telegram" ||
        pathname === "/api/auth/google"
      ) {
        return response;
      }

      // Validate session for other auth routes
      if (pathname !== "/api/auth/me" && pathname !== "/api/auth/logout") {
        const sessionValidation = await SessionManager.validateSession(request);

        if (!sessionValidation.isValid) {
          return new NextResponse(
            JSON.stringify({
              error: "Unauthorized",
              message: "Invalid or expired session",
            }),
            {
              status: 401,
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
        }
      }
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
