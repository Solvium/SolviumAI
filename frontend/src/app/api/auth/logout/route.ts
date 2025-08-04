import { NextRequest, NextResponse } from "next/server";
import { SessionManager } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    // Get session ID from cookies
    const sessionId = request.cookies.get('session_id')?.value;

    if (sessionId) {
      // Invalidate the current session
      await SessionManager.invalidateSession(sessionId);
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    // Clear all session cookies
    SessionManager.clearSessionCookies(response);

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    
    // Even if there's an error, clear cookies
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
    
    SessionManager.clearSessionCookies(response);
    return response;
  }
}
