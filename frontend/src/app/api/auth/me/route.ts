import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get("auth_token");

    if (!authToken) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    // For now, return mock user data
    const userData = {
      id: authToken.value,
      username: "user_" + authToken.value.slice(-6),
      totalPoints: 0,
      multiplier: 1,
      level: 1,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      lastSpinClaim: new Date(),
      dailySpinCount: 0,
    };

    return NextResponse.json({
      authenticated: true,
      user: userData,
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }
}
