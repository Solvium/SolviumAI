import {
  getCurrentYear,
  getISOWeekNumber,
  sendTokensToUser,
} from "@/app/utils/utils";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

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
      const nextClaim = new Date(new Date().getTime() + 1000 * 60 * 60 * 5);

      const res = await prisma.user.update({
        where: {
          username,
        },
        data: {
          lastClaim: nextClaim,
          isMining: true,
        },
      });

      return NextResponse.json(res);
    }

    if (type.includes("farm claim")) {
      // Check if user is mining and if 5 hours have passed
      if (!user?.isMining) {
        return NextResponse.json(
          { error: "Not currently mining" },
          { status: 400 }
        );
      }

      const miningStartTime = new Date(user?.lastClaim ?? Date.now());
      const currentTime = new Date();
      const fiveHoursInMs = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
      const timeElapsed = currentTime.getTime() - miningStartTime.getTime();

      if (timeElapsed >= fiveHoursInMs) {
        // Extract points from the type string (e.g., "farm claim--63")
        const pointsMatch = type.match(/farm claim--(\d+(?:\.\d+)?)/);
        const pointsToAward = pointsMatch ? parseFloat(pointsMatch[1]) : 63;

        await addLeaderboard(user, pointsToAward, null);

        const res = await prisma.user.update({
          where: {
            username,
          },
          data: {
            lastClaim: currentTime,
            isMining: false,
          },
        });

        return NextResponse.json({
          success: true,
          pointsAwarded: pointsToAward,
        });
      } else {
        const remainingTime = fiveHoursInMs - timeElapsed;
        const remainingHours = Math.floor(remainingTime / (60 * 60 * 1000));
        const remainingMinutes = Math.floor(
          (remainingTime % (60 * 60 * 1000)) / (60 * 1000)
        );

        return NextResponse.json(
          {
            error: `Still mining. Time remaining: ${remainingHours}h ${remainingMinutes}m`,
          },
          { status: 400 }
        );
      }
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
