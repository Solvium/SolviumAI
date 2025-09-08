export async function getAccountFull(accountId: string): Promise<any | null> {
  try {
    const res = await fetch(
      `/api/fastnear/account/${encodeURIComponent(accountId)}/full`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("FastNEAR getAccountFull error", e);
    return null;
  }
}

export function formatYoctoToNear(yocto?: string): string {
  if (!yocto) return "0";
  if (!/^[0-9]+$/.test(yocto)) return yocto;
  const padded = yocto.padStart(25, "0");
  const whole = padded.slice(0, -24).replace(/^0+/, "") || "0";
  const frac = padded.slice(-24, -20);
  return `${whole}.${frac}`;
}
