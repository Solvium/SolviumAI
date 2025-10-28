import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWalletInfo } from "@/lib/crypto";
import { getOrCreateUserFromMiniApp } from "@/lib/miniAppApi";
import { cookies } from "next/headers";
import { JWTService } from "@/lib/auth/jwt";
import {
  canMakeNearblocksRequest,
  getTimeUntilNextNearblocksRequest,
  getRemainingNearblocksRequests,
} from "@/lib/rateLimiter";

// Price API base
const DEXSCREENER_TOKEN_BASE = "https://api.dexscreener.com/latest/dex/tokens";

// External API URLs
const NEARBLOCKS_BASE_URL = "https://api.nearblocks.io";
const FASTNEAR_BASE_URL = "https://api.fastnear.com";

// Intea RPC API Key
const INTEA_API_KEY =
  process.env.INTEA_API_KEY ||
  "TEMP648WSeY9y1XDyiAHL2KMbZxxnn3Tq4Dxggdd3eGniSy2";

// NEAR RPC URLs using Intea RPC only
const RPC_URLS: Record<string, string> = {
  mainnet: "https://rpc.intea.rs",
  testnet: "https://rpc.intea.rs",
};

// Request counter for debugging
let requestCount = 0;

// Helper function to get authenticated user from session
async function getAuthenticatedUser() {
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
    } catch (e) {
      userId = null;
    }
  }

  // Fallback to legacy token if JWT fails
  if (!userId && legacyToken) {
    try {
      const uid = parseInt(legacyToken.value);
      userId = Number.isNaN(uid) ? null : uid;
    } catch (e) {
      userId = null;
    }
  }

  if (!userId) {
    return null;
  }

  // Get user data from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      chatId: true,
      username: true,
      name: true,
    },
  });

  return user;
}

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

    // Handle price check (optional token address via ?token=<nep141_id>)
    if (action === "price") {
      try {
        const token = (searchParams.get("token") || "wrap.near").trim();
        const url = `${DEXSCREENER_TOKEN_BASE}/${encodeURIComponent(token)}`;
        const res = await fetch(url, {
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
      // Rate limiting disabled - always allow requests

      const headers: Record<string, string> = { Accept: "application/json" };
      const apiKey = "FBF3C110E7A844FA84ADC1DA823C6484"; // Provided API key
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      console.log(
        `[nearblocks-info] Making request to NearBlocks API for account: ${account}`
      );
      console.log(`[nearblocks-info] Using API key: ${apiKey ? "Yes" : "No"}`);
      console.log(`[nearblocks-info] Headers:`, headers);

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

      // Log response headers for debugging
      console.log(
        `[nearblocks-info] Response headers:`,
        Object.fromEntries(upstream.headers.entries())
      );

      // If 429, log the response body
      if (upstream.status === 429) {
        console.error(`[nearblocks-info] 429 Response body:`, bodyText);
      }
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
      // Rate limiting disabled - always allow requests

      const headers: Record<string, string> = { Accept: "application/json" };
      const apiKey = "FBF3C110E7A844FA84ADC1DA823C6484"; // Provided API key
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      // Forward selected query params to upstream (per_page, order, page, from, to)
      const params = new URLSearchParams();
      const perPage = searchParams.get("per_page");
      const order = searchParams.get("order");
      const page = searchParams.get("page");
      const from = searchParams.get("from");
      const to = searchParams.get("to");
      if (perPage) params.set("per_page", perPage);
      if (order) params.set("order", order);
      if (page) params.set("page", page);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const url = `${NEARBLOCKS_BASE_URL}/v1/account/${encodeURIComponent(
        account
      )}/txns${params.toString() ? `?${params.toString()}` : ""}`;

      const upstream = await fetch(url, {
        method: "GET",
        headers,
        cache: "no-store",
      });
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

    // Handle nearblocks account inventory (tokens/NFTs)
    if (action === "nearblocks-inventory" && account) {
      // Rate limiting disabled - always allow requests

      const headers: Record<string, string> = { Accept: "application/json" };
      const apiKey =
        process.env.NEARBLOCKS_API_KEY || "FBF3C110E7A844FA84ADC1DA823C6484";
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const upstream = await fetch(
        `${NEARBLOCKS_BASE_URL}/v1/account/${encodeURIComponent(
          account
        )}/inventory`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );
      const bodyText = await upstream.text();
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

    // Handle mini app get-or-create
    if (action === "mini-app-get-or-create") {
      const telegramUserId = searchParams.get("telegram_user_id");
      const username = searchParams.get("username");
      const firstName = searchParams.get("first_name");

      if (!telegramUserId || !username || !firstName) {
        return NextResponse.json(
          {
            error: "Missing required parameters",
            message: "telegram_user_id, username, and first_name are required",
          },
          { status: 400 }
        );
      }

      try {
        const response = await getOrCreateUserFromMiniApp({
          telegram_user_id: parseInt(telegramUserId),
          username,
          first_name: firstName,
        });

        if (!response) {
          return NextResponse.json(
            {
              error: "Failed to get or create user",
              message: "Mini app API returned null response",
            },
            { status: 500 }
          );
        }

        return NextResponse.json(response);
      } catch (error) {
        console.error("Mini app API error:", error);
        return NextResponse.json(
          {
            error: "Mini app API error",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "Invalid action. Supported actions: check, price, nearblocks-info, nearblocks-txns, fastnear-full, fastnear-explorer-account, fastnear-explorer-txns, rate-limit-status, mini-app-get-or-create",
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
      const network =
        searchParams.get("network") ||
        process.env.NEXT_PUBLIC_NEAR_NETWORK_ID ||
        "mainnet";
      const target = RPC_URLS[network.toLowerCase()] || RPC_URLS.mainnet;

      // Increment request counter
      requestCount++;

      // Log RPC usage
      console.log(
        `[RPC] Request #${requestCount} - Using Intea RPC endpoint: ${target} for network: ${network}`
      );
      console.log(`[RPC] API Key configured: ${INTEA_API_KEY ? "Yes" : "No"}`);
      console.log(
        `[RPC] API Key length: ${INTEA_API_KEY ? INTEA_API_KEY.length : 0}`
      );
      console.log(
        `[RPC] API Key prefix: ${
          INTEA_API_KEY ? INTEA_API_KEY.substring(0, 8) + "..." : "None"
        }`
      );

      const body = await req.text();

      // Parse and log the RPC method being called
      try {
        const rpcRequest = JSON.parse(body);
        console.log(`[RPC] Method: ${rpcRequest.method || "unknown"}`);
        console.log(`[RPC] Request ID: ${rpcRequest.id || "unknown"}`);
        if (rpcRequest.params) {
          console.log(
            `[RPC] Params:`,
            JSON.stringify(rpcRequest.params, null, 2)
          );
        }
      } catch (e) {
        console.log(
          `[RPC] Could not parse request body:`,
          body.substring(0, 200)
        );
      }

      try {
        // Try with Bearer token first
        console.log(`[RPC] Trying with Bearer token authentication`);

        let upstream = await fetch(target, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${INTEA_API_KEY}`,
          },
          body,
          cache: "no-store",
        });

        // If 401/403, try without authentication
        if (upstream.status === 401 || upstream.status === 403) {
          console.log(
            `[RPC] Bearer token failed (${upstream.status}), trying without authentication`
          );
          upstream = await fetch(target, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body,
            cache: "no-store",
          });
        }

        console.log(`[RPC] Response status: ${upstream.status} from ${target}`);

        // Handle rate limiting specifically
        if (upstream.status === 429) {
          console.error(`[RPC] Rate limit exceeded (429) for ${target}`);
          console.error(
            `[RPC] Response headers:`,
            Object.fromEntries(upstream.headers.entries())
          );

          // Log the response body to see what the RPC provider says
          const responseText = await upstream.text();
          console.error(`[RPC] 429 Response body:`, responseText);

          return NextResponse.json(
            {
              error: "Rate limit exceeded",
              message:
                "Too many requests to RPC endpoint. Please try again later.",
              status: 429,
            },
            { status: 429 }
          );
        }

        const responseText = await upstream.text();
        console.log(`[RPC] Response length: ${responseText.length} characters`);

        return new Response(responseText, {
          status: upstream.status,
          headers: {
            "Content-Type":
              upstream.headers.get("content-type") || "application/json",
          },
        });
      } catch (error) {
        console.error(`[RPC] Proxy error for ${target}:`, error);
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

    // Handle mini app get-or-create (POST) - Get user from authenticated session
    if (action === "mini-app-get-or-create") {
      const user = await getAuthenticatedUser();

      if (!user) {
        return NextResponse.json(
          {
            error: "User not authenticated",
            message: "User must be logged in to create wallet",
          },
          { status: 401 }
        );
      }

      if (!user.chatId) {
        return NextResponse.json(
          {
            error: "No Telegram ID found",
            message: "User must have a Telegram ID to create wallet",
          },
          { status: 400 }
        );
      }

      const telegram_user_id = parseInt(user.chatId);
      if (isNaN(telegram_user_id)) {
        return NextResponse.json(
          {
            error: "Invalid Telegram ID format",
            message: "User's Telegram ID is not valid",
          },
          { status: 400 }
        );
      }

      try {
        const response = await getOrCreateUserFromMiniApp({
          telegram_user_id: telegram_user_id,
          username: user.username || `user_${telegram_user_id}`,
          first_name: user.name ? user.name.split(" ")[0] : "User",
        });

        if (!response) {
          return NextResponse.json(
            {
              error: "Failed to get or create user",
              message: "Mini app API returned null response",
            },
            { status: 500 }
          );
        }

        return NextResponse.json(response);
      } catch (error) {
        console.error("Mini app API error:", error);
        return NextResponse.json(
          {
            error: "Mini app API error",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 500 }
        );
      }
    }

    // Handle wallet check (default behavior) - Get user from authenticated session
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          has_wallet: false,
          error: "User not authenticated",
        },
        { status: 401 }
      );
    }

    if (!user.chatId) {
      return NextResponse.json(
        {
          has_wallet: false,
          error: "No Telegram ID found for user",
        },
        { status: 400 }
      );
    }

    const telegram_user_id = parseInt(user.chatId);
    if (isNaN(telegram_user_id)) {
      return NextResponse.json(
        {
          has_wallet: false,
          error: "Invalid Telegram ID format",
        },
        { status: 400 }
      );
    }

    // Parse optional force_refresh from body if provided
    let force_refresh = false;
    try {
      const body = await req.json();
      force_refresh = body.force_refresh || false;
    } catch (e) {
      // Body is optional, continue without it
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
