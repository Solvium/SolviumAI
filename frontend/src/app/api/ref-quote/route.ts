export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  ensureRefEnv,
  initRefEnvWithNodeUrl,
  refQuoteSimple,
  refQuoteSimpleNoInit,
} from "@/lib/ref";

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

    const { tokenInId, tokenOutId, amountInHuman } = payload || {};

    if (!tokenInId || !tokenOutId || !amountInHuman) {
      return NextResponse.json(
        {
          error: "missing_params",
          message: "tokenInId, tokenOutId and amountInHuman are required",
        },
        { status: 400 }
      );
    }

    // Force FastNear node URL if provided
    const preferNode = process.env.NEXT_PUBLIC_REF_NODE_URL;
    let cfg;
    if (preferNode) {
      cfg = await initRefEnvWithNodeUrl(preferNode);
    } else {
      cfg = await ensureRefEnv();
    }

    // Basic structured logging for debugging live quotes
    console.log(
      "[ref-quote][request]",
      JSON.stringify({
        tokenInId,
        tokenOutId,
        amountInHuman,
        env: cfg?.networkId,
        nodeUrl: cfg?.nodeUrl,
      })
    );

    let expectedOut: string | undefined;
    let swapTodos: any;
    // Try primary
    try {
      const res = await refQuoteSimple(tokenInId, tokenOutId, amountInHuman);
      expectedOut = res.expectedOut;
      swapTodos = res.swapTodos;
    } catch (e) {
      // Retry with FastNear endpoints (premium if key provided, else free)
      const env = (
        process.env.NEXT_PUBLIC_REF_ENV ||
        process.env.NEAR_ENV ||
        "mainnet"
      ).toLowerCase();
      const apiKey =
        process.env.FASTNEAR_API_KEY ||
        process.env.NEXT_PUBLIC_FASTNEAR_API_KEY ||
        "";
      const fallbacks =
        env === "testnet"
          ? [
              apiKey
                ? `https://rpc.testnet.fastnear.com?apiKey=${apiKey}`
                : "https://test.rpc.fastnear.com",
            ]
          : [
              apiKey
                ? `https://rpc.mainnet.fastnear.com?apiKey=${apiKey}`
                : "https://free.rpc.fastnear.com",
            ];
      let lastErr = e;
      for (const url of fallbacks) {
        try {
          await initRefEnvWithNodeUrl(url);
          const res = await refQuoteSimpleNoInit(
            tokenInId,
            tokenOutId,
            amountInHuman
          );
          expectedOut = res.expectedOut;
          swapTodos = res.swapTodos;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!expectedOut) throw lastErr;
    }

    console.log(
      "[ref-quote][response]",
      JSON.stringify({
        expectedOut,
        routes: Array.isArray(swapTodos) ? swapTodos.length : 0,
      })
    );

    if (!expectedOut) {
      return NextResponse.json(
        {
          error: "quote_unavailable",
          message: "No quote available for pair/amount",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ expectedOut, swapTodos });
  } catch (error) {
    console.error("[ref-quote][POST] error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to estimate quote" },
      { status: 500 }
    );
  }
}
