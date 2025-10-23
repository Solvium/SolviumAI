export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  buildRefInstantSwapTransactions,
  buildRefInstantSwapTransactionsNoInit,
  ensureRefEnv,
  initRefEnvWithNodeUrl,
  validateFtIds,
} from "@/lib/ref";
import { REF_NODE_URL } from "@/config/ref";

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    let payload: any = {};
    try {
      payload = bodyText ? JSON.parse(bodyText) : {};
    } catch (e) {
      return NextResponse.json(
        { error: "invalid_json", message: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    const {
      tokenInId,
      tokenOutId,
      amountInHuman,
      slippageBps,
      accountId,
      referralId,
    } = payload || {};

    if (!tokenInId || !tokenOutId || !amountInHuman || !accountId) {
      return NextResponse.json(
        {
          error: "missing_params",
          message:
            "tokenInId, tokenOutId, amountInHuman and accountId are required",
        },
        { status: 400 }
      );
    }

    // Force FastNear node URL if provided
    const preferNode = REF_NODE_URL;
    if (preferNode) {
      await initRefEnvWithNodeUrl(preferNode);
    } else {
      await ensureRefEnv();
    }
    let txs: any;
    let swapTodos: any;

    // Validate tokens exist before building transactions to avoid opaque SDK errors
    try {
      await validateFtIds(tokenInId, tokenOutId);
    } catch (e: any) {
      const code = e?.code || "invalid_token";
      const details = e?.details || {};
      return NextResponse.json(
        {
          error: code,
          message:
            code === "token_in_not_exist"
              ? `Input token does not exist: ${details.id}`
              : code === "token_out_not_exist"
              ? `Output token does not exist: ${details.id}`
              : "Invalid token provided",
        },
        { status: 400 }
      );
    }
    try {
      const r = preferNode
        ? await buildRefInstantSwapTransactionsNoInit({
            tokenInId,
            tokenOutId,
            amountInHuman,
            slippageBps: typeof slippageBps === "number" ? slippageBps : 200, // 2% default - more protective
            accountId,
            referralId,
          })
        : await buildRefInstantSwapTransactions({
            tokenInId,
            tokenOutId,
            amountInHuman,
            slippageBps: typeof slippageBps === "number" ? slippageBps : 200, // 2% default - more protective
            accountId,
            referralId,
          });
      txs = r.txs;
      swapTodos = r.swapTodos;
    } catch (e) {
      const env = (
        process.env.NEXT_PUBLIC_REF_ENV ||
        process.env.NEAR_ENV ||
        "mainnet"
      ).toLowerCase();
      const apiKey =
        process.env.FASTNEAR_API_KEY ||
        process.env.NEXT_PUBLIC_FASTNEAR_API_KEY ||
        "";
      const fallbacks = ["https://rpc.intea.rs"];
      let lastErr = e;
      for (const url of fallbacks) {
        try {
          await initRefEnvWithNodeUrl(url);
          const r = await buildRefInstantSwapTransactionsNoInit({
            tokenInId,
            tokenOutId,
            amountInHuman,
            slippageBps: typeof slippageBps === "number" ? slippageBps : 200, // 2% default - more protective
            accountId,
            referralId,
          });
          txs = r.txs;
          swapTodos = r.swapTodos;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!txs) throw lastErr;
    }

    return NextResponse.json({ txs, swapTodos });
  } catch (error) {
    console.error("[ref-swap][POST] error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to build swap transactions" },
      { status: 500 }
    );
  }
}
