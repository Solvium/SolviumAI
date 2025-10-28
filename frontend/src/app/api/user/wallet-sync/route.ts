import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { JWTService } from "@/lib/auth/jwt";

async function getAuthenticatedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken");
  const legacyToken = cookieStore.get("auth_token");

  if (accessToken) {
    try {
      const decoded = JWTService.verifyAccessToken(accessToken.value);
      const uid = parseInt(decoded.userId);
      return Number.isNaN(uid) ? null : uid;
    } catch {}
  }
  if (legacyToken) {
    try {
      const uid = parseInt(legacyToken.value);
      return Number.isNaN(uid) ? null : uid;
    } catch {}
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const accountId = (body?.accountId as string | undefined)?.trim();
    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Fetch current wallet JSON
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { wallet: true },
    });

    const currentWallet = (user?.wallet || {}) as any;
    const nextWallet = {
      ...currentWallet,
      account_id: accountId,
      accountId: accountId,
      near: accountId,
      updated_at: new Date().toISOString(),
      source: "wallet-sync",
    };

    await prisma.user.update({
      where: { id: userId },
      data: { wallet: nextWallet },
    });

    return NextResponse.json({ success: true, accountId });
  } catch (error) {
    console.error("[wallet-sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to sync wallet" },
      { status: 500 }
    );
  }
}
