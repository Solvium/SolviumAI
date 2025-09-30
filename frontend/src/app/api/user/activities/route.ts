import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LevelService } from "@/lib/services/levelService";
import { verify as jwtVerify } from "jsonwebtoken";

// Helper function to get user ID from token (reuse existing pattern)
const getUserIdFromToken = (request: NextRequest): number | null => {
  const authToken = request.cookies.get("auth_token");
  if (!authToken) return null;

  const raw = authToken.value;
  const asNumber = parseInt(raw);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }

  try {
    const decoded = jwtVerify(raw, process.env.JWT_SECRET!) as any;
    return decoded?.id || null;
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activity_type, points_earned, metadata } = await request.json();

    // Log the activity
    const activity = await prisma.userActivity.create({
      data: {
        userId: userId,
        activity_type,
        points_earned,
        metadata,
      },
    });

    // Update user's experience points
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        experience_points: { increment: points_earned },
        totalPoints: { increment: points_earned },
      },
    });

    // Check for level up
    const leveledUp = await LevelService.checkLevelUp(
      userId.toString(),
      updatedUser.experience_points
    );

    return NextResponse.json({
      activity,
      leveledUp,
      newExperience: updatedUser.experience_points,
    });
  } catch (error) {
    console.error("Activity logging error:", error);
    return NextResponse.json(
      { error: "Failed to log activity" },
      { status: 500 }
    );
  }
}
