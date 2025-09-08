const BASE_URL = "https://api.nearblocks.io";

function buildHeaders() {
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.NEXT_PUBLIC_NEARBLOCKS_API_KEY;
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

export async function getAccountInfo(accountId: string): Promise<any | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/account/${encodeURIComponent(accountId)}`,
      {
        method: "GET",
        headers: buildHeaders(),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("Nearblocks getAccountInfo error", e);
    return null;
  }
}

export async function getAccountTxns(
  accountId: string,
  perPage: number = 10
): Promise<any[] | null> {
  try {
    const params = new URLSearchParams({
      per_page: String(perPage),
      order: "desc",
    });
    const res = await fetch(
      `${BASE_URL}/v1/account/${encodeURIComponent(
        accountId
      )}/txns-only?${params.toString()}`,
      { method: "GET", headers: buildHeaders(), cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    // Some endpoints return an object with a data array; normalize to array
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as any)?.txns)) return (data as any).txns;
    if (Array.isArray((data as any)?.data)) return (data as any).data;
    return [];
  } catch (e) {
    console.error("Nearblocks getAccountTxns error", e);
    return null;
  }
}

export function formatNearAmount(yocto: string | number | undefined): string {
  if (!yocto && yocto !== 0) return "0";
  try {
    const asStr = String(yocto);
    // Convert yoctoNEAR (1e-24) to NEAR; keep 4 dp
    if (!/^[0-9]+$/.test(asStr)) return asStr;
    const padded = asStr.padStart(25, "0");
    const whole = padded.slice(0, -24).replace(/^0+/, "") || "0";
    const frac = padded.slice(-24, -20); // first 4 decimals
    return `${whole}.${frac}`;
  } catch {
    return String(yocto);
  }
}
