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
      email: user.email,
      name: user.name,
      totalPoints: user.totalPoints,
      multiplier: 1, // Default multiplier
      level: user.level,
      lastLoginAt: new Date(),
      lastSpinClaim: user.lastSpinClaim,
      dailySpinCount: user.dailySpinCount,
      spinCount: user.spinCount,
      claimCount: user.claimCount,
      isOfficial: user.isOfficial,
      isMining: user.isMining,
      isPremium: user.isPremium,
      weeklyPoints: user.weeklyPoints,
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
