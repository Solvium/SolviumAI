import { getCurrentYear, getISOWeekNumber } from "@/app/utils/utils";
import { telegramClient } from "../../clients/TelegramApiClient";
import { InlineKeyboardMarkup } from "@grammyjs/types";
// import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

// const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { username, type } = await req.json();

    // Temporarily commented out Prisma usage for build
    // const user = await prisma.user.findUnique({
    //   where: {
    //     username: username,
    //   },
    // });

    // if (!user) {
    //   return NextResponse.json(
    //     { error: "User not found" },
    //     { status: 404 }
    //   );
    // }

    // Mock user data for now
    const mockUser = {
      id: "game_user",
      username: username,
      totalPoints: 0,
      multiplier: 1,
      level: 1,
      difficulty: 1,
    };

    if (type === "getUser") {
      return NextResponse.json(mockUser);
    }

    if (type === "updatePoints") {
      // Mock response
      return NextResponse.json({
        success: true,
        user: mockUser,
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

    // Temporarily commented out Prisma usage for build
    // Update weekly score and user's points in a transaction
    // const updatedScore = await prisma.$transaction(async (prisma) => {
    //   // Update or create weekly score
    //   const weeklyScore = await prisma.weeklyScore.upsert({
    //     where: {
    //       userId_weekNumber_year: {
    //         userId: Number(userId),
    //         weekNumber: currentWeek,
    //         year: currentYear,
    //       },
    //     },
    //     update: {
    //       points: {
    //         increment: Number(points),
    //       },
    //     },
    //     create: {
    //       userId: Number(userId),
    //       weekNumber: currentWeek,
    //       year: currentYear,
    //       points: Number(points),
    //     },
    //   });

    //   // Update user's weekly and total points
    //   const updatedUser = await prisma.user.update({
    //     where: { id: Number(userId) },
    //     data: {
    //       weeklyPoints: {
    //         increment: Number(points),
    //       },
    //       totalPoints: {
    //         increment: Number(points),
    //       },
    //     },
    //   });

    //   return { weeklyScore, updatedUser };
    // });

    // return updatedScore;

    // Temporary mock response
    return {
      weeklyScore: {
        userId: Number(userId),
        weekNumber: currentWeek,
        year: currentYear,
        points: Number(points),
      },
      updatedUser: {
        id: Number(userId),
        weeklyPoints: Number(points),
        totalPoints: Number(points),
      },
    };
  } catch (error) {
    console.error("Error adding weekly points:", error);
    NextResponse.json(
      { error: "Failed to add weekly points kk" },
      { status: 500 }
    );
  }
};
