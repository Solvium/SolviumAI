import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData, user } = body;

    // Validate Telegram Web App data
    if (!user || !user.id || !user.username) {
      return NextResponse.json(
        { error: "Invalid Telegram user data" },
        { status: 400 }
      );
    }

    // Create or update user in database
    const userData = {
      id: user.id.toString(),
      username: user.username,
      telegramId: user.id.toString(),
      firstName: user.first_name,
      lastName: user.last_name,
      avatar: user.photo_url,
      totalPoints: 0,
      multiplier: 1,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    // Set authentication cookie
    const cookieStore = cookies();
    cookieStore.set("auth_token", userData.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return NextResponse.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error("Telegram auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
