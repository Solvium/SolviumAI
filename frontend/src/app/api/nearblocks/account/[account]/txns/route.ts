import { NextRequest } from "next/server";

const BASE_URL = "https://api.nearblocks.io";

export async function GET(
  req: NextRequest,
  { params }: { params: { account: string } }
) {
  const account = params.account;
  const search = req.nextUrl.search;
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey =
    process.env.NEARBLOCKS_API_KEY ||
    process.env.NEXT_PUBLIC_NEARBLOCKS_API_KEY;
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const upstream = await fetch(
    `${BASE_URL}/v1/account/${encodeURIComponent(account)}/txns-only${search}`,
    { method: "GET", headers, cache: "no-store" }
  );

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") || "application/json",
    },
  });
}
