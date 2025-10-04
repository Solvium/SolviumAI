import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_token } = body as { access_token?: string };

    if (!access_token) {
      return NextResponse.json(
        { error: "Google access_token is required" },
        { status: 400 }
      );
    }

    // Fetch Google userinfo using the access token
    const userinfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        // Prevent Next from caching
        cache: "no-store",
      }
    );

    if (!userinfoRes.ok) {
      const err = await userinfoRes.text();
      return NextResponse.json(
        { error: `Failed to fetch Google userinfo: ${err}` },
        { status: 401 }
      );
    }

    const profile = (await userinfoRes.json()) as {
      sub: string;
      email?: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
    };

    // Debug logging for Google profile data
    console.log("Google profile data from API:", {
      sub: profile.sub,
      email: profile.email,
      picture: profile.picture,
      given_name: profile.given_name,
      family_name: profile.family_name,
    });

    if (!profile?.sub) {
      return NextResponse.json(
        { error: "Invalid Google userinfo" },
        { status: 400 }
      );
    }

    // Find or create user
    let user = profile.email
      ? await prisma.user.findUnique({ where: { email: profile.email } })
      : null;

    if (!user) {
      user = await prisma.user.create({
        data: {
          username: (profile.email || `google_${profile.sub}`).split("@")[0],
          email: profile.email || null,
          name: `${profile.given_name || ""} ${
            profile.family_name || ""
          }`.trim(),
          avatar_url: profile.picture || null, // Google profile picture
          referredBy: "",
          level: 1,
          difficulty: 1,
          puzzleCount: 1,
          referralCount: 0,
          spinCount: 0,
          dailySpinCount: 0,
          claimCount: 0,
          lastSpinClaim: new Date(),
          totalPoints: 0,
          isOfficial: false,
          isMining: false,
          isPremium: false,
          lastClaim: new Date(),
          weeklyPoints: 0,
        },
      });
    } else {
      // Update existing user's avatar with latest Google profile picture
      if (profile.picture) {
        console.log("Updating existing user avatar via access token:", {
          userId: user.id,
          currentAvatar: user.avatar_url,
          newAvatar: profile.picture,
        });
        user = await prisma.user.update({
          where: { id: user.id },
          data: { avatar_url: profile.picture },
        });
        console.log("User avatar updated successfully via access token");
      }
    }

    let walletData: any = null;
    if (user.wallet) {
      try {
        walletData =
          typeof user.wallet === "string"
            ? JSON.parse(user.wallet)
            : user.wallet;
      } catch {}
    }

    const userData = {
      id: user.id.toString(),
      username: user.username,
      email: user.email || undefined,
      telegramId: undefined,
      googleId: profile.sub,
      firstName: profile.given_name,
      lastName: profile.family_name,
      avatar: profile.picture,
      totalPoints: user.totalPoints || 0,
      multiplier: 1,
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
      createdAt: new Date(),
      lastLoginAt: new Date(),
      lastSpinClaim: user.lastSpinClaim || undefined,
      lastClaim: user.lastClaim || undefined,
      chatId: user.chatId || undefined,
      wallet: walletData,
    };

    const response = NextResponse.json({ success: true, user: userData });
    response.cookies.set("auth_token", userData.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    console.error("Google access auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed - please try again" },
      { status: 500 }
    );
  }
}
