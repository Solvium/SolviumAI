import { NextRequest } from "next/server";

const BASE_URL = "https://api.fastnear.com";

export async function GET(
  req: NextRequest,
  { params }: { params: { account: string } }
) {
  const account = params.account;
  const search = req.nextUrl.search;
  const upstream = await fetch(
    `${BASE_URL}/v1/account/${encodeURIComponent(account)}/full${search}`,
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
