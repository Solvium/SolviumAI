import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle game routes
  if (pathname.startsWith("/game/")) {
    const gameId = pathname.split("/")[2];

    // List of valid game IDs
    const validGameIds = [
      "wordle",
      "quiz",
      "puzzle",
      "picture-puzzle",
      "num-genius",
      "cross-word",
    ];

    // If invalid game ID, redirect to home
    if (!validGameIds.includes(gameId)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
