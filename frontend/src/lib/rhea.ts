export interface RheaQuoteRequest {
  tokenIn: string; // NEP-141 address (or wrap.near)
  tokenOut: string; // NEP-141 address (or wrap.near)
  amountInRaw: string; // stringified integer
  slippageBps?: number; // optional
}

export interface RheaQuoteResponse {
  expectedOutRaw: string;
  minOutRaw: string;
  router: string; // router contract id to call
  // routerMsg: the message to pass to ft_transfer_call (stringified JSON)
  routerMsg: string;
  // Optional metadata
  route?: any;
}

import { RHEA_QUOTE_URL, RHEA_ROUTER } from "@/config/rhea";

export async function getRheaQuote(
  req: RheaQuoteRequest
): Promise<RheaQuoteResponse> {
  const base = RHEA_QUOTE_URL;
  if (!base) throw new Error("Rhea quote URL not configured");
  const url = new URL(base);
  url.searchParams.set("tokenIn", req.tokenIn);
  url.searchParams.set("tokenOut", req.tokenOut);
  url.searchParams.set("amountIn", req.amountInRaw);
  if (typeof req.slippageBps === "number") {
    url.searchParams.set("slippageBps", String(req.slippageBps));
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Rhea quote failed: ${res.status}`);
  const data = await res.json();
  // Expect fields; provide simple mapping fallback
  const expectedOutRaw =
    data.expectedOutRaw || data.expected_out || data.expectedOut;
  const minOutRaw = data.minOutRaw || data.min_out || data.minOut;
  const router = data.router || RHEA_ROUTER;
  const routerMsg = data.routerMsg || data.msg || data.message;
  if (!expectedOutRaw || !minOutRaw || !router || !routerMsg) {
    throw new Error("Rhea quote missing required fields");
  }
  return {
    expectedOutRaw: String(expectedOutRaw),
    minOutRaw: String(minOutRaw),
    router: String(router),
    routerMsg: String(routerMsg),
    route: data.route,
  };
}
