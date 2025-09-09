import { NextRequest } from "next/server";

const RPC_URLS: Record<string, string> = {
  mainnet: "https://rpc.mainnet.near.org",
  testnet: "https://rpc.testnet.near.org",
};

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const network = (
      url.searchParams.get("network") ||
      process.env.NEXT_PUBLIC_NEAR_NETWORK_ID ||
      "mainnet"
    ).toLowerCase();
    const target = RPC_URLS[network] || RPC_URLS.mainnet;

    const body = await req.text();
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
    });

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (e) {
    return Response.json({ error: "near_rpc_proxy_error" }, { status: 500 });
  }
}

// Removed duplicate POST/GET handlers; single POST above handles proxying
