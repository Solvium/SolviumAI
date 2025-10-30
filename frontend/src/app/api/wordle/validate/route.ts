import { NextRequest, NextResponse } from "next/server";
import { validateGuess } from "@/lib/wordle/service";

export async function POST(req: NextRequest) {
  try {
    const { dailyId, guess, level } = await req.json();
    if (!dailyId || !guess) {
      return NextResponse.json(
        { error: "Missing dailyId or guess" },
        { status: 400 }
      );
    }
    const result = validateGuess(dailyId, guess, Number(level) || 1);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
