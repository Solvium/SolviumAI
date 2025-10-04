/**
 * Clear Word Fetch Log
 *
 * This script clears the word fetch log so we can test the daily fetch again.
 */

import { config } from "dotenv";
import { prisma } from "../lib/prisma";

// Load environment variables
config();

async function clearFetchLog() {
  console.log("🧹 Clearing word fetch log...");

  try {
    // Clear the fetch log
    const deleted = await prisma.wordFetchLog.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} fetch log entries`);

    // Also clear any existing words for testing
    const deletedWords = await prisma.word.deleteMany({});
    console.log(`✅ Deleted ${deletedWords.count} existing words`);

    console.log("🎉 Fetch log cleared successfully!");
  } catch (error) {
    console.error("💥 Error clearing fetch log:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  clearFetchLog();
}
