import { getCurrentYear, getISOWeekNumber } from "@/app/utils/utils";
import { telegramClient } from "../../clients/TelegramApiClient";
import { InlineKeyboardMarkup } from "@grammyjs/types";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { username, type } = await req.json();

    const user = await prisma.user.findUnique({
      where: {
        username: username,
      },
    });

    if (type == "claim welcome") {
      if (!user?.isOfficial) {
        const res = await prisma.user.update({
          where: {
            username,
          },

          data: {
            totalPoints: (user?.totalPoints ?? 0) + 5500,
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
                  invitor.totalPoints + (user.isPremium ? 200000 : 100000),
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

      console.log(user);
      if (new Date(Date.now()) > lastClaim) {
        let day = ((user?.claimCount ?? 0) + 1) * 2;
        day = day - 2;

        const res = await prisma.user.update({
          where: {
            username,
          },

          data: {
            totalPoints: (user?.totalPoints ?? 0) + 60 * (day <= 0 ? 1 : day),
            lastClaim: nextClaim,
            claimCount: (user?.claimCount ?? 0) + 1,
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
      const lastClaim = new Date(user?.lastClaim ?? Date.now());
      const nextClaim = new Date(new Date().getTime() + 1000 * 60 * 60 * 5);

      console.log(user);

      if (new Date(Date.now()) > lastClaim) {
        const np = type.split("--")[1];

        await addLeaderboard(user, np);

        const res = await prisma.user.update({
          where: {
            username,
          },

          data: {
            lastClaim: nextClaim,
            isMining: false,
          },
        });

        return NextResponse.json(res);
      }
    }

    if (type.includes("game claim") && user) {
      console.log(type);
      const np = type.split("--")[1];
      const res = await addLeaderboard(user, np);
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
