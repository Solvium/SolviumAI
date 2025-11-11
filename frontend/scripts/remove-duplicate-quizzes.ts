// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file from the project root
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

import { prisma } from "../src/lib/prisma";

// Normalize question text for comparison
function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " "); // Normalize whitespace
}

async function removeDuplicateQuizzes() {
  console.log("🔍 Finding and removing duplicate quizzes...\n");

  try {
    // Fetch all quizzes ordered by creation date (oldest first)
    const allQuizzes = await prisma.quiz.findMany({
      orderBy: { createdAt: "asc" },
    });

    console.log(`📊 Total quizzes in database: ${allQuizzes.length}\n`);

    const seenQuestions = new Map<string, string>(); // normalized question -> quiz ID to keep
    const duplicatesToDelete: string[] = [];

    // Find duplicates - keep the first (oldest) occurrence
    for (const quiz of allQuizzes) {
      const normalized = normalizeQuestion(quiz.question);

      if (seenQuestions.has(normalized)) {
        // This is a duplicate - mark for deletion
        duplicatesToDelete.push(quiz.id);
        const keptId = seenQuestions.get(normalized)!;
        console.log(
          `🗑️  Marking duplicate for deletion: ${quiz.id} (duplicate of ${keptId})`
        );
        console.log(`   Question: "${quiz.question}"`);
        console.log(`   Category: ${quiz.category}, Difficulty: ${quiz.difficulty}`);
      } else {
        // First time seeing this question - keep it
        seenQuestions.set(normalized, quiz.id);
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   Unique questions: ${seenQuestions.size}`);
    console.log(`   Duplicates to delete: ${duplicatesToDelete.length}`);

    if (duplicatesToDelete.length === 0) {
      console.log("\n✅ No duplicates found! Database is clean.");
      return;
    }

    // Ask for confirmation (in a script, we'll proceed with deletion)
    console.log(`\n⚠️  About to delete ${duplicatesToDelete.length} duplicate quiz(es)...`);

    // Delete duplicates
    const deleteResult = await prisma.quiz.deleteMany({
      where: {
        id: {
          in: duplicatesToDelete,
        },
      },
    });

    console.log(`\n✅ Successfully deleted ${deleteResult.count} duplicate quiz(es)!`);
    console.log(`📊 Remaining quizzes: ${allQuizzes.length - deleteResult.count}`);

    // Verify by checking again
    const remainingQuizzes = await prisma.quiz.findMany();
    console.log(`\n🔍 Verification: ${remainingQuizzes.length} quizzes remaining in database`);
  } catch (error) {
    console.error("❌ Error removing duplicates:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
removeDuplicateQuizzes()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

