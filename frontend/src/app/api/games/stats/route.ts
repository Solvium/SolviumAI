import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const gameType = searchParams.get("gameType");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Get user's basic stats
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        username: true,
        totalSOLV: true,
        totalPoints: true,
        experience_points: true,
        level: true,
        difficulty: true,
        gamesPlayed: true,
        gamesWon: true,
        weeklyPoints: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get game-specific stats based on game type
    let gameStats = {};

    if (gameType === "wordle" || !gameType) {
      // Get Wordle-specific stats
      const wordleStats = await prisma.wordleGame.findMany({
        where: { userId: parseInt(userId) },
        orderBy: { playedAt: "desc" },
        take: 10,
      });

      const wordleSummary = await prisma.wordleGame.groupBy({
        by: ["won", "difficulty"],
        where: { userId: parseInt(userId) },
        _count: { won: true },
        _sum: { rewards: true },
        _avg: { completionTime: true, guesses: true },
      });

      gameStats = {
        wordle: {
          recentGames: wordleStats,
          summary: wordleSummary,
          totalGames: wordleStats.length,
          winRate:
            wordleStats.filter((g) => g.won).length /
            Math.max(wordleStats.length, 1),
        },
      };
    }

    // Get recent activities
    const recentActivities = await prisma.userActivity.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Get weekly leaderboard position
    const currentWeek = new Date().getWeek();
    const currentYear = new Date().getFullYear();

    const weeklyScore = await prisma.weeklyScore.findUnique({
      where: {
        userId_weekNumber_year: {
          userId: parseInt(userId),
          weekNumber: currentWeek,
          year: currentYear,
        },
      },
    });

    // Get leaderboard position (approximate)
    const usersAbove = await prisma.weeklyScore.count({
      where: {
        weekNumber: currentWeek,
        year: currentYear,
        points: {
          gt: weeklyScore?.points || 0,
        },
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        totalSOLV: user.totalSOLV,
        totalPoints: user.totalPoints,
        experience_points: user.experience_points,
        level: user.level,
        difficulty: user.difficulty,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        weeklyPoints: user.weeklyPoints,
        winRate: user.gamesPlayed > 0 ? user.gamesWon / user.gamesPlayed : 0,
      },
      gameStats,
      recentActivities: recentActivities.map((activity) => ({
        id: activity.id,
        type: activity.activity_type,
        points: activity.points_earned,
        metadata: activity.metadata,
        createdAt: activity.createdAt,
      })),
      leaderboard: {
        weeklyPosition: usersAbove + 1,
        weeklyPoints: weeklyScore?.points || 0,
        totalUsers: await prisma.weeklyScore.count({
          where: {
            weekNumber: currentWeek,
            year: currentYear,
          },
        }),
      },
    });
  } catch (error) {
    console.error("Game stats API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to get week number
declare global {
  interface Date {
    getWeek(): number;
  }
}

Date.prototype.getWeek = function () {
  const date = new Date(this.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
};

