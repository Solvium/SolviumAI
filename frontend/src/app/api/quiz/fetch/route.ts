import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    console.log(
      `🎯 Checking if daily quiz generation is needed for user ${userId}...`
    );

    // Check if quizzes were already generated today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingLog = await prisma.quizGenerationLog.findFirst({
      where: {
        date: {
          gte: today,
        },
        success: true,
      },
    });

    if (existingLog) {
      console.log("✅ Quizzes already generated today");
      return NextResponse.json({
        success: true,
        message: "Quizzes already generated today",
        totalGenerated: existingLog.totalGenerated,
      });
    }

    // Check if we have enough quizzes in the pool
    const quizCount = await prisma.quiz.count();
    console.log(`📊 Current quiz pool size: ${quizCount}`);

    if (quizCount < 50) {
      console.log(
        "🔄 Not enough quizzes in pool, triggering async generation..."
      );

      // Trigger quiz generation asynchronously (don't wait for it)
      fetch(
        `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:6001"
        }/api/quiz/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
        .then(async (generateResponse) => {
          if (generateResponse.ok) {
            const generateResult = await generateResponse.json();
            console.log("✅ Async quiz generation completed:", generateResult);
          } else {
            console.error(
              "❌ Async quiz generation failed:",
              generateResponse.statusText
            );
          }
        })
        .catch((generateError) => {
          console.error("❌ Async quiz generation error:", generateError);
        });

      // Return immediately with available quizzes
      return NextResponse.json({
        success: true,
        message: "Quiz generation started in background",
        totalAvailable: quizCount,
        generating: true,
      });
    }

    console.log("✅ Sufficient quizzes available in pool");
    return NextResponse.json({
      success: true,
      message: "Sufficient quizzes available",
      totalAvailable: quizCount,
    });
  } catch (error) {
    console.error("[quiz/fetch] Error:", error);
    return NextResponse.json(
      { error: "Failed to check quiz availability" },
      { status: 500 }
    );
  }
}
