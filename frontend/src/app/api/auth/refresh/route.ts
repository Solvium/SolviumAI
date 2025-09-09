import { NextRequest, NextResponse } from "next/server";
import { SessionManager } from "@/lib/auth/session";
import { JWTService } from "@/lib/auth/jwt";
// import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Try to get refresh token from request body first
    let refreshToken;
    try {
      const body = await request.json();
      refreshToken = body?.refreshToken;
    } catch (parseError) {

    }

    // If no refresh token in body, try to get it from cookies
    if (!refreshToken) {
      refreshToken = request.cookies.get("refreshToken")?.value;
    }

    if (!refreshToken) {
      console.error("No refresh token found in body or cookies");
      return NextResponse.json(
        { error: "Refresh token is required" },
        { status: 400 }
      );
    }

    // Verify refresh token
    const decoded = JWTService.verifyRefreshToken(refreshToken);
    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 }
      );
    }

    // Check if session exists and is valid
    // const session = await SessionManager.getSession(refreshToken);
    // if (!session) {
    //   return NextResponse.json(
    //     { error: "Session not found" },
    //     { status: 401 }
    //   );
    // }

    // Get user data
    // const user = await prisma.user.findUnique({
    //   where: { id: decoded.userId },
    // });

    // if (!user) {
    //   return NextResponse.json(
    //     { error: "User not found" },
    //     { status: 404 }
    //   );
    // }

    // Generate new access token
    const mockUser = {
      id: decoded.userId,
      username: "testuser",
      email: "test@example.com",
      telegramId: undefined,
      googleId: undefined,
      totalPoints: 0,
      multiplier: 1,
      level: 1,
      difficulty: 1,
      puzzleCount: 1,
      referralCount: 0,
      spinCount: 0,
      dailySpinCount: 0,
      claimCount: 0,
      isOfficial: false,
      isMining: false,
      isPremium: false,
      weeklyPoints: 0,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      lastSpinClaim: new Date(),
      lastClaim: new Date(),
    };

    const newAccessToken = JWTService.generateAccessToken(mockUser);

    // Update session with new access token
    // await SessionManager.updateSession(refreshToken, newAccessToken);

    const response = NextResponse.json({
      accessToken: newAccessToken,
      refreshToken: refreshToken, // Keep the same refresh token
    });

    // Set the new access token as a cookie
    response.cookies.set("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60, // 15 minutes
    });

    return response;
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh token" },
      { status: 500 }
    );
  }
}
