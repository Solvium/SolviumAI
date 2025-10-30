import { NextRequest, NextResponse } from "next/server";
import { performDailyWordFetch } from "@/lib/services/geminiWordService";

// Trigger daily fetch of words from Gemini and store in DB
export async function POST(req: NextRequest) {
  try {
    const results = await performDailyWordFetch();
    const total = results.reduce((sum, r) => sum + (r.wordsCount || 0), 0);

    return NextResponse.json({ success: true, total, results });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed daily fetch" },
      { status: 500 }
    );
  }
}
