// import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentYear, getISOWeekNumber } from "@/app/utils/utils";

// const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { username, amount, type } = await req.json();

    if (!username || !amount || !type) {
      return NextResponse.json(
        { error: "Username, amount, and type are required" },
        { status: 400 }
      );
    }

    // Temporarily commented out Prisma usage for build
    // const result = await prisma.$transaction(async (tx) => {
    //   const currentWeek = getISOWeekNumber(new Date());
    //   const currentYear = getCurrentYear();

    //   // Update or create weekly score
    //   const weeklyScore = await tx.weeklyScore.upsert({
    //     where: {
    //       userId_weekNumber_year: {
    //         userId: Number(userId),
    //         weekNumber: currentWeek,
    //         year: currentYear,
    //       },
    //     },
    //     update: {
    //       points: {
    //         increment: Number(amount),
    //       },
    //     },
    //     create: {
    //       userId: Number(userId),
    //       weekNumber: currentWeek,
    //       year: currentYear,
    //       points: Number(amount),
    //     },
    //   });

    //   // Update user's total points
    //   const updatedUser = await tx.user.update({
    //     where: { username },
    //     data: {
    //       totalPoints: {
    //         increment: Number(amount),
    //       },
    //     },
    //   });

    //   return { weeklyScore, updatedUser };
    // });

    // return NextResponse.json(result, { status: 200 });

    // Temporary mock response
    return NextResponse.json(
      {
        weeklyScore: {
          userId: 1,
          weekNumber: 1,
          year: 2024,
          points: Number(amount),
        },
        updatedUser: { username, totalPoints: Number(amount) },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Deposit error:", error);
    return NextResponse.json(
      { error: "Failed to process deposit" },
      { status: 500 }
    );
  }
}

// Get weekly multiplier info
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    // Temporarily commented out Prisma usage for build
    // const user = await prisma.user.findUnique({
    //   where: { username },
    //   include: {
    //     weeklyScores: {
    //       orderBy: { createdAt: "desc" },
    //       take: 10,
    //     },
    //   },
    // });

    // if (!user) {
    //   return NextResponse.json(
    //     { error: "User not found" },
    //     { status: 404 }
    //   );
    // }

    // const totalDeposits = user.weeklyScores.reduce(
    //   (acc, deposit) => acc + deposit.points,
    //   0
    // );

    // return NextResponse.json({
    //   user,
    //   totalDeposits,
    //   recentDeposits: user.weeklyScores,
    // });

    // Temporary mock response
    return NextResponse.json({
      user: { username, totalPoints: 0 },
      totalDeposits: 0,
      recentDeposits: [],
    });
  } catch (error) {
    console.error("Get deposits error:", error);
    return NextResponse.json(
      { error: "Failed to fetch deposits" },
      { status: 500 }
    );
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
