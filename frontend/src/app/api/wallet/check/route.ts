import { NextRequest, NextResponse } from "next/server";
import { solviumWalletAPI, getWalletInfo, SolviumAPIError } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { telegram_user_id, force_refresh } = body;

    // Validate input
    if (!telegram_user_id || typeof telegram_user_id !== "number") {
      return NextResponse.json(
        {
          has_wallet: false,
          error: "Invalid telegram_user_id. Must be a number.",
        },
        { status: 400 }
      );
    }

    // Check if the user ID is reasonable (positive integer)
    if (telegram_user_id <= 0 || !Number.isInteger(telegram_user_id)) {
      return NextResponse.json(
        {
          has_wallet: false,
          error: "Invalid telegram_user_id. Must be a positive integer.",
        },
        { status: 400 }
      );
    }

    console.log(
      `[API] Checking wallet for Telegram user: ${telegram_user_id}${
        force_refresh ? " (force refresh)" : ""
      }`
    );

    // Use the secure API client to check wallet information with caching
    const walletInfo = await getWalletInfo(
      telegram_user_id,
      force_refresh || false
    );

    console.log("walletInfo", walletInfo);
    if (!walletInfo) {
      console.log("walletInfo", walletInfo);
      return NextResponse.json(
        {
          has_wallet: false,
          error:
            "Unable to retrieve wallet information. API may be unavailable or wallet not found.",
        },
        { status: 404 }
      );
    }

    // Return the wallet information
    return NextResponse.json(walletInfo);
  } catch (error) {
    console.error("[API] Error checking wallet:", error);

    // Handle specific API errors
    if (error instanceof SolviumAPIError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.status || 500 }
      );
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
        },
        { status: 400 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error occurred while checking wallet",
      },
      { status: 500 }
    );
  }
}

// Also support GET method for health checks
export async function GET() {
  try {
    const isHealthy = await solviumWalletAPI.checkHealth();

    return NextResponse.json({
      success: true,
      status: isHealthy ? "healthy" : "unhealthy",
      message: isHealthy
        ? "SolviumAI API is running"
        : "SolviumAI API is not responding",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Health check error:", error);

    return NextResponse.json(
      {
        success: false,
        status: "error",
        error: "Failed to check API health",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
