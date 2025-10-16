import { NextRequest, NextResponse } from "next/server";
import { ensureRefEnv, refQuoteSimple } from "@/lib/ref";

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

    await ensureRefEnv();
    const { expectedOut, swapTodos } = await refQuoteSimple(
      tokenInId,
      tokenOutId,
      amountInHuman
    );

    return NextResponse.json({ expectedOut, swapTodos });
  } catch (error) {
    console.error("[ref-quote][POST] error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to estimate quote" },
      { status: 500 }
    );
  }
}
