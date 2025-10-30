import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

let cachedUppercaseWords: string[] | null = null;

function loadUppercaseWords(): string[] {
  if (cachedUppercaseWords) return cachedUppercaseWords;
  const dictPath = path.join(process.cwd(), "src", "lib", "dictionary.json");
  console.log("[get-word] Loading dictionary from:", dictPath);
  const raw = fs.readFileSync(dictPath, "utf-8");
  const parsed: unknown = JSON.parse(raw);

  let wordsArray: string[] = [];
  if (Array.isArray(parsed)) {
    wordsArray = parsed as string[];
  } else if (parsed && typeof parsed === "object") {
    // Dictionary is organized as { "aa": ["aah", "aahed", ...], "ab": ["aback", ...], ... }
    const dictObj = parsed as Record<string, string[]>;
    wordsArray = Object.values(dictObj).flat();
  } else {
    throw new Error("Unsupported dictionary.json format");
  }

  cachedUppercaseWords = wordsArray.map((w) => String(w).toUpperCase());
  console.log("[get-word] Dictionary loaded:", {
    total: cachedUppercaseWords.length,
  });
  return cachedUppercaseWords;
}

// Returns a word for the given user and level for Wordle
export async function POST(req: NextRequest) {
  try {
    const { userId, level } = await req.json();
    console.log("[get-word] Incoming payload:", { userId, level });
    if (!userId || !level) {
      return NextResponse.json(
        { success: false, message: "Missing userId or level" },
        { status: 400 }
      );
    }
    const upper = loadUppercaseWords();

    const targetLength = pickLengthForLevel(Number(level));
    console.log("[get-word] Target length for level:", {
      level: Number(level),
      targetLength,
    });
    console.log(upper);
    const pool = upper.filter((w) => w.length === targetLength);
    console.log("[get-word] Filtered pool size:", { poolSize: pool.length });
    const word = pool[Math.floor(Math.random() * pool.length)] || "PUZZLE";
    console.log("[get-word] Selected word:", { word });

    return NextResponse.json({
      success: true,
      word,
      length: word.length,
      difficulty: levelToDifficulty(Number(level)),
      source: "dictionary",
    });
  } catch (error) {
    console.error("[get-word] Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to get word" },
      { status: 500 }
    );
  }
}

function levelToDifficulty(level: number): "easy" | "medium" | "hard" {
  if (level <= 5) return "easy";
  if (level <= 10) return "medium";
  return "hard";
}

function pickLengthForLevel(level: number): number {
  if (level <= 5) {
    const choices = [3, 4, 5];
    return choices[Math.floor(Math.random() * choices.length)];
  }
  if (level <= 10) {
    const choices = [6, 7, 8];
    return choices[Math.floor(Math.random() * choices.length)];
  }
  const choices = [9, 10];
  return choices[Math.floor(Math.random() * choices.length)];
}
