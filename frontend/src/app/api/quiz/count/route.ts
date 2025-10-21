import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const quizCount = await prisma.quiz.count();

    // Get count by category
    const categoryCounts = await prisma.quiz.groupBy({
      by: ["category"],
      _count: {
        category: true,
      },
    });

    // Get count by difficulty
    const difficultyCounts = await prisma.quiz.groupBy({
      by: ["difficulty"],
      _count: {
        difficulty: true,
      },
    });

    return NextResponse.json({
      success: true,
      totalQuizzes: quizCount,
      byCategory: categoryCounts,
      byDifficulty: difficultyCounts,
    });
  } catch (error) {
    console.error("Error getting quiz count:", error);
    return NextResponse.json(
      { error: "Failed to get quiz count" },
      { status: 500 }
    );
  }
}
