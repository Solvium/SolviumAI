import { getCurrentYear, getISOWeekNumber } from "@/app/utils/utils";
import { telegramClient } from "../../clients/TelegramApiClient";
import { InlineKeyboardMarkup } from "@grammyjs/types";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function POST(req: NextRequest) {
  try {
    const {
      username: _username,
      id,
      type,
      wallet,
      data,
      ref,
      email,
      name,
      message,
      userMultipler,
    } = await req.json();

    const username = _username ?? message.chat.username;

    if (!username) {
      replyNoUsername(message, null);
      return NextResponse.json("error", { status: 404 });
    }

    if (type == "updateWallet") {
      const updatedUser = await prisma.user.update({
        where: { username },
        data: {
          wallet,
        },
      });

      return NextResponse.json({
        success: true,
        user: updatedUser,
      });
    }

    if (type == "completetasks") {
      // Handle both data.task.id (nested structure) and data.id (direct task ID)
      const taskId = data?.task?.id || data?.id;
      const userId = data?.userId || data?.task?.userId;

      if (!taskId || !userId) {
        return NextResponse.json(
          { error: "Task ID and User ID are required" },
          { status: 400 }
        );
      }

      // Convert userId to number for Prisma
      const userIdNumber = parseInt(userId.toString());

      // Get the task to know how many points to award
      const task = await prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      // Check if user has already completed this task
      const existingUserTask = await prisma.userTask.findUnique({
        where: {
          userId_taskId: {
            userId: userIdNumber,
            taskId: taskId,
          },
        },
      });

      if (existingUserTask?.isCompleted) {
        return NextResponse.json(
          { error: "Task already completed" },
          { status: 400 }
        );
      }

      // Calculate points with multiplier
      const pointsToAward =
        task.points * (userMultipler > 0 ? userMultipler : 1);

      // Update user task completion and user points in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Mark task as completed
        const userTask = await tx.userTask.upsert({
          where: {
            userId_taskId: {
              userId: userIdNumber,
              taskId: taskId,
            },
          },
          update: {
            isCompleted: true,
          },
          create: {
            userId: userIdNumber,
            taskId: taskId,
            isCompleted: true,
          },
        });

        // Update user's total points
        const updatedUser = await tx.user.update({
          where: { id: userIdNumber },
          data: {
            totalPoints: {
              increment: pointsToAward,
            },
          },
        });

        // Add to weekly score
        const currentWeek = getISOWeekNumber(new Date());
        const currentYear = getCurrentYear();

        const weeklyScore = await tx.weeklyScore.upsert({
          where: {
            userId_weekNumber_year: {
              userId: userIdNumber,
              weekNumber: currentWeek,
              year: currentYear,
            },
          },
          update: {
            points: {
              increment: pointsToAward,
            },
          },
          create: {
            userId: userIdNumber,
            weekNumber: currentWeek,
            year: currentYear,
            points: pointsToAward,
          },
        });

        return { userTask, updatedUser, weeklyScore };
      });

      return NextResponse.json({
        success: true,
        pointsAwarded: pointsToAward,
        user: result.updatedUser,
      });
    }

    if (type == "reg4tasks") {
      // Handle both data.id (direct task ID) and data.task.id (nested structure)
      const taskId = data?.id || data?.task?.id;

      if (!taskId || !username) {
        return NextResponse.json(
          { error: "Task ID and username are required" },
          { status: 400 }
        );
      }

      // Get user by username
      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Get the task
      const task = await prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      // Check if user has already registered for this task
      const existingUserTask = await prisma.userTask.findUnique({
        where: {
          userId_taskId: {
            userId: user.id, // user.id is already a number
            taskId: taskId,
          },
        },
      });

      if (existingUserTask) {
        return NextResponse.json({
          success: true,
          message: "Already registered for this task",
          userTask: existingUserTask,
        });
      }

      // Register user for the task
      const userTask = await prisma.userTask.create({
        data: {
          userId: user.id, // user.id is already a number
          taskId: taskId,
          isCompleted: false,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Successfully registered for task",
        userTask: userTask,
      });
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
  const wallet = searchParams.get("wallet");
  const userId = searchParams.get("id");

  try {
    if (type == "getUser") {
      if (!username) {
        return NextResponse.json(
          { error: "Username is required" },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json(user);
    }

    if (type == "getUserByWallet") {
      if (!wallet) {
        return NextResponse.json(
          { error: "wallet is required" },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { wallet },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json(user);
    }

    if (type == "leaderboard") {
      const users = await prisma.user.findMany({
        orderBy: { totalPoints: "desc" },
      });
      return NextResponse.json(users || []);
    }

    if (type == "getTasksInfo") {
      const tasks = await prisma.task.findMany({});
      return NextResponse.json(tasks || []);
    }

    if (type == "allusertasks") {
      if (!userId) {
        return NextResponse.json(
          { error: "User ID is required" },
          { status: 400 }
        );
      }

      try {
        const data = await getAllUserTasks(userId);
        return NextResponse.json(data || []);
      } catch (error) {
        console.error("Error fetching user tasks:", error);
        return NextResponse.json(
          { error: "Internal Server Error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Invalid type parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

const replyNoUsername = async (message: any, user: any) => {
  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: "Set Username",
          url: "https://t.me/SolviumBot",
        },
      ],
    ],
  };

  await telegramClient.api.sendMessage(
    message.chat.id,
    "Please set a username first",
    {
      reply_markup: keyboard,
    }
  );
};

const completeTasks = async (data: any) => {
  const { userId, task } = data;
  try {
    await prisma.userTask.update({
      where: {
        userId_taskId: {
          userId: userId,
          taskId: task.id,
        },
      },
      data: {
        isCompleted: true,
      },
    });
  } catch (error) {
    console.log(error);
  }
};

const registerForTasks = async (data: any) => {
  const { userId, task } = data;

  try {
    return await prisma.userTask.create({
      data: {
        userId: userId,
        taskId: task.id,
        isCompleted: false,
      },
    });
  } catch (error) {
    console.log(error);
  }
};

const getUserTasks = async (data: any) => {
  const { userId, task } = data;
  try {
    return await prisma.userTask.findUnique({
      where: {
        userId_taskId: {
          userId: userId,
          taskId: task.id,
        },
      },
    });
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getAllUserTasks = async (userId: string) => {
  try {
    if (!userId || isNaN(Number(userId))) {
      throw new Error("Invalid user ID");
    }

    return await prisma.userTask.findMany({
      where: {
        userId: Number(userId),
      },
      include: {
        task: true,
      },
    });
  } catch (error) {
    console.error("Error in getAllUserTasks:", error);
    throw error;
  }
};

const addLeaderboard = async (user: any, np: number) => {
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

      return { weeklyScore, updatedUser };
    });

    return NextResponse.json(updatedScore, { status: 200 });
  } catch (error) {
    console.error("Error in addLeaderboard:", error);
    return NextResponse.json(
      { error: "Failed to update leaderboard" },
      { status: 500 }
    );
  }
};
