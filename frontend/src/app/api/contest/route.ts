import { getCurrentYear, getISOWeekNumber } from "@/lib/utils/utils";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getActiveDepositNear } from "@/lib/services/ServerMultiplierService";

// Force dynamic rendering - prevent Vercel from caching this route
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

      return NextResponse.json(
        { message: "Weekly points reset successfully" },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error resetting weekly points:", error);
      return NextResponse.json(
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

      return NextResponse.json(
        { message: "Points added successfully" },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error adding weekly points:", error);
      return NextResponse.json(
        { error: "Failed to add weekly points" },
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

      await ensureWeeklyReset();

      const currentWeek = getISOWeekNumber(new Date());
      const currentYear = getCurrentYear();

      const weeklyScore = await prisma.weeklyScore.findMany({
        where: {
          weekNumber: currentWeek,
          year: currentYear,
          points: { gt: 0 },
        },
        orderBy: { points: "desc" },
        take: 200,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              wallet: true,
              chatId: true,
            },
          },
        },
      });

      const filtered = [];
      for (const entry of weeklyScore) {
        const accountId = await resolveAccountId(entry.user);
        if (!accountId) continue;
        const activeNear = await getActiveDepositNear(accountId);
        if (activeNear >= 2) {
          filtered.push(entry);
        }
        if (filtered.length >= 50) break;
      }

      return NextResponse.json(
        { weeklyScore: filtered },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            "CDN-Cache-Control": "no-store",
            "Vercel-CDN-Cache-Control": "no-store",
            Pragma: "no-cache",
            Expires: "0",
            "Surrogate-Control": "no-store",
          },
        }
      );
    } catch (error) {
      console.error("Error fetching weekly points:", error);
      return NextResponse.json(
        { error: "Failed to fetch weekly points" },
        { status: 500 }
      );
    }
  }
}

export async function GET(req: any) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const userId = searchParams.get("userId");

  if (type === "get leaderboard" || !type) {
    try {
      await ensureWeeklyReset();

      const currentWeek = getISOWeekNumber(new Date());
      const currentYear = getCurrentYear();

      const weeklyScore = await prisma.weeklyScore.findMany({
        where: {
          weekNumber: currentWeek,
          year: currentYear,
          points: { gt: 0 },
        },
        orderBy: { points: "desc" },
        take: 200,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              wallet: true,
              chatId: true,
            },
          },
        },
      });

      const filtered = [];
      for (const entry of weeklyScore) {
        const accountId = await resolveAccountId(entry.user);
        if (!accountId) continue;
        const activeNear = await getActiveDepositNear(accountId);
        if (activeNear >= 2) {
          filtered.push(entry);
        }
        if (filtered.length >= 50) break;
      }

      return NextResponse.json(
        { weeklyScore: filtered },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            "CDN-Cache-Control": "no-store",
            "Vercel-CDN-Cache-Control": "no-store",
            Pragma: "no-cache",
            Expires: "0",
            "Surrogate-Control": "no-store",
          },
        }
      );
    } catch (error) {
      console.error("Error fetching weekly points:", error);
      return NextResponse.json(
        { error: "Failed to fetch weekly points" },
        { status: 500 }
      );
    }
  }

  try {
    return NextResponse.json("users");
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" });
  }
}

async function resolveAccountId(user: {
  wallet?: any;
  chatId?: string | null;
}): Promise<string | null> {
  if (!user) return null;

  let walletJson: any = undefined;
  const rawWallet = user.wallet;
  if (rawWallet) {
    if (typeof rawWallet === "string") {
      try {
        walletJson = JSON.parse(rawWallet);
      } catch {
        walletJson = undefined;
      }
    } else {
      walletJson = rawWallet;
    }
  }

  let accountId =
    walletJson?.account_id || walletJson?.accountId || walletJson?.near;

  if (!accountId && user.chatId) {
    const chatNumeric = parseInt(user.chatId, 10);
    if (!Number.isNaN(chatNumeric)) {
      const walletCache = await prisma.walletCache.findUnique({
        where: { telegramUserId: chatNumeric },
      });
      accountId = walletCache?.accountId || accountId;
    }
  }

  return accountId || null;
}

async function ensureWeeklyReset() {
  const currentWeek = getISOWeekNumber(new Date());
  const currentYear = getCurrentYear();

  const hasCurrentWeekEntries = await prisma.weeklyScore.findFirst({
    where: {
      weekNumber: currentWeek,
      year: currentYear,
    },
    select: { id: true },
  });

  if (hasCurrentWeekEntries) {
    return;
  }

  await prisma.$transaction([
    prisma.weeklyScore.deleteMany({
      where: {
        NOT: {
          weekNumber: currentWeek,
          year: currentYear,
        },
      },
    }),
    prisma.user.updateMany({
      data: {
        weeklyPoints: 0,
      },
    }),
  ]);
}
