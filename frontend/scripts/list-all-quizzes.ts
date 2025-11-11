// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file from the project root
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

import { prisma } from "../src/lib/prisma";

async function listAllQuizzes() {
  console.log("📋 Fetching all quiz questions...\n");

  try {
    // Fetch all quizzes ordered by creation date
    const allQuizzes = await prisma.quiz.findMany({
      orderBy: { createdAt: "asc" },
    });

    console.log(`📊 Total quizzes: ${allQuizzes.length}\n`);
    console.log("=" .repeat(80));
    console.log("ALL QUIZ QUESTIONS:");
    console.log("=" .repeat(80));
    console.log("");

    allQuizzes.forEach((quiz, index) => {
      console.log(`${index + 1}. [ID: ${quiz.id}]`);
      console.log(`   Question: "${quiz.question}"`);
      console.log(`   Category: ${quiz.category}`);
      console.log(`   Difficulty: ${quiz.difficulty}`);
      console.log(`   Points: ${quiz.points}`);
      console.log(`   Options: ${JSON.stringify(quiz.options)}`);
      console.log(`   Correct Answer: ${quiz.correctAnswer}`);
      console.log(`   Created: ${quiz.createdAt.toISOString()}`);
      console.log("");
    });

    console.log("=" .repeat(80));
    console.log(`\n📊 Summary: ${allQuizzes.length} total quiz questions`);
    
    // Group by category
    const byCategory = allQuizzes.reduce((acc, quiz) => {
      acc[quiz.category] = (acc[quiz.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log("\n📊 By Category:");
    Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count}`);
      });

    // Group by difficulty
    const byDifficulty = allQuizzes.reduce((acc, quiz) => {
      acc[quiz.difficulty] = (acc[quiz.difficulty] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    console.log("\n📊 By Difficulty:");
    Object.entries(byDifficulty)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([difficulty, count]) => {
        console.log(`   Difficulty ${difficulty}: ${count}`);
      });

  } catch (error) {
    console.error("❌ Error fetching quizzes:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
listAllQuizzes()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

