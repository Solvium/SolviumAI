import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { JWTService } from "@/lib/auth/jwt";
import { calculatePointsWithMultiplier } from "@/lib/services/ServerMultiplierService";

async function getAuthenticatedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken");
  const legacyToken = cookieStore.get("auth_token");

  // Try JWT token first, then fallback to legacy token
  let userId: number | null = null;

  if (accessToken) {
    try {
      const decoded = JWTService.verifyAccessToken(accessToken.value);
      const uid = parseInt(decoded.userId);
      userId = Number.isNaN(uid) ? null : uid;
    } catch (e) {
      console.log("JWT verification failed:", e);
      userId = null;
    }
  }

  // Fallback to legacy token if JWT fails
  if (!userId && legacyToken) {
    try {
      const uid = parseInt(legacyToken.value);
      userId = Number.isNaN(uid) ? null : uid;
    } catch (e) {
      console.log("Legacy token verification failed:", e);
      userId = null;
    }
  }

  return userId;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's wallet/accountId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        wallet: true,
        chatId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Resolve accountId from wallet
    let accountId: string | undefined = undefined;
    try {
      const walletJson = (user.wallet || {}) as any;
      accountId =
        walletJson?.account_id || walletJson?.accountId || walletJson?.near;
    } catch {}

    // Fallback: try wallet cache via telegram chatId
    if (!accountId && user.chatId) {
      try {
        const chatNumeric = parseInt(user.chatId);
        if (!Number.isNaN(chatNumeric)) {
          const walletCache = await prisma.walletCache.findUnique({
            where: { telegramUserId: chatNumeric },
          });
          accountId = walletCache?.accountId || undefined;
        }
      } catch (e) {
        console.log("WalletCache lookup failed:", e);
      }
    }

    // Calculate multiplier (using basePoints=1 to get just the multiplier)
    const calculation = await calculatePointsWithMultiplier(1, accountId);

    return NextResponse.json({
      success: true,
      multiplier: calculation.multiplier,
      accountId: accountId || null,
    });
  } catch (error) {
    console.error("Error fetching multiplier:", error);
    return NextResponse.json(
      { error: "Failed to fetch multiplier", multiplier: 1 },
      { status: 500 }
    );
  }
}

