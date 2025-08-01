import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
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
    const decoded: any = jwtDecode(credential);

    // Validate the token
    if (!decoded.email || !decoded.sub) {
      return NextResponse.json(
        { error: "Invalid Google token" },
        { status: 400 }
      );
    }

    // Create or update user in database
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
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    // Set authentication cookie
    const cookieStore = cookies();
    cookieStore.set("auth_token", userData.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return NextResponse.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error("Google auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
