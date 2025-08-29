import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Define task templates with different types
    const taskTemplates = [
      {
        name: "Join Solvium Telegram Group",
        points: Math.floor(Math.random() * 50) + 30, // 30-80 points
        link: "https://t.me/solvium_group",
      },
      {
        name: "Join Solvium Chat",
        points: Math.floor(Math.random() * 40) + 20, // 20-60 points
        link: "https://t.me/solvium_chat",
      },
      {
        name: "Follow X (Twitter)",
        points: Math.floor(Math.random() * 30) + 15, // 15-45 points
        link: "https://x.com/solvium",
      },
      {
        name: "Follow Facebook",
        points: Math.floor(Math.random() * 25) + 10, // 10-35 points
        link: "https://facebook.com/solvium",
      },
      {
        name: "Subscribe to Youtube",
        points: Math.floor(Math.random() * 35) + 20, // 20-55 points
        link: "https://youtube.com/@solvium",
      },
      {
        name: "Connect Wallet",
        points: Math.floor(Math.random() * 100) + 50, // 50-150 points
        link: "",
      },
      {
        name: "Share on Instagram",
        points: Math.floor(Math.random() * 40) + 25, // 25-65 points
        link: "https://instagram.com/solvium",
      },
      {
        name: "Join Discord Server",
        points: Math.floor(Math.random() * 45) + 30, // 30-75 points
        link: "https://discord.gg/solvium",
      },
      {
        name: "Follow on LinkedIn",
        points: Math.floor(Math.random() * 35) + 20, // 20-55 points
        link: "https://linkedin.com/company/solvium",
      },
      {
        name: "Visit Website",
        points: Math.floor(Math.random() * 20) + 10, // 10-30 points
        link: "https://solvium.com",
      },
    ];

    // Generate 10 random tasks
    const generatedTasks = [];
    const usedIndices = new Set();

    for (let i = 0; i < 10; i++) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * taskTemplates.length);
      } while (usedIndices.has(randomIndex));

      usedIndices.add(randomIndex);

      const template = taskTemplates[randomIndex];
      generatedTasks.push({
        name: template.name,
        points: template.points,
        link: template.link,
        isCompleted: false,
      });
    }

    // Create tasks in database
    const createdTasks = [];
    for (const task of generatedTasks) {
      const createdTask = await prisma.task.upsert({
        where: { name: task.name },
        update: {
          points: task.points,
          link: task.link,
        },
        create: {
          name: task.name,
          points: task.points,
          link: task.link,
          isCompleted: false,
        },
      });
      createdTasks.push(createdTask);
    }

    return NextResponse.json({
      success: true,
      message: "Generated 10 random tasks successfully",
      tasks: createdTasks,
    });
  } catch (error) {
    console.error("Error generating tasks:", error);
    return NextResponse.json(
      { error: "Failed to generate tasks" },
      { status: 500 }
    );
  }
}
