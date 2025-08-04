import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionManager } from "@/lib/auth/session";
import { JWTService } from "@/lib/auth/jwt";
import { jwtDecode } from "jwt-decode";

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

    // Check if user exists or create new user
    let dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: decoded.email },
          { username: decoded.email.split("@")[0] },
        ],
      },
    });

    if (!dbUser) {
      // Create new user
      dbUser = await prisma.user.create({
        data: {
          username: decoded.email.split("@")[0],
          name: `${decoded.given_name || ""} ${
            decoded.family_name || ""
          }`.trim(),
          email: decoded.email,
          referredBy: "google",
          totalPoints: 0,
          multiplier: 1,
          level: 1,
          difficulty: 1,
          puzzleCount: 1,
          referralCount: 0,
          spinCount: 0,
          dailySpinCount: 0,
          claimCount: 0,
          isOfficial: false,
          isMining: false,
          isPremium: false,
        },
      });
    } else {
      // Update last login
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { lastClaim: new Date() },
      });
    }

    // Create or update login method
    try {
      await prisma.loginMethod.upsert({
        where: {
          type_value: {
            type: "google",
            value: decoded.sub,
          },
        },
        update: {},
        create: {
          type: "google",
          value: decoded.sub,
          userId: dbUser.id,
        },
      });
    } catch (error) {
      console.error("Failed to upsert login method:", error);
      // Continue anyway - this is not critical
    }

    // Create secure session
    const sessionData = await SessionManager.createSession(
      dbUser.id.toString()
    );

    // Prepare user data for response
    const userData = {
      id: dbUser.id.toString(),
      username: dbUser.username,
      email: decoded.email,
      googleId: decoded.sub,
      firstName: decoded.given_name,
      lastName: decoded.family_name,
      avatar: decoded.picture,
      totalPoints: dbUser.totalPoints,
      multiplier: dbUser.multiplier,
      level: dbUser.level,
      createdAt: dbUser.createdAt,
      lastLoginAt: new Date(),
      lastSpinClaim: dbUser.lastSpinClaim,
      dailySpinCount: dbUser.dailySpinCount,
    };

    // Create response with secure cookies
    const response = NextResponse.json({
      success: true,
      user: userData,
    });

    // Set secure session cookies
    SessionManager.setSessionCookies(response, sessionData);

    return response;
  } catch (error) {
    console.error("Google auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed - please try again" },
      { status: 500 }
    );
  }
}
