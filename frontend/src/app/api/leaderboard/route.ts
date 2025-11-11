import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Force dynamic rendering - prevent Vercel from caching this route
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Get top users ranked by totalSOLV only
    const leaderboard = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        totalPoints: true,
        totalSOLV: true,
        level: true,
        gamesWon: true,
        gamesPlayed: true,
        weeklyPoints: true,
        experience_points: true,
        avatar_url: true,
        createdAt: true,
      },
      orderBy: [{ totalSOLV: "desc" }],
      take: 50, // Limit to top 50 users
    });

    // Load level configs once to compute levels consistently with Profile
    const levelConfigs = await prisma.levelConfig.findMany({
      orderBy: { level: "asc" },
    });

    const computeLevelFromXP = (
      experiencePoints: number | null | undefined
    ) => {
      const xp = typeof experiencePoints === "number" ? experiencePoints : 0;
      if (levelConfigs.length === 0) return 1;
      let currentLevel = 1;
      for (let i = levelConfigs.length - 1; i >= 0; i--) {
        if (xp >= (levelConfigs[i].points_required as number)) {
          currentLevel = levelConfigs[i].level as number;
          break;
        }
      }
      return currentLevel;
    };

    // Transform the data to match the expected format
    const formattedLeaderboard = leaderboard.map((user, index) => ({
      id: user.id,
      username: user.username,
      name: user.username, // Use username as name for now
      totalPoints: user.totalPoints,
      totalSOLV: user.totalSOLV,
      // Derive level from experience points to match Profile display
      level: computeLevelFromXP(user.experience_points),
      gamesWon: user.gamesWon,
      gamesPlayed: user.gamesPlayed,
      weeklyPoints: user.weeklyPoints,
      experience_points: user.experience_points,
      rank: index + 1,
      avatar: user.avatar_url,
      avatar_url: user.avatar_url,
      trend: index < 3 ? "up" : index > 45 ? "down" : null, // Simple trend based on position
      joinDate: user.createdAt,
    }));

    return NextResponse.json(
      {
        success: true,
        leaderboard: formattedLeaderboard,
        total: formattedLeaderboard.length,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("Leaderboard API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch leaderboard data",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  }
}
