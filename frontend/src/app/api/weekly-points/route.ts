import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentYear, getISOWeekNumber } from "@/lib/utils/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUserId = body?.userId;
    const rawAmount = body?.amount;

    const userId =
      typeof rawUserId === "string" ? parseInt(rawUserId, 10) : rawUserId;
    const amount = Number(rawAmount);

    if (!userId || Number.isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: "Invalid userId" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount" },
        { status: 400 }
      );
    }

    const currentWeek = getISOWeekNumber(new Date());
    const currentYear = getCurrentYear();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { weeklyPoints: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const newWeeklyPoints = Math.max(0, user.weeklyPoints - amount);

      await tx.user.update({
        where: { id: userId },
        data: { weeklyPoints: newWeeklyPoints },
      });

      const weeklyScoreKey = {
        userId_weekNumber_year: {
          userId,
          weekNumber: currentWeek,
          year: currentYear,
        },
      };

      const weeklyScore = await tx.weeklyScore.findUnique({
        where: weeklyScoreKey,
        select: { points: true },
      });

      let leaderboardPoints = 0;

      if (weeklyScore) {
        leaderboardPoints = Math.max(0, weeklyScore.points - amount);
        await tx.weeklyScore.update({
          where: weeklyScoreKey,
          data: { points: leaderboardPoints },
        });
      } else {
        await tx.weeklyScore.create({
          data: {
            userId,
            weekNumber: currentWeek,
            year: currentYear,
            points: 0,
          },
        });
      }

      return {
        weeklyPoints: newWeeklyPoints,
        leaderboardPoints,
      };
    });

    return NextResponse.json({
      success: true,
      weeklyPoints: result.weeklyPoints,
      leaderboardPoints: result.leaderboardPoints,
    });
  } catch (error) {
    console.error("Failed to update weekly points:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update weekly points" },
      { status: 500 }
    );
  }
}

