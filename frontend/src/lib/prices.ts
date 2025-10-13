export async function getNearUsd(): Promise<number | null> {
  try {
    const res = await fetch("/api/wallet?action=price", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const price = Number(data?.priceUsd);
    return Number.isFinite(price) ? price : null;
  } catch (e) {
    console.error("getNearUsd error", e);
    return null;
  }
}
