import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    // Sample tasks data
    const sampleTasks = [
      {
        name: "Join Solvium Telegram Group",
        points: 50,
        link: "https://t.me/SolviumGroup",
        isCompleted: false,
      },
      {
        name: "Join Solvium Chat",
        points: 30,
        link: "https://t.me/SolviumChat",
        isCompleted: false,
      },
      {
        name: "Follow Solvium on X",
        points: 40,
        link: "https://twitter.com/Solvium",
        isCompleted: false,
      },
      {
        name: "Comment on our X Post",
        points: 60,
        link: "https://twitter.com/Solvium/status/1234567890",
        isCompleted: false,
      },
    ];

    // Clear existing tasks (optional - remove this if you want to keep existing tasks)
    await prisma.task.deleteMany({});

    // Create new tasks
    const createdTasks = await Promise.all(
      sampleTasks.map((task) =>
        prisma.task.create({
          data: task,
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: `${createdTasks.length} tasks created successfully`,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error("Error seeding tasks:", error);
    return NextResponse.json(
      { error: "Failed to seed tasks" },
      { status: 500 }
    );
  }
}
