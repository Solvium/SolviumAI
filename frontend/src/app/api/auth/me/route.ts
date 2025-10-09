import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { JWTService } from "@/lib/auth/jwt";

export async function GET(request: NextRequest) {
  try {
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
        console.log("JWT authentication successful for user:", userId);
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
        console.log("Legacy token authentication successful for user:", userId);
      } catch (e) {
        console.log("Legacy token verification failed:", e);
        userId = null;
      }
    }

    if (userId == null) {
      console.log("No valid authentication token found");
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 }
      );
    }

    // Get complete user data from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        wallet: true,
        level: true,
        difficulty: true,
        puzzleCount: true,
        referralCount: true,
        spinCount: true,
        dailySpinCount: true,
        claimCount: true,
        isOfficial: true,
        isMining: true,
        isPremium: true,
        weeklyPoints: true,
        lastSpinClaim: true,
        lastClaim: true,
        chatId: true,
        totalPoints: true,
        experience_points: true,
        totalSOLV: true,
        gamesPlayed: true,
        gamesWon: true,
        avatar_url: true,
        contests_participated: true,
        tasks_completed: true,
        last_level_up: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 404 }
      );
    }

    // Track daily login
    const today = new Date();
    const lastLogin = user.lastClaim ? new Date(user.lastClaim) : null;
    const isNewDay =
      !lastLogin || lastLogin.toDateString() !== today.toDateString();

    if (isNewDay) {
      // Calculate new streak
      const isConsecutive =
        lastLogin &&
        lastLogin.toDateString() ===
          new Date(today.getTime() - 24 * 60 * 60 * 1000).toDateString();
      const newStreak = isConsecutive ? (user.claimCount || 0) + 1 : 1;

      // Update user with new login
      await prisma.user.update({
        where: { id: userId },
        data: {
          lastClaim: today,
          claimCount: newStreak,
        },
      });

      console.log(
        `Daily login tracked for user ${user.username}: streak ${newStreak}`
      );
    }

    // Parse wallet data if it exists
    let walletData = null;
    if (user.wallet) {
      try {
        walletData =
          typeof user.wallet === "string"
            ? JSON.parse(user.wallet)
            : user.wallet;
      } catch (error) {
        console.error("Error parsing wallet data:", error);
      }
    }

    // Format user data to match the User interface
    const userData = {
      id: user.id.toString(),
      username: user.username,
      email: user.email || undefined,
      googleId: undefined, // Not in current schema
      firstName: user.name ? user.name.split(" ")[0] : undefined,
      lastName: user.name ? user.name.split(" ").slice(1).join(" ") : undefined,
      avatar: undefined, // Add if you have avatar field
      totalPoints: user.totalPoints || 0,
      multiplier: 1, // Default multiplier since it's not in schema
      level: user.level || 1,
      difficulty: user.difficulty || 1,
      puzzleCount: user.puzzleCount || 0,
      referralCount: user.referralCount || 0,
      spinCount: user.spinCount || 0,
      dailySpinCount: user.dailySpinCount || 0,
      claimCount: user.claimCount || 0,
      isOfficial: user.isOfficial || false,
      isMining: user.isMining || false,
      isPremium: user.isPremium || false,
      weeklyPoints: user.weeklyPoints || 0,
      createdAt: new Date(), // Default since not in schema
      lastLoginAt: new Date(), // Default since not in schema
      lastSpinClaim: user.lastSpinClaim || undefined,
      lastClaim: user.lastClaim || undefined,
      chatId: user.chatId || undefined,
      wallet: walletData, // Include parsed wallet data
      experience_points: user.experience_points || 0,
      totalSOLV: user.totalSOLV || 0,
      gamesPlayed: user.gamesPlayed || 0,
      gamesWon: user.gamesWon || 0,
      avatar_url: user.avatar_url || undefined,
      contests_participated: user.contests_participated || 0,
      tasks_completed: user.tasks_completed || 0,
      last_level_up: user.last_level_up || undefined,
    };

    return NextResponse.json({
      authenticated: true,
      user: userData,
    });
  } catch (error) {
    console.error("Error in /api/auth/me:", error);
    return NextResponse.json(
      { authenticated: false, user: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
