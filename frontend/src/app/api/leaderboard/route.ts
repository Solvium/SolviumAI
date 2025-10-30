import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get top users by total points, ordered by totalPoints descending
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
      orderBy: {
        totalPoints: "desc",
      },
      take: 50, // Limit to top 50 users
    });

    // Transform the data to match the expected format
    const formattedLeaderboard = leaderboard.map((user, index) => ({
      id: user.id,
      username: user.username,
      name: user.username, // Use username as name for now
      totalPoints: user.totalPoints,
      totalSOLV: user.totalSOLV,
      level: user.level,
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

    return NextResponse.json({
      success: true,
      leaderboard: formattedLeaderboard,
      total: formattedLeaderboard.length,
    });
  } catch (error) {
    console.error("Leaderboard API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch leaderboard data",
      },
      { status: 500 }
    );
  }
}
