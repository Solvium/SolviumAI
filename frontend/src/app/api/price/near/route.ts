const DEXSCREENER_URL =
  "https://api.dexscreener.com/latest/dex/tokens/wrap.near";

export async function GET() {
  try {
    const res = await fetch(DEXSCREENER_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return Response.json({ error: "dexscreener_failed" }, { status: 502 });
    }
    const data = await res.json();
    const pairs: any[] = Array.isArray((data as any)?.pairs)
      ? (data as any).pairs
      : [];
    const withUsd = pairs.find((p) => p?.priceUsd) || pairs[0];
    const priceUsd = withUsd?.priceUsd ? Number(withUsd.priceUsd) : null;
    if (!priceUsd) {
      return Response.json({ error: "price_not_found" }, { status: 404 });
    }
    return Response.json({ priceUsd });
  } catch (e) {
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
