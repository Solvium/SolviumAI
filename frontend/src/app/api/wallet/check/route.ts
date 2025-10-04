import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { telegram_user_id, force_refresh } = body;

    // Validate input
    if (!telegram_user_id || !Number.isInteger(telegram_user_id)) {
      return NextResponse.json(
        {
          has_wallet: false,
          error: "Invalid telegram_user_id. Must be a number.",
        },
        { status: 400 }
      );
    }

    // Check wallet in local WalletCache
    const walletCache = await prisma.walletCache.findUnique({
      where: {
        telegramUserId: telegram_user_id,
      },
    });

    if (!walletCache) {
      return NextResponse.json(
        {
          has_wallet: false,
          error: "Wallet not found in cache",
        },
        { status: 404 }
      );
    }

    // Check if cache is expired
    const now = new Date();
    if (walletCache.expiresAt < now) {
      // Cache expired, remove it
      await prisma.walletCache.delete({
        where: {
          id: walletCache.id,
        },
      });

      return NextResponse.json(
        {
          has_wallet: false,
          error: "Wallet cache expired",
        },
        { status: 404 }
      );
    }

    // Return the wallet information
    const walletInfo = {
      has_wallet: true,
      message: "Wallet found in cache",
      wallet_info: {
        account_id: walletCache.accountId,
        public_key: walletCache.publicKey,
        is_demo: walletCache.isDemo,
        network: walletCache.network,
        last_updated: walletCache.lastUpdated,
        expires_at: walletCache.expiresAt,
      },
    };

    return NextResponse.json(walletInfo);
  } catch (error) {
    console.error("[API] Error checking wallet:", error);

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
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    const isHealthy = true;

    return NextResponse.json({
      success: true,
      status: isHealthy ? "healthy" : "unhealthy",
      message: isHealthy
        ? "Wallet cache system is running"
        : "Wallet cache system is not responding",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Health check error:", error);

    return NextResponse.json(
      {
        success: false,
        status: "error",
        error: "Failed to check database connection",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
