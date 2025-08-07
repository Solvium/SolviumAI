import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Force dynamic rendering since this route uses cookies
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get("auth_token");

    if (!authToken) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    // Look up user in database by ID
    const userId = parseInt(authToken.value);

    if (isNaN(userId)) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    // Return user data from database
    const userData = {
      id: user.id.toString(),
      username: user.username,
      email: user.email || undefined,
      telegramId: undefined, // Not in current schema
      googleId: undefined, // Not in current schema
      firstName: user.name || undefined,
      lastName: undefined, // Not in current schema
      avatar: undefined, // Not in current schema
      name: user.name || undefined,
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
      lastLoginAt: new Date(),
      lastSpinClaim: user.lastSpinClaim,
      lastClaim: user.lastClaim || new Date(), // Ensure lastClaim is always included
      chatId: user.chatId || undefined,
      wallet: user.wallet || undefined,
    };

    console.log("User data being returned:", userData);
    console.log("User from database:", user);
    console.log("lastClaim from database:", user.lastClaim);
    console.log("lastClaim in userData:", userData.lastClaim);

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
