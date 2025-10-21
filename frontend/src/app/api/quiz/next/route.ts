import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const difficulty = searchParams.get("difficulty") || "easy";
    const category = searchParams.get("category");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Get user's completed quizzes to avoid repetition (ALL TIME, not just today)
    const completedQuizzes = await prisma.game.findMany({
      where: {
        userId: parseInt(userId),
        gameType: "quiz",
      },
      select: { gameId: true },
    });

    const completedQuizIds = completedQuizzes.map((g) => g.gameId);

    // Log completed quizzes for debugging
    console.log("✅ Completed Quizzes (All Time):", {
      userId,
      completedQuizIds,
      totalCompleted: completedQuizIds.length,
    });

    // Build where clause for quiz selection
    const whereClause: any = {
      id: {
        notIn: completedQuizIds,
      },
    };

    if (category && category !== "all") {
      whereClause.category = category;
    }

    // Map difficulty string to number range
    let difficultyRange: { gte: number; lte: number };
    switch (difficulty) {
      case "easy":
        difficultyRange = { gte: 1, lte: 3 };
        break;
      case "medium":
        difficultyRange = { gte: 4, lte: 6 };
        break;
      case "hard":
        difficultyRange = { gte: 7, lte: 10 };
        break;
      default:
        difficultyRange = { gte: 1, lte: 10 };
    }

    whereClause.difficulty = difficultyRange;

    // Get a random quiz
    const availableQuizzes = await prisma.quiz.findMany({
      where: whereClause,
      select: { id: true },
    });

    if (availableQuizzes.length === 0) {
      return NextResponse.json(
        { error: "No available quizzes found for your criteria" },
        { status: 404 }
      );
    }

    const randomIndex = Math.floor(Math.random() * availableQuizzes.length);
    const randomQuizId = availableQuizzes[randomIndex].id;

    const quiz = await prisma.quiz.findUnique({
      where: { id: randomQuizId },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Log quiz being served
    console.log("📝 Quiz Served:", {
      quizId: quiz.id,
      question: quiz.question,
      options: quiz.options,
      difficulty: quiz.difficulty,
      category: quiz.category,
      userId,
    });

    // Return quiz without correct answer
    const { correctAnswer, ...quizData } = quiz;
    return NextResponse.json({
      success: true,
      quiz: quizData,
    });
  } catch (error) {
    console.error("[quiz/next] Error:", error);
    return NextResponse.json({ error: "Failed to get quiz" }, { status: 500 });
  }
}
