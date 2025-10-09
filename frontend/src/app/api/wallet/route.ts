import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWalletInfo } from "@/lib/crypto";
import {
  canMakeNearblocksRequest,
  getTimeUntilNextNearblocksRequest,
  getRemainingNearblocksRequests,
  canMakeRpcRequest,
  getTimeUntilNextRpcRequest,
  getRemainingRpcRequests,
} from "@/lib/rateLimiter";

// Price API
const DEXSCREENER_URL =
  "https://api.dexscreener.com/latest/dex/tokens/wrap.near";

// External API URLs
const NEARBLOCKS_BASE_URL = "https://api.nearblocks.io";
const FASTNEAR_BASE_URL = "https://api.fastnear.com";

// NEAR RPC URLs
const RPC_URLS: Record<string, string> = {
  mainnet: "https://rpc.mainnet.near.org",
  testnet: "https://rpc.testnet.near.org",
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const account = searchParams.get("account");
    const telegramUserId = searchParams.get("telegramUserId");

    // Handle wallet check
    if (action === "check") {
      if (!telegramUserId) {
        return NextResponse.json(
          { error: "telegramUserId is required for wallet check" },
          { status: 400 }
        );
      }

      const walletCache = await prisma.walletCache.findUnique({
        where: {
          telegramUserId: parseInt(telegramUserId),
        },
      });

      if (!walletCache) {
        return NextResponse.json(
          { error: "Wallet not found in cache" },
          { status: 404 }
        );
      }

      // Check if cache is expired
      const now = new Date();
      if (walletCache.expiresAt < now) {
        await prisma.walletCache.delete({
          where: { id: walletCache.id },
        });
        return NextResponse.json(
          { error: "Wallet cache expired" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        has_wallet: true,
        message: "Wallet found in cache",
        wallet_info: {
          account_id: walletCache.accountId,
          private_key: walletCache.encryptedPrivateKey,
          public_key: walletCache.publicKey,
          is_demo: walletCache.isDemo,
          network: walletCache.network,
          last_updated: walletCache.lastUpdated,
          expires_at: walletCache.expiresAt,
        },
      });
    }

    // Handle price check
    if (action === "price") {
      try {
        const res = await fetch(DEXSCREENER_URL, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        if (!res.ok) {
          return NextResponse.json(
            { error: "dexscreener_failed" },
            { status: 502 }
          );
        }

        const data = await res.json();
        const pairs: any[] = Array.isArray((data as any)?.pairs)
          ? (data as any).pairs
          : [];
        const withUsd = pairs.find((p) => p?.priceUsd) || pairs[0];
        const priceUsd = withUsd?.priceUsd ? Number(withUsd.priceUsd) : null;

        if (!priceUsd) {
          return NextResponse.json(
            { error: "price_not_found" },
            { status: 404 }
          );
        }

        return NextResponse.json({ priceUsd });
      } catch (e) {
        return NextResponse.json({ error: "unexpected" }, { status: 500 });
      }
    }

    // Handle nearblocks account info
    if (action === "nearblocks-info" && account) {
      // Check rate limit
      if (!canMakeNearblocksRequest()) {
        const timeUntilReset = getTimeUntilNextNearblocksRequest();
        const remaining = getRemainingNearblocksRequests();
        console.log(
          `[nearblocks-info] Rate limited. Remaining: ${remaining}, Reset in: ${Math.ceil(
            timeUntilReset / 1000
          )}s`
        );

        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            message: `Too many requests. Try again in ${Math.ceil(
              timeUntilReset / 1000
            )} seconds.`,
            remaining,
            resetIn: Math.ceil(timeUntilReset / 1000),
          },
          { status: 429 }
        );
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      const apiKey = "FBF3C110E7A844FA84ADC1DA823C6484"; // Provided API key
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const upstream = await fetch(
        `${NEARBLOCKS_BASE_URL}/v1/account/${encodeURIComponent(account)}`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );
      const bodyText = await upstream.text();
      const remaining = getRemainingNearblocksRequests();
      console.log(
        "[nearblocks-info] account=",
        account,
        "status=",
        upstream.status,
        "len=",
        bodyText.length,
        "remaining=",
        remaining
      );
      return new Response(bodyText, {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") || "application/json",
        },
      });
    }

    // Handle rate limit status
    if (action === "rate-limit-status") {
      const remaining = getRemainingNearblocksRequests();
      const resetIn = getTimeUntilNextNearblocksRequest();

      return NextResponse.json({
        remaining,
        resetIn: Math.ceil(resetIn / 1000), // Convert to seconds
        maxRequests: 6,
        windowMs: 60000, // 1 minute
      });
    }

    // Handle nearblocks account transactions
    if (action === "nearblocks-txns" && account) {
      // Check rate limit
      if (!canMakeNearblocksRequest()) {
        const timeUntilReset = getTimeUntilNextNearblocksRequest();
        const remaining = getRemainingNearblocksRequests();
        console.log(
          `[nearblocks-txns] Rate limited. Remaining: ${remaining}, Reset in: ${Math.ceil(
            timeUntilReset / 1000
          )}s`
        );

        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            message: `Too many requests. Try again in ${Math.ceil(
              timeUntilReset / 1000
            )} seconds.`,
            remaining,
            resetIn: Math.ceil(timeUntilReset / 1000),
          },
          { status: 429 }
        );
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      const apiKey = "FBF3C110E7A844FA84ADC1DA823C6484"; // Provided API key
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const upstream = await fetch(
        `${NEARBLOCKS_BASE_URL}/v1/account/${encodeURIComponent(account)}/txns`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );
      const bodyText = await upstream.text();
      const remaining = getRemainingNearblocksRequests();
      console.log(
        "[nearblocks-txns] account=",
        account,
        "status=",
        upstream.status,
        "len=",
        bodyText.length,
        "remaining=",
        remaining
      );
      return new Response(bodyText, {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") || "application/json",
        },
      });
    }

    // Handle fastnear account full
    if (action === "fastnear-full" && account) {
      const search = req.nextUrl.search;
      const upstream = await fetch(
        `${FASTNEAR_BASE_URL}/v1/account/${encodeURIComponent(
          account
        )}/full${search}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        }
      );
      const bodyText = await upstream.text();
      console.log(
        "[fastnear-full] account=",
        account,
        "status=",
        upstream.status,
        "len=",
        bodyText.length
      );
      return new Response(bodyText, {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") || "application/json",
        },
      });
    }

    // Handle fastnear explorer account
    if (action === "fastnear-explorer-account") {
      const upstream = await fetch(`${FASTNEAR_BASE_URL}/v1/explorer/account`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const bodyText = await upstream.text();
      console.log(
        "[fastnear-explorer-account][GET] status=",
        upstream.status,
        "len=",
        bodyText.length
      );
      return new Response(bodyText, {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") || "application/json",
        },
      });
    }

    // Handle fastnear explorer transactions
    if (action === "fastnear-explorer-txns") {
      const upstream = await fetch(
        `${FASTNEAR_BASE_URL}/v1/explorer/transactions`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        }
      );

      return new Response(await upstream.text(), {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") || "application/json",
        },
      });
    }

    return NextResponse.json(
      {
        error:
          "Invalid action. Supported actions: check, price, nearblocks-info, nearblocks-txns, fastnear-full, fastnear-explorer-account, fastnear-explorer-txns, rate-limit-status",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Wallet API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // Handle near-rpc proxy
    if (action === "near-rpc") {
      // Check RPC rate limit
      if (!canMakeRpcRequest()) {
        const timeUntilReset = getTimeUntilNextRpcRequest();
        const remaining = getRemainingRpcRequests();
        console.log(
          `[near-rpc] Rate limited. Remaining: ${remaining}, Reset in: ${Math.ceil(
            timeUntilReset / 1000
          )}s`
        );

        return NextResponse.json(
          {
            error: "RPC rate limit exceeded",
            message: `Too many RPC requests. Try again in ${Math.ceil(
              timeUntilReset / 1000
            )} seconds.`,
            remaining,
            resetIn: Math.ceil(timeUntilReset / 1000),
          },
          { status: 429 }
        );
      }

      const network =
        searchParams.get("network") ||
        process.env.NEXT_PUBLIC_NEAR_NETWORK_ID ||
        "mainnet";
      const target = RPC_URLS[network.toLowerCase()] || RPC_URLS.mainnet;

      const body = await req.text();

      try {
        const upstream = await fetch(target, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body,
          cache: "no-store",
        });

        const remaining = getRemainingRpcRequests();
        console.log(`[near-rpc] Request completed. Remaining: ${remaining}`);

        return new Response(await upstream.text(), {
          status: upstream.status,
          headers: {
            "Content-Type":
              upstream.headers.get("content-type") || "application/json",
          },
        });
      } catch (error) {
        console.error("RPC proxy error:", error);
        return NextResponse.json(
          { error: "RPC proxy failed" },
          { status: 502 }
        );
      }
    }

    // Handle fastnear explorer account (POST body)
    if (action === "fastnear-explorer-account") {
      const payloadText = await req.text();
      console.log("[fastnear-explorer-account][POST] payload=", payloadText);
      const upstream = await fetch(`${FASTNEAR_BASE_URL}/v1/explorer/account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: payloadText,
        cache: "no-store",
      });
      const bodyText = await upstream.text();
      console.log(
        "[fastnear-explorer-account][POST] status=",
        upstream.status,
        "len=",
        bodyText.length,
        "preview=",
        bodyText.slice(0, 200)
      );
      return new Response(bodyText, {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") || "application/json",
        },
      });
    }

    // Handle wallet check (default behavior)
    const body = await req.json();
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

    // First try external wallet API via crypto client if configured

    try {
      const result = await getWalletInfo(telegram_user_id);
      if (result?.has_wallet && result.wallet_info) {
        return NextResponse.json({
          has_wallet: true,
          message: result.message || "Wallet found",
          wallet_info: result.wallet_info,
        });
      }
    } catch (e) {
      console.error("Error checking wallet:", e);
      // Fall back to local cache if external fails
    }

    // Fallback: Check wallet in local WalletCache
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
        private_key: walletCache.encryptedPrivateKey,
        public_key: walletCache.publicKey,
        is_demo: walletCache.isDemo,
        network: walletCache.network,
        last_updated: walletCache.lastUpdated,
        expires_at: walletCache.expiresAt,
      },
    };

    return NextResponse.json(walletInfo);
  } catch (error) {
    console.error("Wallet API error:", error);

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
