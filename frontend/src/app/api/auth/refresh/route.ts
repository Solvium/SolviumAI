import { NextRequest, NextResponse } from "next/server";
import { SessionManager } from "@/lib/auth/session";
import { JWTService } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Try to get refresh token from request body first
    let refreshToken;
    try {
      const body = await request.json();
      refreshToken = body?.refreshToken;
    } catch (parseError) {}

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

    // Validate the refresh token and session
    const sessionValid = await SessionManager.validateSession(refreshToken);
    if (!sessionValid) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.userId) },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate new access token
    const jwtUser = {
      id: user.id.toString(),
      username: user.username,
      email: user.email || undefined,
      telegramId: user.chatId || undefined,
      googleId: user.email || undefined,
      totalPoints: user.totalPoints,
      multiplier: 1, // Default value since it's not in the database
      level: user.level,
      difficulty: user.difficulty,
      puzzleCount: user.puzzleCount,
      referralCount: user.referralCount,
      spinCount: user.spinCount,
      dailySpinCount: user.dailySpinCount,
      claimCount: user.claimCount,
      isOfficial: user.isOfficial,
      isMining: user.isMining,
      isPremium: user.isPremium,
      weeklyPoints: user.weeklyPoints,
      createdAt: user.createdAt,
      lastLoginAt: user.updatedAt, // Use updatedAt as lastLoginAt
      lastSpinClaim: user.lastSpinClaim || undefined,
      lastClaim: user.lastClaim || undefined,
      chatId: user.chatId || undefined,
      wallet: user.wallet,
      experience_points: user.experience_points,
      contests_participated: user.contests_participated,
      tasks_completed: user.tasks_completed,
    };
    const newAccessToken = JWTService.generateAccessToken(jwtUser);

    // Session is already validated above, no need to refresh it

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
