/**
 * API Route for Getting Word Meanings
 *
 * This endpoint retrieves the meaning, examples, and synonyms for a given word.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const word = searchParams.get("word");

    if (!word) {
      return NextResponse.json(
        {
          success: false,
          message: "Word parameter is required",
        },
        { status: 400 }
      );
    }

    // Find the word in the database
    const wordData = await prisma.word.findUnique({
      where: { word: word.toUpperCase() },
    });

    if (!wordData) {
      return NextResponse.json(
        {
          success: false,
          message: "Word not found in database",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      word: wordData.word,
      length: wordData.length,
      difficulty: wordData.difficulty,
      meaning: wordData.meaning,
      examples: wordData.examples,
      synonyms: wordData.synonyms,
    });
  } catch (error) {
    console.error("Error getting word meaning:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to get word meaning",
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { word } = body;

    if (!word) {
      return NextResponse.json(
        {
          success: false,
          message: "Word is required in request body",
        },
        { status: 400 }
      );
    }

    // Find the word in the database
    const wordData = await prisma.word.findUnique({
      where: { word: word.toUpperCase() },
    });

    if (!wordData) {
      return NextResponse.json(
        {
          success: false,
          message: "Word not found in database",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      word: wordData.word,
      length: wordData.length,
      difficulty: wordData.difficulty,
      meaning: wordData.meaning,
      examples: wordData.examples,
      synonyms: wordData.synonyms,
    });
  } catch (error) {
    console.error("Error getting word meaning:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to get word meaning",
        error: String(error),
      },
      { status: 500 }
    );
  }
}
