import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentYear, getISOWeekNumber } from "@/app/utils/utils";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { userId, amount } = await req.json();

    if (!userId || !amount) {
      return NextResponse.json(
        { error: "Missing userId or amount" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentWeek = getISOWeekNumber(new Date());
      const currentYear = getCurrentYear();

      const weeklyDeposits = await tx.weeklyScore.findMany({
        where: {
          userId,
          weekNumber: currentWeek,
          year: currentYear,
        },
        orderBy: { createdAt: "asc" },
      });

      const basePoints = amount * 10;
      const multiplier = weeklyDeposits.reduce(
        (acc, deposit) => acc * deposit.points,
        1
      );
      const finalPoints = basePoints * multiplier;

      const weeklyScore = await tx.weeklyScore.upsert({
        where: {
          userId_weekNumber_year: {
            userId,
            weekNumber: currentWeek,
            year: currentYear,
          },
        },
        update: {
          points: {
            increment: basePoints,
          },
        },
        create: {
          userId,
          points: basePoints,
          weekNumber: currentWeek,
          year: currentYear,
        },
      });

      const user = await tx.user.update({
        where: { id: userId },
        data: {
          weeklyPoints: { increment: finalPoints },
          totalPoints: { increment: finalPoints },
        },
      });

      return {
        weeklyScore,
        user,
        points: finalPoints,
        multiplier,
      };
    });

    // return NextResponse.json({ points: finalPoints, multiplier });
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to process deposit" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Get weekly multiplier info
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  try {
    const currentWeek = getISOWeekNumber(new Date());
    const currentYear = getCurrentYear();

    const weeklyDeposits = await prisma.weeklyScore.findMany({
      where: {
        userId: Number(userId),
        weekNumber: currentWeek,
        year: currentYear,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const multiplier = weeklyDeposits.reduce((acc, deposit) => {
      return acc * deposit.points;
    }, 1);

    return NextResponse.json({ weeklyDeposits, multiplier });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to get weekly info" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// const currentWeek = getISOWeekNumber(new Date());
// const currentYear = getCurrentYear();

// // Get all deposits from current week
// const weeklyDeposits = await prisma.weeklyScore.findMany({
//   where: {
//     userId,
//     weekNumber: currentWeek,
//     year: currentYear,
//   },
//   orderBy: {
//     createdAt: "asc",
//   },
// });

// // Calculate base points (0.5 NEAR = 5 points)
// const basePoints = amount * 10;

// // Calculate multiplier chain from previous deposits
// const multiplier = weeklyDeposits.reduce((acc, deposit) => {
//   return acc * deposit.points;
// }, 1);

// // Calculate final points with multiplier
// const finalPoints = basePoints * multiplier;

// // Create new weekly deposit record
// await prisma.weeklyScore.create({
//   data: {
//     userId,
//     // amount,
//     points: basePoints,
//     weekNumber: currentWeek,
//     year: currentYear,
//   },
// });

// // Update user's total points
// await prisma.user.update({
//   where: { id: userId },
//   data: {
//     weeklyPoints: {
//       increment: finalPoints,
//     },
//     totalPoints: {
//       increment: finalPoints,
//     },
//   },
// });
