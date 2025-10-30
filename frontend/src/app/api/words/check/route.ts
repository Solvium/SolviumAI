import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

let wordsSet: Set<string> | null = null;

function loadDictionary(): Set<string> {
  if (wordsSet) return wordsSet;
  const dictPath = path.join(process.cwd(), "src", "lib", "dictionary.json");
  const raw = fs.readFileSync(dictPath, "utf-8");
  const words: string[] = JSON.parse(raw);
  wordsSet = new Set(words.map((w) => w.toUpperCase()));
  return wordsSet;
}

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

    const set = loadDictionary();
    const success = set.has(word);
    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed to check word" },
      { status: 500 }
    );
  }
}
