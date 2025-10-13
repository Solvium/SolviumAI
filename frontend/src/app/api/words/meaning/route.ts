import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Return meaning ONLY if the word exists in our DB (i.e., our word)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const word = (searchParams.get("word") || "").toUpperCase();
    if (!word) {
      return NextResponse.json(
        { success: false, message: "Missing word" },
        { status: 400 }
      );
    }

    // Look up the word in our Words table
    const record = await prisma.word.findUnique({ where: { word } });
    if (!record) {
      return NextResponse.json({ success: false, message: "Not our word" });
    }

    return NextResponse.json({
      success: true,
      word: record.word,
      meaning: record.meaning || undefined,
      examples: (record.examples as string[]) || [],
      synonyms: (record.synonyms as string[]) || [],
      difficulty: record.difficulty,
      length: record.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed to get meaning" },
      { status: 500 }
    );
  }
}
