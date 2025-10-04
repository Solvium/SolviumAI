/**
 * API Route for Getting Words for Wordle Game
 *
 * This endpoint provides words for the Wordle game based on user level and difficulty.
 * It ensures users don't get repeated words and rotates through available words.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRandomWordForUser } from "@/lib/services/geminiWordService";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, level, gameType = "wordle" } = body;

    if (!userId || !level) {
      return NextResponse.json(
        {
          success: false,
          message: "userId and level are required",
        },
        { status: 400 }
      );
    }

    // Get user data for logging
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wordUsages: {
          where: { gameType },
          include: {
            word: true,
          },
        },
        wordleGames: {
          orderBy: { playedAt: "desc" },
          take: 3,
        },
      },
    });

    console.log("📝 Word Request - User Data:", {
      userId,
      level,
      gameType,
      user: {
        id: userData?.id,
        username: userData?.username,
        level: userData?.level,
        difficulty: userData?.difficulty,
        totalSOLV: userData?.totalSOLV,
        gamesPlayed: userData?.gamesPlayed,
        gamesWon: userData?.gamesWon,
      },
      usedWords:
        userData?.wordUsages?.map((usage) => ({
          word: usage.word.word,
          difficulty: usage.word.difficulty,
          usedAt: usage.usedAt,
        })) || [],
      recentGames:
        userData?.wordleGames?.map((game) => ({
          won: game.won,
          level: game.level,
          difficulty: game.difficulty,
          playedAt: game.playedAt,
        })) || [],
    });

    // Get a random word for the user
    const wordData = await getRandomWordForUser(userId, level, gameType);

    if (!wordData) {
      console.log("❌ No word available for user:", {
        userId,
        level,
        gameType,
      });
      return NextResponse.json(
        {
          success: false,
          message: "No available words for this difficulty level",
          suggestion: "Try again later or contact support",
        },
        { status: 404 }
      );
    }

    console.log("✅ Word Selected:", {
      word: wordData.word,
      length: wordData.length,
      difficulty: wordData.difficulty,
      meaning: wordData.meaning?.substring(0, 50) + "...",
      examples: wordData.examples?.length || 0,
      synonyms: wordData.synonyms?.length || 0,
    });

    // Return the word data (excluding sensitive information)
    return NextResponse.json({
      success: true,
      word: wordData.word,
      length: wordData.length,
      difficulty: wordData.difficulty,
      // Don't return meaning, examples, synonyms to prevent cheating
      // These can be fetched separately if needed
    });
  } catch (error) {
    console.error("Error getting word for user:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to get word",
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const level = searchParams.get("level");
    const gameType = searchParams.get("gameType") || "wordle";

    if (!userId || !level) {
      return NextResponse.json(
        {
          success: false,
          message: "userId and level are required",
        },
        { status: 400 }
      );
    }

    const userIdNum = parseInt(userId);
    const levelNum = parseInt(level);

    if (isNaN(userIdNum) || isNaN(levelNum)) {
      return NextResponse.json(
        {
          success: false,
          message: "userId and level must be valid numbers",
        },
        { status: 400 }
      );
    }

    // Get a random word for the user
    const wordData = await getRandomWordForUser(userIdNum, levelNum, gameType);

    if (!wordData) {
      return NextResponse.json(
        {
          success: false,
          message: "No available words for this difficulty level",
          suggestion: "Try again later or contact support",
        },
        { status: 404 }
      );
    }

    // Return the word data
    return NextResponse.json({
      success: true,
      word: wordData.word,
      length: wordData.length,
      difficulty: wordData.difficulty,
    });
  } catch (error) {
    console.error("Error getting word for user:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to get word",
        error: String(error),
      },
      { status: 500 }
    );
  }
}
