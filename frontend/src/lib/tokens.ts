export type KnownToken = {
  symbol: string;
  name: string;
  kind: "native" | "ft";
  address?: string;
  decimals?: number;
};

// Mainnet NEP-141 addresses (Rainbow bridged ERC-20s)
// USDC: a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near
// USDT: dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near
export const DEFAULT_TOKENS: KnownToken[] = [
  { symbol: "NEAR", name: "NEAR", kind: "native" },
  {
    symbol: "WNEAR",
    name: "Wrapped NEAR",
    kind: "ft",
    address: "wrap.near",
    decimals: 24,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    kind: "ft",
    address: "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near",
    decimals: 6,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    kind: "ft",
    address: "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near",
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
