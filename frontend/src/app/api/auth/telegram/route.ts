import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    // Extract user data from Telegram WebApp
    const telegramId = telegramData.id?.toString();
    const username = telegramData.username;
    const firstName = telegramData.first_name;
    const lastName = telegramData.last_name;

    if (!telegramId) {
      return NextResponse.json(
        { error: "Telegram ID is required" },
        { status: 400 }
      );
    }

    // Check if user already exists in database by telegram ID or username
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ chatId: telegramId }, { username: username }],
      },
    });

    if (!user) {
      // Create new user in database
      user = await prisma.user.create({
        data: {
          username: username || `telegram_${telegramId}`,
          name: `${firstName || ""} ${lastName || ""}`.trim(),
          chatId: telegramId,
          email: null, // Telegram users don't have email
          referredBy: "", // Default empty value
          level: 1,
          difficulty: 1,
          puzzleCount: 1,
          referralCount: 0,
          spinCount: 0,
          dailySpinCount: 0,
          claimCount: 0,
          lastSpinClaim: new Date(),
          totalPoints: 0,
          isOfficial: false,
          isMining: false,
          isPremium: false,
          lastClaim: new Date(),
          weeklyPoints: 0,
        },
      });

      console.log("New Telegram user created:", user.username);
    } else {
      console.log("Existing Telegram user logged in:", user.username);
    }

    // Create user data for response
    const userData = {
      id: user.id.toString(),
      username: user.username,
      email: user.email || undefined, // Convert null to undefined for User interface
      name: user.name || undefined,
      telegramId: telegramId,
      totalPoints: user.totalPoints,
      multiplier: 1, // Default multiplier
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
      createdAt: new Date(), // Use current date since User model doesn't have createdAt
      lastLoginAt: new Date(),
      lastSpinClaim: user.lastSpinClaim,
      lastClaim: user.lastClaim,
      chatId: user.chatId || undefined,
      wallet: user.wallet || undefined,
    };

    // Generate tokens
    const accessToken = JWTService.generateAccessToken(userData);
    const refreshToken = JWTService.generateRefreshToken(
      userData.id,
      "telegram_session"
    );

    // Create session (commented out for now)
    // const session = await SessionManager.createSession(userData.id, refreshToken);

    // Set cookies
    const response = NextResponse.json({
      success: true,
      user: userData,
      accessToken,
      refreshToken,
    });

    response.cookies.set("auth_token", userData.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
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
