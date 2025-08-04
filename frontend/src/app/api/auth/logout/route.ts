import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Create response
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    // Clear the auth cookie
    response.cookies.delete("auth_token");

    return response;
  } catch (error) {
    console.error("Logout error:", error);

    // Even if there's an error, clear cookies
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    response.cookies.delete("auth_token");
    return response;
  }
}
