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

// Mainnet NEP-141 addresses (Rainbow bridged ERC-20s)
// USDC: a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near
// USDT: dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near
const USDC_ID =
  (process.env.NEXT_PUBLIC_REF_ENV || process.env.NEAR_ENV) === "testnet"
    ? "usdc.fakes.testnet"
    : "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near";
const USDT_ID =
  (process.env.NEXT_PUBLIC_REF_ENV || process.env.NEAR_ENV) === "testnet"
    ? "usdt.fakes.testnet"
    : "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near";

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
    name: "USD Coin",
    kind: "ft",
    address: USDC_ID,
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    kind: "ft",
    address: USDT_ID,
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
