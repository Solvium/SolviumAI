import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { quizId, selectedAnswer } = await req.json();

    if (!quizId || !selectedAnswer) {
      return NextResponse.json(
        { error: "quizId and selectedAnswer are required" },
        { status: 400 }
      );
    }

    // Get the quiz with correct answer
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { correctAnswer: true, points: true },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const isCorrect = selectedAnswer === quiz.correctAnswer;

    // Log quiz question and answer for debugging
    console.log("🧠 Quiz Answer Validation:", {
      quizId,
      selectedAnswer,
      correctAnswer: quiz.correctAnswer,
      isCorrect,
      points: isCorrect ? quiz.points : 0,
    });

    return NextResponse.json({
      success: true,
      isCorrect,
      points: isCorrect ? quiz.points : 0,
      correctAnswer: quiz.correctAnswer,
    });
  } catch (error) {
    console.error("Quiz validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate answer" },
      { status: 500 }
    );
  }
}
