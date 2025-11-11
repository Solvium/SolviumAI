// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file from the project root
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

import { prisma } from "../src/lib/prisma";

// Simple string similarity function (Levenshtein distance based)
function similarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(
    longer.toLowerCase(),
    shorter.toLowerCase()
  );
  
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Normalize question text for comparison
function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " "); // Normalize whitespace
}

async function checkDuplicateQuizzes() {
  console.log("🔍 Checking for duplicate quizzes...\n");

  try {
    // Fetch all quizzes
    const allQuizzes = await prisma.quiz.findMany({
      orderBy: { createdAt: "desc" },
    });

    console.log(`📊 Total quizzes in database: ${allQuizzes.length}\n`);

    const duplicates: Array<{
      quiz1: { id: string; question: string; category: string; difficulty: number };
      quiz2: { id: string; question: string; category: string; difficulty: number };
      similarity: number;
      type: "exact" | "similar";
    }> = [];

    // Compare all quizzes with each other
    for (let i = 0; i < allQuizzes.length; i++) {
      for (let j = i + 1; j < allQuizzes.length; j++) {
        const quiz1 = allQuizzes[i];
        const quiz2 = allQuizzes[j];

        const normalized1 = normalizeQuestion(quiz1.question);
        const normalized2 = normalizeQuestion(quiz2.question);

        // Check for exact matches (after normalization)
        if (normalized1 === normalized2) {
          duplicates.push({
            quiz1: {
              id: quiz1.id,
              question: quiz1.question,
              category: quiz1.category,
              difficulty: quiz1.difficulty,
            },
            quiz2: {
              id: quiz2.id,
              question: quiz2.question,
              category: quiz2.category,
              difficulty: quiz2.difficulty,
            },
            similarity: 1.0,
            type: "exact",
          });
        } else {
          // Check for similar matches (similarity > 0.85)
          const sim = similarity(normalized1, normalized2);
          if (sim > 0.85) {
            duplicates.push({
              quiz1: {
                id: quiz1.id,
                question: quiz1.question,
                category: quiz1.category,
                difficulty: quiz1.difficulty,
              },
              quiz2: {
                id: quiz2.id,
                question: quiz2.question,
                category: quiz2.category,
                difficulty: quiz2.difficulty,
              },
              similarity: sim,
              type: "similar",
            });
          }
        }
      }
    }

    // Report results
    if (duplicates.length === 0) {
      console.log("✅ No duplicate quizzes found!\n");
    } else {
      console.log(`⚠️  Found ${duplicates.length} duplicate/similar quiz pair(s):\n`);

      // Group by type
      const exactDuplicates = duplicates.filter((d) => d.type === "exact");
      const similarDuplicates = duplicates.filter((d) => d.type === "similar");

      if (exactDuplicates.length > 0) {
        console.log(`🔴 EXACT DUPLICATES (${exactDuplicates.length}):\n`);
        exactDuplicates.forEach((dup, index) => {
          console.log(`${index + 1}. Quiz IDs: ${dup.quiz1.id} ↔ ${dup.quiz2.id}`);
          console.log(`   Question: "${dup.quiz1.question}"`);
          console.log(`   Category: ${dup.quiz1.category} (difficulty: ${dup.quiz1.difficulty})`);
          console.log(`   vs`);
          console.log(`   Category: ${dup.quiz2.category} (difficulty: ${dup.quiz2.difficulty})`);
          console.log("");
        });
      }

      if (similarDuplicates.length > 0) {
        console.log(`🟡 SIMILAR QUIZZES (${similarDuplicates.length}, similarity > 85%):\n`);
        similarDuplicates.forEach((dup, index) => {
          console.log(`${index + 1}. Quiz IDs: ${dup.quiz1.id} ↔ ${dup.quiz2.id}`);
          console.log(`   Similarity: ${(dup.similarity * 100).toFixed(1)}%`);
          console.log(`   Question 1: "${dup.quiz1.question}"`);
          console.log(`   Category: ${dup.quiz1.category} (difficulty: ${dup.quiz1.difficulty})`);
          console.log(`   Question 2: "${dup.quiz2.question}"`);
          console.log(`   Category: ${dup.quiz2.category} (difficulty: ${dup.quiz2.difficulty})`);
          console.log("");
        });
      }

      // Summary
      const uniqueDuplicateIds = new Set<string>();
      duplicates.forEach((dup) => {
        uniqueDuplicateIds.add(dup.quiz1.id);
        uniqueDuplicateIds.add(dup.quiz2.id);
      });

      console.log(`\n📈 Summary:`);
      console.log(`   Total duplicate pairs: ${duplicates.length}`);
      console.log(`   Unique quizzes involved: ${uniqueDuplicateIds.size}`);
      console.log(`   Exact duplicates: ${exactDuplicates.length}`);
      console.log(`   Similar quizzes: ${similarDuplicates.length}`);
    }
  } catch (error) {
    console.error("❌ Error checking duplicates:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkDuplicateQuizzes()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

