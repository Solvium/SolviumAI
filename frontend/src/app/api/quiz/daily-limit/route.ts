import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DAILY_LIMIT = 50;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const completedToday = await prisma.game.count({
      where: {
        userId: parseInt(userId),
        gameType: "quiz",
        playedAt: {
          gte: today,
        },
      },
    });

    const remaining = Math.max(0, DAILY_LIMIT - completedToday);

    const payload = {
      limit: DAILY_LIMIT,
      completedToday,
      remaining,
      hasRemaining: remaining > 0,
      error:
        remaining > 0 ? undefined : "Daily quiz limit reached. Please come back tomorrow.",
    };

    if (remaining <= 0) {
      return NextResponse.json(payload, { status: 403 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[quiz/daily-limit] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily quiz limit" },
      { status: 500 }
    );
  }
}

