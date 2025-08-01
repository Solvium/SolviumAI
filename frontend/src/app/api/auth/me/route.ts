import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    // Here you would typically validate the token and fetch user data from database
    // For now, we'll return a mock response
    const userData = {
      id: authToken.value,
      username: "user_" + authToken.value.slice(-6),
      totalPoints: 0,
      multiplier: 1,
      createdAt: new Date(),
      lastLoginAt: new Date(),
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
