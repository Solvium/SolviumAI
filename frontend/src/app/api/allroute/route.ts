import { getCurrentYear, getISOWeekNumber } from "@/app/utils/utils";
import { telegramClient } from "../../clients/TelegramApiClient";
import { InlineKeyboardMarkup } from "@grammyjs/types";
import { NextRequest, NextResponse } from "next/server";
// import { PrismaClient } from "@prisma/client";

// const globalForPrisma = global as unknown as { prisma: PrismaClient };

// export const prisma =
//   globalForPrisma.prisma ||
//   new PrismaClient({
//     log: ["query"],
//   });
// const prisma = globalForPrisma.prisma || new PrismaClient();

// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

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

    // Temporarily commented out Prisma usage for build
    // const user = await prisma.user.findUnique({
    //   where: {
    //     username: username,
    //   },
    // });

    if (message) {
      // if (user) {
      //   console.log(user);
      //   await replyStart(message, user);
      //   return NextResponse.json(user);
      // }
      if (message.text?.startsWith("/start")) {
        const id = message.text.split("/start ");

        console.log(message);
        console.log(id);

        if (id.length > 1) {
          // if (!user) {
          //   const user = await prisma.user.create({
          //     data: {
          //       referralCount: 0,
          //       isPremium: message.from.is_premium ? true : false,
          //       name: `${message.chat.first_name ?? ""} ${
          //       message.chat.last_name ?? ""
          //     }`,
          //       referredBy: id[1],
          //       chatId: message.from.id?.toString(),
          //       username: message.chat.username!,
          //       totalPoints: 0,
          //     },
          //   });
          //   await replyStart(message, user);
          //   return NextResponse.json(user);
          // }
        } else {
          // const user = await prisma.user.create({
          //   data: {
          //     referralCount: 0,
          //     referredBy: "null",
          //     name: `${message.chat.last_name ?? ""} ${
          //     message.chat.first_name ?? ""
          //   }`,
          //     chatId: message.from.id?.toString(),
          //     username: message.chat.username!,
          //     totalPoints: 0,
          //   },
          // });
          // await replyStart(message, user);
          // return NextResponse.json(user);
        }
      }

      // await replyStart(message, user);

      // return NextResponse.json(user);
    }

    if (type == "reg4tasks") {
      console.log("reg4task");
      let isCreated;
      isCreated = await getUserTasks(data);
      console.log(isCreated);

      if (!isCreated) isCreated = await registerForTasks(data);
      return NextResponse.json(isCreated);
    }

    if (type == "createAccount") {
      // if (user) {
      //   return NextResponse.json(user);
      // }
      // const newUser = await prisma.user.create({
      //   data: {
      //     referralCount: 0,
      //     referredBy: ref,
      //     name,
      //     chatId: "null",
      //     email,
      //     username: username,
      //     totalPoints: 0,
      //   },
      // });
      // return NextResponse.json(newUser);
    }

    if (type == "updateWallet") {
      // await prisma.user.update({
      //   where: { username },
      //   data: {
      //     wallet,
      //   },
      // });
    }

    if (type == "completetasks") {
      // if (!user?.isOfficial) {
      //   const res = await prisma.user.update({
      //     where: {
      //       username,
      //     },

      //     data: {
      //       isOfficial: true,
      //     },
      //   });

      //   if (user?.referredBy) {
      //     const invitor = await prisma.user.findUnique({
      //       where: {
      //         username: user.referredBy,
      //       },
      //     });

      //     if (invitor) {
      //       await prisma.user.update({
      //         where: {
      //           username: invitor.username,
      //         },
      //         data: {
      //           referralCount: invitor.referralCount + 1,
      //           totalPoints: {
      //             increment: 100,
      //           },
      //         },
      //       });
      //     }
      //   }
      //   return NextResponse.json(res);
      // }

      await completeTasks(data);

      const np = data.task.points * (userMultipler > 0 ? userMultipler : 1);

      const res = await addLeaderboard(null, np); // Pass null for user as it's commented out
      return res;
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

      // const user = await prisma.user.findUnique({
      //   where: { username },
      // });

      // if (!user) {
      //   return NextResponse.json({ error: "User not found" }, { status: 404 });
      // }

      // return NextResponse.json(user);
    }

    if (type == "getUserByWallet") {
      if (!wallet) {
        return NextResponse.json(
          { error: "wallet is required" },
          { status: 400 }
        );
      }

      // const user = await prisma.user.findUnique({
      //   where: { wallet },
      // });

      // if (!user) {
      //   return NextResponse.json({ error: "User not found" }, { status: 404 });
      // }

      // return NextResponse.json(user);
    }

    if (type == "leaderboard") {
      // const users = await prisma.user.findMany({
      //   orderBy: { totalPoints: "desc" },
      // });
      // return NextResponse.json(users || []);
    }

    if (type == "getTasksInfo") {
      // const tasks = await prisma.task.findMany({});
      // return NextResponse.json(tasks || []);
    }

    if (type == "allusertasks") {
      if (!userId) {
        return NextResponse.json(
          { error: "User ID is required" },
          { status: 400 }
        );
      }

      try {
        // const data = await getAllUserTasks(userId);
        // return NextResponse.json(data || []);
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
  await telegramClient.sendMessage(
    message.chat.id,
    `*Welcome to Solvium Task/Game Bot\\!*
Start earning Solvium Points Now🚀 while enjoying our game

Kindly add a Username to your telegram account and try again\\!`
  );
};

const replyStart = async (message: any, user: any) => {
  const reply_markup: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: "Launch WebApp",
          web_app: {
            url:
              process.env.NODE_ENV == "production"
                ? process.env.PROD_URL ?? ""
                : process.env.TEST_URL ?? "",
          },
        },
      ],
    ],
  };

  await telegramClient.sendMessage(
    message.chat.id,
    `*Welcome to Solvium Task/Game Bot\\!*
Start earning Solvium Points Now🚀 while enjoying our game`,
    reply_markup
  );
};

const completeTasks = async (data: any) => {
  const { userId, task } = data;
  try {
    // await prisma.userTask.update({
    //   where: {
    //     userId_taskId: {
    //       userId: userId,
    //       taskId: task.id,
    //     },
    //   },
    //   data: {
    //     isCompleted: true,
    //   },
    // });
  } catch (error) {
    console.log(error);
  }
};

const registerForTasks = async (data: any) => {
  const { userId, task } = data;

  try {
    // return await prisma.userTask.create({
    //   data: {
    //     userId: userId,
    //     taskId: task.id,
    //     isCompleted: false,
    //   },
    // });
  } catch (error) {
    console.log(error);
  }
};

const getUserTasks = async (data: any) => {
  const { userId, task } = data;
  try {
    // return await prisma.userTask.findUnique({
    //   where: {
    //     userId_taskId: {
    //       userId: userId,
    //       taskId: task.id,
    //     },
    //   },
    // });
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

    // return await prisma.userTask.findMany({
    //   where: {
    //     userId: Number(userId),
    //   },
    //   include: {
    //     task: true,
    //   },
    // });
  } catch (error) {
    console.error("Error in getAllUserTasks:", error);
    throw error;
  }
};

const addLeaderboard = async (user: any, np: number) => {
  const userId = user?.id; // Use user?.id as user might be null
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

    // return NextResponse.json(updatedScore, { status: 200 });

    // Temporary mock response
    return NextResponse.json(
      {
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
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error adding weekly points:", error);
    return NextResponse.json(
      { error: "Failed to add weekly points kk" },
      { status: 500 }
    );
  }
};
