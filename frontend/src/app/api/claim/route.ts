import {
  getCurrentYear,
  getISOWeekNumber,
  sendTokensToUser,
} from "@/lib/utils/utils";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { calculatePointsWithMultiplier } from "@/lib/services/ServerMultiplierService";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { username, type, data, userMultipler, solWallet } = await req.json();

    let user: any = null;
    try {
      user = await prisma.user.findUnique({
        where: {
          username: username,
        },
      });
    } catch (error) {
      return NextResponse.json({ error });
    }

    if (type == "claim welcome") {
      if (!user?.isOfficial) {
        await addLeaderboard(user, 5500, null);

        const res = await prisma.user.update({
          where: {
            username,
          },
          data: {
            isOfficial: true,
          },
        });

        if (user?.referredBy) {
          const invitor = await prisma.user.findUnique({
            where: {
              username: user.referredBy,
            },
          });
          if (invitor) {
            await prisma.user.update({
              where: {
                username: invitor.username,
              },
              data: {
                referralCount: invitor.referralCount + 1,
                totalPoints:
                  invitor.totalPoints +
                  (100 * userMultipler >= 1 ? userMultipler : 1),
              },
            });
          }
        }
        return NextResponse.json(res);
      } else {
        return NextResponse.json("Unknown Error", { status: 500 });
      }
    }

    if (type == "daily claim") {
      const lastClaim = new Date(user?.lastClaim ?? Date.now());
      const nextClaim = new Date(new Date().getTime() + 1000 * 60 * 60 * 24);
      if (new Date(Date.now()) > lastClaim) {
        let day = ((user?.claimCount ?? 0) + 1) * 2;
        day = day - 2;

        await addLeaderboard(
          user,
          60 * (day <= 0 ? 1 : day) * userMultipler >= 1 ? userMultipler : 1,
          null
        );

        const res = await prisma.user.update({
          where: {
            username,
          },
          data: {
            lastClaim: nextClaim,
            claimCount: {
              increment: 1,
            },
          },
        });

        return NextResponse.json(res);
      }
    }

    if (type == "start farming") {
      // Check if user is already mining
      if (user?.isMining) {
        return NextResponse.json(
          { error: "Already mining. Please wait for the current session to complete." },
          { status: 400 }
        );
      }

      // Set lastClaim to NOW (start time) so we can calculate elapsed time
      const miningStartTime = new Date();

      const res = await prisma.user.update({
        where: {
          username,
        },
        data: {
          lastClaim: miningStartTime,
          isMining: true,
        },
      });

      return NextResponse.json(res);
    }

    if (type.includes("farm claim")) {
      // Check if user is mining
      if (!user?.isMining) {
        return NextResponse.json(
          { error: "Not currently mining" },
          { status: 400 }
        );
      }

      const miningStartTime = new Date(user?.lastClaim ?? Date.now());
      const currentTime = new Date();
      const MINING_DURATION_MS = 5 * 60 * 60 * 1000; // 5 hours
      const timeElapsed = currentTime.getTime() - miningStartTime.getTime();

      // Check if 5 hours have elapsed
      if (timeElapsed < MINING_DURATION_MS) {
        const remainingTime = MINING_DURATION_MS - timeElapsed;
        const remainingHours = Math.floor(remainingTime / (60 * 60 * 1000));
        const remainingMinutes = Math.floor(
          (remainingTime % (60 * 60 * 1000)) / (60 * 1000)
        );
        const remainingSeconds = Math.floor(
          (remainingTime % (60 * 1000)) / 1000
        );

        return NextResponse.json(
          {
            error: `Mining not complete. Time remaining: ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`,
          },
          { status: 400 }
        );
      }

      // After 5 hours, award the full 63 SOLV
      const MAX_SOLV = 63;
      const basePoints = MAX_SOLV;

      // Resolve accountId for multiplier calculation
      let resolvedAccountId: string | undefined = undefined;
      try {
        const walletJson = (user.wallet || {}) as any;
        resolvedAccountId =
          walletJson?.account_id || walletJson?.accountId || walletJson?.near;
      } catch {}

      // Fallback: try wallet cache via telegram chatId
      if (!resolvedAccountId && user.chatId) {
        try {
          const chatNumeric = parseInt(user.chatId);
          if (!Number.isNaN(chatNumeric)) {
            const walletCache = await prisma.walletCache.findUnique({
              where: { telegramUserId: chatNumeric },
            });
            resolvedAccountId = walletCache?.accountId || undefined;
          }
        } catch (e) {
          console.log("WalletCache lookup failed:", e);
        }
      }

      // Apply multiplier using accountId (same as games and tasks)
      const pointCalculation = await calculatePointsWithMultiplier(
        basePoints,
        resolvedAccountId
      );
      const finalPoints = pointCalculation.totalPoints;

      // Update user with multiplied points
      await prisma.user.update({
        where: {
          username,
        },
        data: {
          totalSOLV: {
            increment: finalPoints,
          },
          totalPoints: {
            increment: finalPoints,
          },
          weeklyPoints: {
            increment: finalPoints,
          },
          lastClaim: currentTime,
          isMining: false,
        },
      });

      // Also update weekly leaderboard
      const currentWeek = getISOWeekNumber(new Date());
      const currentYear = getCurrentYear();
      await prisma.weeklyScore.upsert({
        where: {
          userId_weekNumber_year: {
            userId: user.id,
            weekNumber: currentWeek,
            year: currentYear,
          },
        },
        update: {
          points: {
            increment: finalPoints,
          },
        },
        create: {
          userId: user.id,
          weekNumber: currentWeek,
          year: currentYear,
          points: finalPoints,
        },
      });

      return NextResponse.json({
        success: true,
        pointsAwarded: finalPoints,
        basePoints: pointCalculation.basePoints,
        boostAmount: pointCalculation.boostAmount,
        multiplier: pointCalculation.multiplier,
      });
    }

    if (type.includes("game claim") && user) {
      const np = type.split("--")[1];

      const res = await addLeaderboard(user, np, "game");
      return NextResponse.json(user, { status: 200 });
    }

    return NextResponse.json("user");
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal Server Error" });
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

const addLeaderboard = async (user: any, np: number, type: any) => {
  const userId = user?.id;
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

      if (type) {
        const nextLevel = user.puzzleCount >= 5 && user.difficulty >= 3;
        const nextDiff = user.puzzleCount >= 5 && user.difficulty < 3;

        await prisma.user.update({
          where: { id: Number(userId) },
          data: {
            level: {
              increment: nextLevel ? 1 : 0,
            },
            difficulty: {
              increment: nextLevel ? -2 : nextDiff ? 1 : 0,
            },
            puzzleCount: {
              increment: nextDiff || nextLevel ? -4 : 1,
            },
          },
        });
      }

      return { weeklyScore, updatedUser };
    });

    return updatedScore;
  } catch (error) {
    console.error("Error in addLeaderboard:", error);
    return NextResponse.json(
      { error: "Failed to update leaderboard" },
      { status: 500 }
    );
  }
};
