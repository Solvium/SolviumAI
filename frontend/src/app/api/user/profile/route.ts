import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { JWTService } from "@/lib/auth/jwt";

async function getAuthenticatedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken");
  const legacyToken = cookieStore.get("auth_token");

  // Try JWT token first, then fallback to legacy token
  let userId: number | null = null;

  if (accessToken) {
    try {
      const decoded = JWTService.verifyAccessToken(accessToken.value);
      const uid = parseInt(decoded.userId);
      userId = Number.isNaN(uid) ? null : uid;
    } catch (e) {
      console.log("JWT verification failed:", e);
      userId = null;
    }
  }

  // Fallback to legacy token if JWT fails
  if (!userId && legacyToken) {
    try {
      const uid = parseInt(legacyToken.value);
      userId = Number.isNaN(uid) ? null : uid;
    } catch (e) {
      console.log("Legacy token verification failed:", e);
      userId = null;
    }
  }

  return userId;
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const updates = body as Partial<{
      totalPoints?: number;
      totalSOLV?: number;
      level?: number;
      difficulty?: number;
      experience_points?: number;
      gamesPlayed?: number;
      gamesWon?: number;
      weeklyPoints?: number;
      puzzleCount?: number;
      spinCount?: number;
      dailySpinCount?: number;
      claimCount?: number;
      isOfficial?: boolean;
      isMining?: boolean;
      isPremium?: boolean;
      avatar_url?: string;
      name?: string;
      email?: string;
    }>;

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates,
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
        experience_points: true,
        totalSOLV: true,
        gamesPlayed: true,
        gamesWon: true,
        avatar_url: true,
        contests_participated: true,
        tasks_completed: true,
        last_level_up: true,
      },
    });

    // Parse wallet data if it exists
    let walletData = null;
    if (updatedUser.wallet) {
      try {
        walletData =
          typeof updatedUser.wallet === "string"
            ? JSON.parse(updatedUser.wallet)
            : updatedUser.wallet;
      } catch (error) {
        console.error("Error parsing wallet data:", error);
      }
    }

    // Format user data to match the User interface
    const userData = {
      id: updatedUser.id.toString(),
      username: updatedUser.username,
      email: updatedUser.email || undefined,
      totalPoints: updatedUser.totalPoints,
      totalSOLV: updatedUser.totalSOLV ?? 0,
      multiplier: 1, // Default multiplier
      level: updatedUser.level,
      difficulty: updatedUser.difficulty,
      puzzleCount: updatedUser.puzzleCount,
      referralCount: updatedUser.referralCount,
      spinCount: updatedUser.spinCount,
      dailySpinCount: updatedUser.dailySpinCount,
      claimCount: updatedUser.claimCount,
      isOfficial: updatedUser.isOfficial,
      isMining: updatedUser.isMining,
      isPremium: updatedUser.isPremium,
      weeklyPoints: updatedUser.weeklyPoints,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      lastSpinClaim: updatedUser.lastSpinClaim || undefined,
      lastClaim: updatedUser.lastClaim || undefined,
      chatId: updatedUser.chatId || undefined,
      wallet: walletData,
      avatar_url: updatedUser.avatar_url || undefined,
      experience_points: updatedUser.experience_points ?? 0,
      contests_participated: updatedUser.contests_participated ?? 0,
      tasks_completed: updatedUser.tasks_completed ?? 0,
      gamesPlayed: updatedUser.gamesPlayed ?? 0,
      gamesWon: updatedUser.gamesWon ?? 0,
    };

    return NextResponse.json({ user: userData });
  } catch (error) {
    console.error("Failed to update user profile:", error);
    return NextResponse.json(
      { error: "Failed to update user profile" },
      { status: 500 }
    );
  }
}

