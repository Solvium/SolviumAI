import { getCurrentYear, getISOWeekNumber } from "@/lib/utils/utils";
import { telegramClient } from "@/lib/api/TelegramApiClient";
import { InlineKeyboardMarkup } from "@grammyjs/types";
// import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { sign } from "jsonwebtoken";

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
      message,
      userMultipler,
    } = await req.json();

    const username = _username ?? message.chat.username;

    // if (type == "createAccount") {
    //   if (id.length > 1) {
    //     if (!user) {
    //       const user = await prisma.user.create({
    //         data: {
    //           referralCount: 0,
    //           isPremium: message.from.is_premium ? true : false,
    //           name: `${message.chat.first_name ?? ""} ${
    //             message.chat.last_name ?? ""
    //           }`,
    //           referredBy: id[1],
    //           chatId: message.from.id?.toString(),
    //           username: message.chat.username!,
    //           totalPoints: 0,
    //         },
    //       });
    //       await replyStart(message, user);
    //       return NextResponse.json(user);
    //     }
    //   } else {
    //     const user = await prisma.user.create({
    //       data: {
    //         referralCount: 0,
    //         referredBy: "null",
    //         name: `${message.chat.last_name ?? ""} ${
    //           message.chat.first_name ?? ""
    //         }`,
    //         chatId: message.from.id?.toString(),
    //         username: message.chat.username!,
    //         totalPoints: 0,
    //       },
    //     });
    //     await replyStart(message, user);

    //     return NextResponse.json(user);
    //   }
    // }

    return NextResponse.json("user");
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal Server Error" });
  }
}
