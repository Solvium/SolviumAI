/**
 * Daily Word Fetch Script
 *
 * This script fetches words from Gemini AI and stores them in the database.
 * It should be run once daily to maintain a fresh supply of words.
 *
 * Usage:
 * - Run manually: npx tsx src/scripts/dailyWordFetch.ts
 * - Schedule with cron: 0 0 * * * cd /path/to/project && npx tsx src/scripts/dailyWordFetch.ts
 * - Or call the API endpoint: POST /api/words/fetch-daily
 */

import { config } from "dotenv";
import { performDailyWordFetch } from "../lib/services/geminiWordService";

// Load environment variables
config();

async function main() {
  console.log("🚀 Starting daily word fetch...");
  console.log("⏰ Time:", new Date().toISOString());

  try {
    const results = await performDailyWordFetch();

    console.log("\n📊 Daily Word Fetch Results:");
    console.log("================================");

    let totalWords = 0;
    let successCount = 0;

    results.forEach((result) => {
      const status = result.success ? "✅" : "❌";
      console.log(
        `${status} ${result.difficulty.toUpperCase()}: ${
          result.wordsCount
        } words`
      );

      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      totalWords += result.wordsCount;
      if (result.success) successCount++;
    });

    console.log("================================");
    console.log(`📈 Total words fetched: ${totalWords}`);
    console.log(
      `🎯 Successful difficulties: ${successCount}/${results.length}`
    );

    if (successCount === results.length) {
      console.log("🎉 All difficulties fetched successfully!");
      process.exit(0);
    } else {
      console.log("⚠️  Some difficulties failed to fetch");
      process.exit(1);
    }
  } catch (error) {
    console.error("💥 Fatal error during daily word fetch:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
