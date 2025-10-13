import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verify as jwtVerify } from "jsonwebtoken";

async function getAuthenticatedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth_token");
  if (!authToken) return null;

  const raw = authToken.value;
  const asNumber = parseInt(raw);
  if (!Number.isNaN(asNumber)) return asNumber;

  try {
    const decoded = jwtVerify(
      raw,
      process.env.JWT_SECRET! /* required */
    ) as any;
    if (decoded && typeof decoded.id === "number") return decoded.id;
    if (decoded && decoded.id && typeof decoded.id === "string") {
      const fromStr = parseInt(decoded.id);
      return Number.isNaN(fromStr) ? null : fromStr;
    }
  } catch {}

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { referrer } = (await req.json().catch(() => ({}))) as {
      referrer?: string;
    };

    if (!referrer || typeof referrer !== "string") {
      return NextResponse.json({ error: "invalid_referrer" }, { status: 400 });
    }

    const me = await prisma.user.findUnique({ where: { id: userId } });
    if (!me) return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (me.referredBy && me.referredBy.length > 0) {
      return NextResponse.json({ error: "already_set" }, { status: 409 });
    }

    // Prevent self-referral by username
    if (me.username && me.username.toLowerCase() === referrer.toLowerCase()) {
      return NextResponse.json(
        { error: "self_referral_forbidden" },
        { status: 400 }
      );
    }

    const inviter = await prisma.user.findUnique({
      where: { username: referrer },
      select: { id: true, username: true },
    });
    if (!inviter) {
      return NextResponse.json(
        { error: "referrer_not_found" },
        { status: 404 }
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { referredBy: inviter.username },
    });

    // Note: referralCount increments are handled on claim flow (/api/claim)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("/api/referral/set error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
