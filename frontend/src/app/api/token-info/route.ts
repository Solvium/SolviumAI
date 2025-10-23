import { NextRequest, NextResponse } from "next/server";
import {
  fetchTokenFromDexScreener,
  hasSufficientLiquidity,
  getTokenMetadataFromDexScreener,
} from "@/lib/dexscreener";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tokenAddress = searchParams.get("address");

    if (!tokenAddress) {
      return NextResponse.json(
        { error: "missing_address", message: "Token address is required" },
        { status: 400 }
      );
    }

    // Validate token address format
    if (!tokenAddress.match(/^[a-zA-Z0-9._-]+$/)) {
      return NextResponse.json(
        { error: "invalid_address", message: "Invalid token address format" },
        { status: 400 }
      );
    }

    console.log(`Fetching token info for: ${tokenAddress}`);

    // Fetch token data from DexScreener
    const tokenData = await fetchTokenFromDexScreener(tokenAddress);

    if (!tokenData) {
      return NextResponse.json(
        {
          error: "token_not_found",
          message: "Token not found or no liquidity available on NEAR",
        },
        { status: 404 }
      );
    }

    // Check if token has sufficient liquidity
    const hasLiquidity = hasSufficientLiquidity(tokenData, 1000); // $1000 minimum

    if (!hasLiquidity) {
      return NextResponse.json(
        {
          error: "insufficient_liquidity",
          message: `Token has insufficient liquidity ($${tokenData.liquidity.usd.toFixed(
            2
          )}). Minimum $1000 required.`,
          tokenData: getTokenMetadataFromDexScreener(tokenData),
        },
        { status: 400 }
      );
    }

    // Return successful token data
    const tokenMetadata = getTokenMetadataFromDexScreener(tokenData);

    return NextResponse.json({
      success: true,
      token: tokenMetadata,
      liquidity: {
        usd: tokenData.liquidity.usd,
        base: tokenData.liquidity.base,
        quote: tokenData.liquidity.quote,
      },
      volume: {
        h24: tokenData.volume.h24,
      },
      priceChange: {
        h24: tokenData.priceChange.h24,
      },
      pairInfo: {
        dexId: tokenData.dexId,
        pairAddress: tokenData.pairAddress,
        url: tokenData.url,
      },
    });
  } catch (error) {
    console.error("[token-info][GET] error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to fetch token information" },
      { status: 500 }
    );
  }
}
