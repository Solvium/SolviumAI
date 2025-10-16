import { NextRequest, NextResponse } from "next/server";
import { buildRefInstantSwapTransactions, ensureRefEnv } from "@/lib/ref";

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

    await ensureRefEnv();
    const { txs, swapTodos } = await buildRefInstantSwapTransactions({
      tokenInId,
      tokenOutId,
      amountInHuman,
      slippageBps: typeof slippageBps === "number" ? slippageBps : 50,
      accountId,
      referralId,
    });

    return NextResponse.json({ txs, swapTodos });
  } catch (error) {
    console.error("[ref-swap][POST] error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to build swap transactions" },
      { status: 500 }
    );
  }
}
