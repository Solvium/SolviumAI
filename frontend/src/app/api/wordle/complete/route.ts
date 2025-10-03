import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { dailyId, won, guesses, level } = await req.json();
    if (!dailyId || typeof won !== "boolean" || typeof guesses !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid fields" },
        { status: 400 }
      );
    }
    // Future: persist results and log activity. For now, ack success.
    return NextResponse.json({ success: true, level: Number(level) || 1 });
  } catch (e) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
