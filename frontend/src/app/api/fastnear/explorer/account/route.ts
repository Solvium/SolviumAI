import { NextRequest } from "next/server";

const BASE_URL = "https://mainnet.neardata.xyz";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    console.log(body);
    const upstream = await fetch(`${BASE_URL}/v0/account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ account_id: "solviumpuzzle.near" }),
      cache: "no-store",
    });
    console.log(upstream);
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (e) {
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
