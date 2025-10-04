import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LevelService } from "@/lib/services/levelService";
import { verify as jwtVerify } from "jsonwebtoken";

// Helper function to get user ID from token (reuse existing pattern)
const getUserIdFromToken = (request: NextRequest): number | null => {
  const authToken = request.cookies.get("auth_token");
  if (!authToken) return null;

  const raw = authToken.value;
  const asNumber = parseInt(raw);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }

  try {
    const decoded = jwtVerify(raw, process.env.JWT_SECRET!) as any;
    return decoded?.id || null;
  } catch {
    return null;
  }
};

export async function GET(request: NextRequest) {
  try {
    // Get user from auth token
    const userId = getUserIdFromToken(request);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        activities: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate level information
    const levelInfo = await LevelService.calculateLevelInfo(
      user.experience_points
    );

    const userProfile = {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      level: levelInfo.currentLevel,
      experience_points: user.experience_points,
      totalPoints: user.totalPoints,
      totalSOLV: user.totalSOLV,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      contests_participated: user.contests_participated,
      tasks_completed: user.tasks_completed,
      referralCount: user.referralCount,
      spinCount: user.spinCount,
      dailySpinCount: user.dailySpinCount,
      claimCount: user.claimCount,
      puzzleCount: user.puzzleCount,
      weeklyPoints: user.weeklyPoints,
      isOfficial: user.isOfficial,
      isMining: user.isMining,
      isPremium: user.isPremium,
      difficulty: user.difficulty,
      lastClaim: user.lastClaim,
      lastSpinClaim: user.lastSpinClaim,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      wallet: user.wallet,
      level_progress: {
        current_level: levelInfo.currentLevel,
        next_level_points: levelInfo.nextLevelPoints,
        progress_percentage: levelInfo.progressPercentage,
        points_to_next: levelInfo.pointsToNext,
        level_title: levelInfo.levelTitle,
      },
      recent_activities: user.activities,
    };

    return NextResponse.json({ user: userProfile });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updates = await request.json();

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        username: updates.username,
        email: updates.email,
        name: updates.name,
        avatar_url: updates.avatar_url,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
