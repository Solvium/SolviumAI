import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
import { SessionManager } from "@/lib/auth/session";
import { JWTService } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const { telegramData } = await request.json();

    if (!telegramData) {
      return NextResponse.json(
        { error: "Telegram data is required" },
        { status: 400 }
      );
    }

    // For now, use mock user data instead of database
    const mockUser = {
      id: "telegram_" + Date.now(),
      username: telegramData.username || "telegram_user",
      email: undefined,
      telegramId: telegramData.id?.toString(),
      googleId: undefined,
      totalPoints: 0,
      multiplier: 1,
      level: 1,
      difficulty: 1,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    // Generate tokens
    const accessToken = JWTService.generateAccessToken(mockUser);
    const refreshToken = JWTService.generateRefreshToken(
      mockUser.id,
      "telegram_session"
    );

    // Create session (commented out for now)
    // const session = await SessionManager.createSession(mockUser.id, refreshToken);

    // Set cookies
    const response = NextResponse.json({
      success: true,
      user: mockUser,
      accessToken,
      refreshToken,
    });

    response.cookies.set("auth_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
    });

    return response;
  } catch (error) {
    console.error("Telegram auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
