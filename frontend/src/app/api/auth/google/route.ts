import { NextRequest, NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credential } = body;

    if (!credential) {
      return NextResponse.json(
        { error: "Google credential is required" },
        { status: 400 }
      );
    }

    // Decode the JWT token from Google
    let decoded: any;
    try {
      decoded = jwtDecode(credential);
    } catch (error) {
      console.error("Failed to decode Google token:", error);
      return NextResponse.json(
        { error: "Invalid Google token format" },
        { status: 400 }
      );
    }

    // Validate the token
    if (!decoded.email || !decoded.sub) {
      return NextResponse.json(
        { error: "Invalid Google token - missing required fields" },
        { status: 400 }
      );
    }

    // Check if user already exists in database
    let user = await prisma.user.findUnique({
      where: { email: decoded.email },
    });

    if (!user) {
      // Create new user in database
      user = await prisma.user.create({
        data: {
          username: decoded.email.split("@")[0],
          email: decoded.email,
          name: `${decoded.given_name || ""} ${
            decoded.family_name || ""
          }`.trim(),
          referredBy: "", // Default empty value
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

      console.log("New user created:", user.email);
    } else {
      console.log("Existing user logged in:", user.email);
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

    // Create complete user data for response
    const userData = {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      telegramId: undefined, // Not available for Google auth
      googleId: decoded.sub,
      firstName: decoded.given_name,
      lastName: decoded.family_name,
      avatar: decoded.picture,
      totalPoints: user.totalPoints || 0,
      multiplier: 1, // Default multiplier
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
      lastLoginAt: new Date(),
      lastSpinClaim: user.lastSpinClaim || undefined,
      lastClaim: user.lastClaim || undefined,
      chatId: user.chatId || undefined,
      wallet: walletData, // Include parsed wallet data
    };

    console.log("Complete user data from Google auth:", userData);

    // Create response with simple cookie (without JWT for now)
    const response = NextResponse.json({
      success: true,
      user: userData,
    });

    // Set a simple auth cookie (root path for all routes)
    response.cookies.set("auth_token", userData.id, {
      httpOnly: true,
      secure: true, // required for SameSite=None
      sameSite: "none", // works in embedded webviews/iframes
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Google auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed - please try again" },
      { status: 500 }
    );
  }
}
