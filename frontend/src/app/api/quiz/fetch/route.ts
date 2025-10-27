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

    // Check if we have enough quizzes in the pool first
    const quizCount = await prisma.quiz.count();
    console.log(`📊 Current quiz pool size: ${quizCount}`);

    if (existingLog && quizCount >= 500) {
      console.log("✅ Quizzes already generated today and pool is sufficient");
      return NextResponse.json({
        success: true,
        message: "Quizzes already generated today",
        totalGenerated: existingLog.totalGenerated,
      });
    }

    // If we have an existing log but pool is low, still generate more
    if (existingLog && quizCount < 500) {
      console.log(
        "⚠️ Quizzes generated today but pool is low, generating more..."
      );
    }

    // Always trigger daily quiz generation if we have less than 500 quizzes
    // This ensures we always have enough fresh content for all-time filtering
    if (quizCount < 500) {
      console.log(
        "🔄 Ensuring sufficient quiz pool, triggering daily generation..."
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
            console.log("✅ Daily quiz generation completed:", generateResult);
          } else {
            console.error(
              "❌ Daily quiz generation failed:",
              generateResponse.statusText
            );
          }
        })
        .catch((generateError) => {
          console.error("❌ Daily quiz generation error:", generateError);
        });

      // Return immediately with available quizzes
      return NextResponse.json({
        success: true,
        message: "Daily quiz generation started in background",
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
