import { NextRequest, NextResponse } from "next/server";
import { LevelService } from "@/lib/services/levelService";

export async function POST(request: NextRequest) {
  try {
    const { experiencePoints } = await request.json();

    if (typeof experiencePoints !== "number") {
      return NextResponse.json(
        { error: "Experience points must be a number" },
        { status: 400 }
      );
    }

    const levelInfo = await LevelService.calculateLevelInfo(experiencePoints);

    return NextResponse.json(levelInfo);
  } catch (error) {
    console.error("Error calculating level progress:", error);
    return NextResponse.json(
      { error: "Failed to calculate level progress" },
      { status: 500 }
    );
  }
}
