import { NextRequest, NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credential } = body;

    if (!credential) {
      return NextResponse.json(
        { error: "Google credential is required" },
        { status: 400 }
      );
    }

    // Decode the JWT token from Google
    let decoded: any;
    try {
      decoded = jwtDecode(credential);
    } catch (error) {
      console.error("Failed to decode Google token:", error);
      return NextResponse.json(
        { error: "Invalid Google token format" },
        { status: 400 }
      );
    }

    // Validate the token
    if (!decoded.email || !decoded.sub) {
      return NextResponse.json(
        { error: "Invalid Google token - missing required fields" },
        { status: 400 }
      );
    }

    // Create mock user data (without database)
    const userData = {
      id: decoded.sub,
      username: decoded.email.split("@")[0],
      email: decoded.email,
      googleId: decoded.sub,
      firstName: decoded.given_name,
      lastName: decoded.family_name,
      avatar: decoded.picture,
      totalPoints: 0,
      multiplier: 1,
      level: 1,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      lastSpinClaim: new Date(),
      dailySpinCount: 0,
    };

    // Create response with simple cookie (without JWT for now)
    const response = NextResponse.json({
      success: true,
      user: userData,
    });

    // Set a simple auth cookie
    response.cookies.set("auth_token", userData.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Google auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed - please try again" },
      { status: 500 }
    );
  }
}
