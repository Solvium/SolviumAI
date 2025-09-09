import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionManager } from "@/lib/auth/session";
import { JWTService } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const { initData } = await request.json();
    if (!initData) {
      return NextResponse.json(
        { error: "Telegram data is required" },
        { status: 400 }
      );
    }

    // Extract user data from Telegram WebApp (be tolerant to shapes)
    const src = initData || {};
    const tgUser =
      src.user || src.telegramData || src.initDataUnsafe?.user || {};
    const telegramId = (tgUser.id ?? src.id)?.toString();
    const username = tgUser.username ?? src.username;
    const firstName = tgUser.first_name ?? src.first_name;
    const lastName = tgUser.last_name ?? src.last_name;

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
    } else {
    }

    // Parse wallet data if it exists
    let walletData = null;
    if (user.wallet) {
      try {
        walletData =
          typeof user.wallet === "string"
            ? JSON.parse(user.wallet)
            : user.wallet;
      } catch (error) {
        console.error("Error parsing wallet data:", error);
      }
    }

    // Create complete user data for response
    const userData = {
      id: user.id.toString(),
      username: user.username,
      email: user.email || undefined, // Convert null to undefined for User interface

      googleId: undefined, // Not available for Telegram auth
      firstName: firstName,
      lastName: lastName,
      avatar: undefined, // Telegram doesn't provide avatar in this context
      totalPoints: user.totalPoints || 0,
      multiplier: 1, // Default multiplier
      level: user.level || 1,
      difficulty: user.difficulty || 1,
      puzzleCount: user.puzzleCount || 0,
      referralCount: user.referralCount || 0,
      spinCount: user.spinCount || 0,
      dailySpinCount: user.dailySpinCount || 0,
      claimCount: user.claimCount || 0,
      isOfficial: user.isOfficial || false,
      isMining: user.isMining || false,
      isPremium: user.isPremium || false,
      weeklyPoints: user.weeklyPoints || 0,
      createdAt: new Date(), // Default since not in schema
      lastLoginAt: new Date(),
      lastSpinClaim: user.lastSpinClaim || undefined,
      lastClaim: user.lastClaim || undefined,
      chatId: user.chatId || undefined,
      wallet: walletData, // Include parsed wallet data
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
      secure: true, // required for SameSite=None
      sameSite: "none", // works in embedded webviews/iframes
      path: "/",
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
