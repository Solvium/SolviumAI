import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, params, id } = body;

    const response = await fetch("https://rpc.testnet.near.org/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: id || 1,
        method,
        params: params || [],
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("NEAR RPC proxy error:", error);
    return NextResponse.json(
      { error: "Failed to proxy NEAR RPC call" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const response = await fetch("https://rpc.testnet.near.org/", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("NEAR RPC proxy error:", error);
    return NextResponse.json(
      { error: "Failed to proxy NEAR RPC call" },
      { status: 500 }
    );
  }
}
