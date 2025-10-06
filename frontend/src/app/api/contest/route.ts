import { getCurrentYear, getISOWeekNumber } from "@/lib/utils/utils";
// import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

// const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const { type, userId, np: points } = await req.json();

  if (type == "reset") {
    try {
      // Reset weekly points for all users
      // await prisma.user.updateMany({
      //   data: {
      //     weeklyPoints: 0,
      //   },
      // });

      // Optional: Update rankings based on weekly scores
      const currentWeek = getISOWeekNumber(new Date());
      const currentYear = getCurrentYear();

      // Get sorted weekly scores for the previous week
      // const weeklyScores = await prisma.weeklyScore.findMany({
      //   where: {
      //     weekNumber: currentWeek - 1, // Previous week
      //     year: currentYear,
      //   },
      //   orderBy: {
      //     points: "desc",
      //   },
      // });

      // Update ranks for the previous week
      // await Promise.all(
      //   weeklyScores.map(async (score, index) => {
      //     await prisma.weeklyScore.update({
      //       where: { id: score.id },
      //       data: { rank: index + 1 },
      //     });
      //   })
      // );

      NextResponse.json(
        { message: "Weekly points reset successfully" },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error resetting weekly points:", error);
      NextResponse.json(
        { error: "Failed to reset weekly points" },
        { status: 500 }
      );
    }
  }

  if (type == "add") {
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

      NextResponse.json(
        { message: "Points added successfully" },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error adding weekly points:", error);
      NextResponse.json(
        { error: "Failed to add weekly points kk" },
        { status: 500 }
      );
    }
  }

  if (type == "get leaderboard") {
    try {
      if (!userId) {
        return NextResponse.json(
          { error: "User ID is required" },
          { status: 400 }
        );
      }

      // const weeklyScore = await prisma.weeklyScore.findMany({
      //   orderBy: {
      //     points: "desc",
      //   },
      //   take: 10,

      //   include: {
      //     user: {
      //       select: {
      //         name: true,
      //         weeklyPoints: true,
      //         totalPoints: true,
      //       },
      //     },
      //   },
      // });

      return NextResponse.json(
        { message: "Leaderboard fetched" },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error fetching weekly points:", error);
      return NextResponse.json(
        { error: "Failed to fetch weekly points hhjkkk" },
        { status: 500 }
      );
    }
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
