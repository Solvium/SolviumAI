import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionManager } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    // Validate session
    const sessionValidation = await SessionManager.validateSession(request);

    if (!sessionValidation.isValid || !sessionValidation.userId) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    // Fetch user data from database
    const dbUser = await prisma.user.findUnique({
      where: { id: parseInt(sessionValidation.userId) },
      include: {
        linkedAccounts: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    // Prepare user data for response
    const userData = {
      id: dbUser.id.toString(),
      username: dbUser.username,
      email: dbUser.email,
      telegramId: dbUser.linkedAccounts.find(acc => acc.type === 'telegram')?.value,
      googleId: dbUser.linkedAccounts.find(acc => acc.type === 'google')?.value,
      totalPoints: dbUser.totalPoints,
      multiplier: dbUser.multiplier,
      level: dbUser.level,
      createdAt: dbUser.createdAt,
      lastLoginAt: dbUser.lastClaim,
      lastSpinClaim: dbUser.lastSpinClaim,
      dailySpinCount: dbUser.dailySpinCount,
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
