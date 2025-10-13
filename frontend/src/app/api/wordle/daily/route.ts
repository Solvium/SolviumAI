import { NextRequest, NextResponse } from "next/server";
import { getDailyId, getDailyAnswer } from "@/lib/wordle/service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const level = Number(searchParams.get("level") || 1);
  const dailyId = getDailyId();
  const answer = getDailyAnswer(dailyId, level);
  const hardModeEnabled = process.env.WORDLE_HARD_MODE === "true";
  return NextResponse.json({
    dailyId,
    level,
    length: answer.length,
    hardModeEnabled,
    answer,
  });
}
