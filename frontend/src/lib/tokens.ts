export type KnownToken = {
  symbol: string;
  name: string;
  kind: "native" | "ft";
  address?: string;
  decimals?: number;
};

// WNEAR contract address
export function getWNEARAddress(): string {
  const env = (
    process.env.NEXT_PUBLIC_REF_ENV ||
    process.env.NEAR_ENV ||
    "mainnet"
  ).toLowerCase();
  return env === "testnet" ? "wrap.testnet" : "wrap.near";
}

// Native NEAR stablecoin addresses (NOT bridged tokens)
const USDC_NATIVE_ID =
  (process.env.NEXT_PUBLIC_REF_ENV || process.env.NEAR_ENV) === "testnet"
    ? "usdc.fakes.testnet"
    : "usdc.near";
const USDT_NATIVE_ID =
  (process.env.NEXT_PUBLIC_REF_ENV || process.env.NEAR_ENV) === "testnet"
    ? "usdt.fakes.testnet"
    : "usdt.near";

export const DEFAULT_TOKENS: KnownToken[] = [
  { symbol: "NEAR", name: "NEAR", kind: "native" },
  {
    symbol: "WNEAR",
    name: "Wrapped NEAR",
    kind: "ft",
    address: getWNEARAddress(),
    decimals: 24,
  },
  {
    symbol: "USDC",
    name: "USD Coin (Native)",
    kind: "ft",
    address: USDC_NATIVE_ID,
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether USD (Native)",
    kind: "ft",
    address: USDT_NATIVE_ID,
    decimals: 6,
  },
];

export function getKnownTokenBySymbol(symbol: string): KnownToken | undefined {
  return DEFAULT_TOKENS.find(
    (t) => t.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

export function getKnownTokenByAddress(
  address: string
): KnownToken | undefined {
  return DEFAULT_TOKENS.find(
    (t) => t.address && t.address.toLowerCase() === address.toLowerCase()
  );
}
