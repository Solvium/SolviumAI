import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 }
      );
    }

    // Get user ID from token
    const userId = parseInt(authToken.value);

    if (isNaN(userId)) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 }
      );
    }

    // Get complete user data from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        wallet: true,
        level: true,
        difficulty: true,
        puzzleCount: true,
        referralCount: true,
        spinCount: true,
        dailySpinCount: true,
        claimCount: true,
        isOfficial: true,
        isMining: true,
        isPremium: true,
        weeklyPoints: true,
        lastSpinClaim: true,
        lastClaim: true,
        chatId: true,
        totalPoints: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 404 }
      );
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

    // Format user data to match the User interface
    const userData = {
      id: user.id.toString(),
      username: user.username,
      email: user.email || undefined,
      googleId: undefined, // Not in current schema
      firstName: user.name ? user.name.split(" ")[0] : undefined,
      lastName: user.name ? user.name.split(" ").slice(1).join(" ") : undefined,
      avatar: undefined, // Add if you have avatar field
      totalPoints: user.totalPoints || 0,
      multiplier: 1, // Default multiplier since it's not in schema
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
      lastLoginAt: new Date(), // Default since not in schema
      lastSpinClaim: user.lastSpinClaim || undefined,
      lastClaim: user.lastClaim || undefined,
      chatId: user.chatId || undefined,
      wallet: walletData, // Include parsed wallet data
    };

    return NextResponse.json({
      authenticated: true,
      user: userData,
    });
  } catch (error) {
    console.error("Error in /api/auth/me:", error);
    return NextResponse.json(
      { authenticated: false, user: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
