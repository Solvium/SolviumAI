import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionManager } from "@/lib/auth/session";
import { JWTService } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData, user } = body;

    // Validate Telegram Web App data
    if (!user || !user.id || !user.username) {
      return NextResponse.json(
        { error: "Invalid Telegram user data - missing required fields" },
        { status: 400 }
      );
    }

    // Check if user exists or create new user
    let dbUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: user.username }, { chatId: user.id.toString() }],
      },
    });

    if (!dbUser) {
      // Create new user
      dbUser = await prisma.user.create({
        data: {
          username: user.username,
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          chatId: user.id.toString(),
          referredBy: "telegram",
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
        },
      });
    } else {
      // Update last login
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { lastClaim: new Date() },
      });
    }

    // Create or update login method
    try {
      await prisma.loginMethod.upsert({
        where: {
          type_value: {
            type: "telegram",
            value: user.id.toString(),
          },
        },
        update: {},
        create: {
          type: "telegram",
          value: user.id.toString(),
          userId: dbUser.id,
        },
      });
    } catch (error) {
      console.error("Failed to upsert login method:", error);
      // Continue anyway - this is not critical
    }

    // Create secure session
    const sessionData = await SessionManager.createSession(
      dbUser.id.toString()
    );

    // Prepare user data for response
    const userData = {
      id: dbUser.id.toString(),
      username: dbUser.username,
      telegramId: user.id.toString(),
      firstName: user.first_name,
      lastName: user.last_name,
      avatar: user.photo_url,
      totalPoints: dbUser.totalPoints,
      multiplier: dbUser.multiplier,
      level: dbUser.level,
      createdAt: dbUser.createdAt,
      lastLoginAt: new Date(),
      lastSpinClaim: dbUser.lastSpinClaim,
      dailySpinCount: dbUser.dailySpinCount,
    };

    // Create response with secure cookies
    const response = NextResponse.json({
      success: true,
      user: userData,
    });

    // Set secure session cookies
    SessionManager.setSessionCookies(response, sessionData);

    return response;
  } catch (error) {
    console.error("Telegram auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed - please try again" },
      { status: 500 }
    );
  }
}
