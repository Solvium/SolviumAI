import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CATEGORIES = [
  "science",
  "history",
  "geography",
  "sports",
  "entertainment",
  "technology",
  "literature",
  "art",
  "music",
  "general",
];

const DIFFICULTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export async function POST(req: NextRequest) {
  try {
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
      return NextResponse.json({
        success: true,
        message: "Quizzes already generated today",
        totalGenerated: existingLog.totalGenerated,
      });
    }

    console.log("🎯 Starting daily quiz generation...");

    let totalGenerated = 0;
    const errors: string[] = [];

    // Generate 5 batches of 20 quizzes each (100 total)
    for (let batch = 1; batch <= 5; batch++) {
      try {
        console.log(`📝 Generating batch ${batch}/5...`);

        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `Generate 20 multiple-choice quiz questions with the following requirements:
              - Categories: ${CATEGORIES.join(", ")}
              - Difficulties: 1-10 (1=easiest, 10=hardest)
              - Each question must have exactly 4 options (A, B, C, D)
              - Include a mix of categories and difficulties
              - Questions should be factual and educational
              - Format as JSON array with: question, options (array of 4), correctAnswer, difficulty, category
              - Ensure correctAnswer matches one of the options exactly`,
            },
            {
              role: "user",
              content: `Generate 20 quiz questions with varied categories and difficulties. Return as JSON array.`,
            },
          ],
          temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No content received from OpenAI");
        }

        // Parse the JSON response - handle markdown formatting
        let quizzes;
        try {
          // Remove markdown code blocks if present
          let cleanContent = content.trim();
          if (cleanContent.startsWith("```json")) {
            cleanContent = cleanContent
              .replace(/^```json\s*/, "")
              .replace(/\s*```$/, "");
          } else if (cleanContent.startsWith("```")) {
            cleanContent = cleanContent
              .replace(/^```\s*/, "")
              .replace(/\s*```$/, "");
          }

          quizzes = JSON.parse(cleanContent);
        } catch (parseError) {
          console.error("Failed to parse OpenAI response:", parseError);
          console.error("Raw content:", content);
          errors.push(`Batch ${batch}: Invalid JSON response`);
          continue;
        }

        if (!Array.isArray(quizzes)) {
          throw new Error("Response is not an array");
        }

        // Save quizzes to database
        for (const quizData of quizzes) {
          try {
            await prisma.quiz.create({
              data: {
                question: quizData.question,
                options: quizData.options,
                correctAnswer: quizData.correctAnswer,
                difficulty: quizData.difficulty,
                category: quizData.category,
                points: quizData.difficulty * 2, // 2 points per difficulty level
              },
            });
            totalGenerated++;
          } catch (dbError) {
            console.error("Failed to save quiz:", dbError);
            errors.push(`Batch ${batch}: Database error for quiz`);
          }
        }

        console.log(`✅ Batch ${batch} completed: ${quizzes.length} quizzes`);

        // Small delay between batches to be respectful to OpenAI
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (batchError: any) {
        console.error(`❌ Batch ${batch} failed:`, batchError);
        errors.push(`Batch ${batch}: ${batchError.message}`);
      }
    }

    // Log the generation attempt
    await prisma.quizGenerationLog.create({
      data: {
        totalGenerated,
        categories: CATEGORIES,
        difficulties: DIFFICULTIES,
        success: totalGenerated > 0,
        errorMessage: errors.length > 0 ? errors.join("; ") : null,
      },
    });

    console.log(
      `🎉 Quiz generation completed: ${totalGenerated} quizzes generated`
    );

    return NextResponse.json({
      success: true,
      totalGenerated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[quiz/generate] Error:", error);

    // Log failed attempt
    await prisma.quizGenerationLog.create({
      data: {
        totalGenerated: 0,
        categories: CATEGORIES,
        difficulties: DIFFICULTIES,
        success: false,
        errorMessage: error.message,
      },
    });

    return NextResponse.json(
      { error: "Failed to generate quizzes" },
      { status: 500 }
    );
  }
}
