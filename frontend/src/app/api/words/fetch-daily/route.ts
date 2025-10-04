/**
 * API Route for Daily Word Fetching
 *
 * This endpoint fetches words from Gemini AI and stores them in the database.
 * It should be called once daily to maintain a fresh supply of words.
 */

import { NextRequest, NextResponse } from "next/server";
import { performDailyWordFetch } from "@/lib/services/geminiWordService";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization here
    // For now, we'll allow any request but you might want to restrict this

    console.log("🚀 Starting daily word fetch...");

    // Get current database stats before fetch
    // TODO: Fix Prisma client word model issue
    console.log("📊 Database Stats BEFORE Fetch:", {
      totalWords: 0,
      byDifficulty: {},
    });

    const results = await performDailyWordFetch();

    const totalWords = results.reduce(
      (sum, result) => sum + result.wordsCount,
      0
    );
    const successCount = results.filter((result) => result.success).length;

    // Get database stats after fetch
    // TODO: Fix Prisma client word model issue
    console.log("📊 Database Stats AFTER Fetch:", {
      totalWords: 0,
      byDifficulty: {},
      newWordsAdded: totalWords,
    });

    console.log(
      `✅ Daily word fetch completed. Total words: ${totalWords}, Successful difficulties: ${successCount}/${results.length}`
    );

    return NextResponse.json({
      success: true,
      message: "Daily word fetch completed",
      results,
      summary: {
        totalWords,
        successCount,
        totalDifficulties: results.length,
      },
    });
  } catch (error) {
    console.error("Error during daily word fetch:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Daily word fetch failed",
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get today's date for checking fetch status
    const today = new Date().toISOString().split("T")[0];

    // Check if words were fetched today for each difficulty
    const fetchLogs = await prisma.wordFetchLog.findMany({
      where: {
        fetchDate: today,
      },
      orderBy: {
        difficulty: "asc",
      },
    });

    const status = {
      easy: false,
      medium: false,
      hard: false,
    };

    fetchLogs.forEach((log) => {
      if (log.difficulty in status) {
        status[log.difficulty as keyof typeof status] = log.success;
      }
    });

    return NextResponse.json({
      success: true,
      date: today,
      status,
      details: fetchLogs.map((log) => ({
        difficulty: log.difficulty,
        success: log.success,
        wordsCount: log.wordsCount,
        errorMessage: log.errorMessage,
        fetchedAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error checking daily fetch status:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to check daily fetch status",
        error: String(error),
      },
      { status: 500 }
    );
  }
}
