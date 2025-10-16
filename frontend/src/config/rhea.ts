export const RHEA_ROUTER: string = process.env.NEXT_PUBLIC_RHEA_ROUTER || "";

export const RHEA_QUOTE_URL: string =
  process.env.NEXT_PUBLIC_RHEA_QUOTE_URL || "";

export function assertRheaConfigured() {
  if (!RHEA_ROUTER) throw new Error("Rhea router not configured");
  if (!RHEA_QUOTE_URL) throw new Error("Rhea quote URL not configured");
}
