import { getCurrentYear, getISOWeekNumber } from "@/lib/utils/utils";
import { telegramClient } from "@/lib/api/TelegramApiClient";
import { InlineKeyboardMarkup } from "@grammyjs/types";
import { prisma } from "@/lib/prisma";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { username, type } = await req.json();

    const user = await prisma.user.findUnique({
      where: {
        username: username,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (type === "getUser") {
      return NextResponse.json({
        id: user.id,
        username: user.username,
        totalPoints: user.totalPoints,
        level: user.level,
        difficulty: user.difficulty,
      });
    }

    if (type === "updatePoints") {
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          totalPoints: user.totalPoints,
          level: user.level,
          difficulty: user.difficulty,
        },
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Game API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: any) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const username = searchParams.get("username");

  try {
    return NextResponse.json("users");
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" });
  }
}

const addLeaderboard = async (user: any, np: number) => {
  const userId = user.id;
  const points = np;
  try {
    if (!userId || points === undefined) {
      return NextResponse.json(
        { error: "User ID and points are required" },
        { status: 400 }
      );
    }

    const currentWeek = getISOWeekNumber(new Date());
    const currentYear = getCurrentYear();

    // Update weekly score and user's points in a transaction
    const updatedScore = await prisma.$transaction(async (prisma) => {
      // Update or create weekly score
      const weeklyScore = await prisma.weeklyScore.upsert({
        where: {
          userId_weekNumber_year: {
            userId: Number(userId),
            weekNumber: currentWeek,
            year: currentYear,
          },
        },
        update: {
          points: {
            increment: Number(points),
          },
        },
        create: {
          userId: Number(userId),
          weekNumber: currentWeek,
          year: currentYear,
          points: Number(points),
        },
      });

      // Update user's weekly and total points
      const updatedUser = await prisma.user.update({
        where: { id: Number(userId) },
        data: {
          weeklyPoints: {
            increment: Number(points),
          },
          totalPoints: {
            increment: Number(points),
          },
        },
      });

      return { weeklyScore, updatedUser };
    });

    return updatedScore;
  } catch (error) {
    console.error("Error adding weekly points:", error);
    NextResponse.json(
      { error: "Failed to add weekly points kk" },
      { status: 500 }
    );
  }
};
