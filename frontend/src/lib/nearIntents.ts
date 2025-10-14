export type RawAmount = string; // stringified integer in token decimals

export interface TokenDiffIntent {
  kind: "TokenDiff";
  give_token: string; // NEP-141 contract id
  max_give: RawAmount;
  want_token: string; // NEP-141 contract id
  min_receive: RawAmount;
  deadline_ms: number;
}

export type AnyIntent = TokenDiffIntent; // extend as needed

export interface ExecuteIntentsArgs {
  intents: AnyIntent[];
  beneficiary: string; // account to receive proceeds
}

export function toRawAmount(amountHuman: string, decimals: number): RawAmount {
  const [w = "0", f = ""] = String(amountHuman).trim().split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  const raw = (
    BigInt(w) * BigInt(10) ** BigInt(decimals) +
    BigInt(frac || "0")
  ).toString();
  return raw;
}

export function buildTokenDiff(
  giveToken: string,
  maxGiveRaw: RawAmount,
  wantToken: string,
  minReceiveRaw: RawAmount,
  ttlMs: number = 5 * 60 * 1000
): TokenDiffIntent {
  return {
    kind: "TokenDiff",
    give_token: giveToken,
    max_give: maxGiveRaw,
    want_token: wantToken,
    min_receive: minReceiveRaw,
    deadline_ms: Date.now() + ttlMs,
  };
}
