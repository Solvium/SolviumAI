import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JWTService } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    console.log("[login-track] Incoming request");
    // Get user ID from JWT access token or legacy token
    const accessToken = request.cookies.get("accessToken");
    const legacyToken = request.cookies.get("auth_token");

    let userId: string | null = null;

    // Try JWT token first
    if (accessToken) {
      try {
        const payload = JWTService.verifyAccessToken(accessToken.value);
        userId = payload.userId;
        console.log(
          "Login-track API: JWT authentication successful for user:",
          userId
        );
      } catch (error) {
        console.log("Login-track API: JWT verification failed:", error);
        userId = null;
      }
    }

    // Fallback to legacy token
    if (!userId && legacyToken) {
      try {
        const uid = parseInt(legacyToken.value);
        if (!Number.isNaN(uid)) {
          userId = uid.toString();
          console.log(
            "Login-track API: Legacy token authentication successful for user:",
            userId
          );
        }
      } catch (error) {
        console.log(
          "Login-track API: Legacy token verification failed:",
          error
        );
        userId = null;
      }
    }

    if (!userId) {
      console.log("Login-track API: No valid authentication token found");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user data
    console.log("[login-track] Resolved userId:", userId);
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Track daily login
    const today = new Date();
    const lastLogin = user.lastClaim ? new Date(user.lastClaim) : null;
    console.log("[login-track] lastLogin:", lastLogin?.toISOString());
    const isNewDay =
      !lastLogin || lastLogin.toDateString() !== today.toDateString();

    // Compute next potential claim (next midnight)
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const msUntilNextClaim = nextMidnight.getTime() - now.getTime();
    console.log(
      "[login-track] nextPotentialClaim:",
      nextMidnight.toISOString(),
      "timeLeftMs=",
      msUntilNextClaim
    );

    if (isNewDay) {
      // Calculate proposed streak, but DO NOT persist here.
      const isConsecutive =
        !!lastLogin &&
        lastLogin.toDateString() ===
          new Date(today.getTime() - 24 * 60 * 60 * 1000).toDateString();
      const newStreak = isConsecutive ? (user.claimCount || 0) + 1 : 1;
      console.log(
        "[login-track] New day detected (no DB write). isConsecutive=",
        isConsecutive,
        "proposedStreak=",
        newStreak
      );

      return NextResponse.json({
        success: true,
        message: "Eligible to claim daily login",
        streak: newStreak,
        isNewDay: true,
        lastLogin: lastLogin?.toISOString(),
        nextClaimAt: nextMidnight.toISOString(),
        timeLeftMs: msUntilNextClaim,
      });
    } else {
      console.log(
        "[login-track] Already logged in today. Current streak:",
        user.claimCount || 0
      );
      return NextResponse.json({
        success: true,
        message: "Already logged in today",
        streak: user.claimCount || 0,
        isNewDay: false,
        lastLogin: lastLogin?.toISOString(),
        nextClaimAt: nextMidnight.toISOString(),
        timeLeftMs: msUntilNextClaim,
      });
    }
  } catch (error) {
    console.error("Error tracking login:", error);
    return NextResponse.json(
      { error: "Failed to track login" },
      { status: 500 }
    );
  }
}
