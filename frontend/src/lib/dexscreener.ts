export interface DexScreenerToken {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
}

export interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerToken[];
}

/**
 * Fetch token data from DexScreener API
 * @param tokenAddress - The token contract address
 * @returns Promise<DexScreenerToken | null>
 */
export async function fetchTokenFromDexScreener(
  tokenAddress: string
): Promise<DexScreenerToken | null> {
  try {
    console.log(`Fetching token data from DexScreener for: ${tokenAddress}`);

    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(`DexScreener API error: ${response.status}`);
      return null;
    }

    const data: DexScreenerResponse = await response.json();

    if (!data.pairs || data.pairs.length === 0) {
      console.log(`No pairs found for token: ${tokenAddress}`);
      return null;
    }

    // Find the best pair (highest liquidity on NEAR)
    const nearPairs = data.pairs.filter(
      (pair) =>
        pair.chainId === "near" ||
        pair.dexId === "ref" ||
        pair.dexId === "joe" ||
        pair.dexId === "trisolaris"
    );

    if (nearPairs.length === 0) {
      console.log(`No NEAR pairs found for token: ${tokenAddress}`);
      return null;
    }

    // Sort by liquidity (highest first)
    const bestPair = nearPairs.sort(
      (a, b) => b.liquidity.usd - a.liquidity.usd
    )[0];

    console.log(`Found token data:`, {
      symbol: bestPair.baseToken.symbol,
      name: bestPair.baseToken.name,
      liquidity: bestPair.liquidity.usd,
      priceUsd: bestPair.priceUsd,
    });

    return bestPair;
  } catch (error) {
    console.error("Error fetching token from DexScreener:", error);
    return null;
  }
}

/**
 * Check if a token has sufficient liquidity for trading
 * @param tokenData - Token data from DexScreener
 * @param minLiquidityUsd - Minimum liquidity in USD (default: $1000)
 * @returns boolean
 */
export function hasSufficientLiquidity(
  tokenData: DexScreenerToken,
  minLiquidityUsd: number = 1000
): boolean {
  return tokenData.liquidity.usd >= minLiquidityUsd;
}

/**
 * Get token metadata from DexScreener data
 * @param tokenData - Token data from DexScreener
 * @returns Token metadata object
 */
export function getTokenMetadataFromDexScreener(tokenData: DexScreenerToken) {
  return {
    symbol: tokenData.baseToken.symbol,
    name: tokenData.baseToken.name,
    address: tokenData.baseToken.address,
    decimals: 18, // Default, will be fetched separately if needed
    priceUsd: parseFloat(tokenData.priceUsd),
    liquidityUsd: tokenData.liquidity.usd,
    volume24h: tokenData.volume.h24,
    priceChange24h: tokenData.priceChange.h24,
  };
}
