import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId, gameType, hintCost, hintData } = await req.json();

    // Validate input
    if (!userId || !gameType || !hintCost) {
      return NextResponse.json(
        { error: "Missing required fields: userId, gameType, hintCost" },
        { status: 400 }
      );
    }

    // Get user's current SOLV balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalSOLV: true, username: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has enough SOLV
    if (user.totalSOLV < hintCost) {
      return NextResponse.json(
        {
          error: "Insufficient SOLV balance",
          currentBalance: user.totalSOLV,
          required: hintCost,
          shortfall: hintCost - user.totalSOLV,
        },
        { status: 400 }
      );
    }

    // Deduct SOLV from user's balance
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        totalSOLV: {
          decrement: hintCost,
        },
      },
      select: { totalSOLV: true, username: true },
    });

    // Log hint usage activity
    await prisma.userActivity.create({
      data: {
        userId: userId,
        activity_type: "HINT_USED",
        points_earned: 0, // No points for using hints
        metadata: {
          gameType: gameType,
          hintCost: hintCost,
          hintData: hintData || {},
          remainingBalance: updatedUser.totalSOLV,
        },
      },
    });

    console.log(
      `💡 Hint used: ${user.username} used ${hintCost} SOLV for ${gameType} hint. New balance: ${updatedUser.totalSOLV}`
    );

    return NextResponse.json({
      success: true,
      message: `Hint purchased for ${hintCost} SOLV`,
      newBalance: updatedUser.totalSOLV,
      hintData: hintData,
    });
  } catch (error) {
    console.error("Hint API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const gameType = searchParams.get("gameType");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Get user's current SOLV balance
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { totalSOLV: true, username: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get recent hint usage for the game type
    const recentHints = await prisma.userActivity.findMany({
      where: {
        userId: parseInt(userId),
        activity_type: "HINT_USED",
        metadata: {
          path: ["gameType"],
          equals: gameType || undefined,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      currentBalance: user.totalSOLV,
      recentHints: recentHints.map((hint) => ({
        id: hint.id,
        gameType: (hint.metadata as any)?.gameType,
        hintCost: (hint.metadata as any)?.hintCost,
        usedAt: hint.createdAt,
      })),
    });
  } catch (error) {
    console.error("Hint API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
