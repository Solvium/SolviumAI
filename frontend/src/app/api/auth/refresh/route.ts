import { NextRequest, NextResponse } from "next/server";
import { SessionManager } from "@/lib/auth/session";
import { JWTService } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;
    const sessionId = request.cookies.get('session_id')?.value;

    if (!refreshToken || !sessionId) {
      return NextResponse.json(
        { error: "Refresh token not found" },
        { status: 401 }
      );
    }

    // Verify refresh token
    const payload = JWTService.verifyRefreshToken(refreshToken);
    
    // Check if session exists and is active
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: parseInt(payload.userId),
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Generate new access token
    const user = await prisma.user.findUnique({
      where: { id: parseInt(payload.userId) },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    const newAccessToken = JWTService.generateAccessToken({
      id: user.id.toString(),
      username: user.username,
      email: user.email,
    } as any);

    // Create response with new access token
    const response = NextResponse.json({
      success: true,
      accessToken: newAccessToken,
    });

    // Set new access token cookie
    response.cookies.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes
    });

    return response;
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Token refresh failed" },
      { status: 401 }
    );
  }
} 