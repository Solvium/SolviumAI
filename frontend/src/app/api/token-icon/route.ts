import { NextRequest, NextResponse } from "next/server";

const MAP: Record<string, string> = {
  NEAR: "https://cryptologos.cc/logos/near-protocol-near-logo.svg?v=026",
  WNEAR: "https://cryptologos.cc/logos/near-protocol-near-logo.svg?v=026",
  USDC: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=026",
  USDT: "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=026",
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get("symbol") || "").toUpperCase();
    const url = MAP[symbol];
    if (!url) {
      return NextResponse.json({ error: "unknown_symbol" }, { status: 404 });
    }

    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok) {
      return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
    }
    const svg = await upstream.text();
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400", // 1 day
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}


