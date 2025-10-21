import { REF_ENV, REF_INDEXER_URL, REF_NODE_URL } from "@/config/ref";

async function loadRefSdk() {
  // Prefer CJS build to avoid React-bound ESM in server runtime
  // Falls back to ESM if needed
  try {
    // CommonJS entry
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const cjs: any = await import(
      /* webpackIgnore: true */ "@ref-finance/ref-sdk/dist/index.js"
    );
    return cjs?.default || cjs;
  } catch {}
  const esm: any = await import("@ref-finance/ref-sdk");
  return esm?.default || esm;
}

export async function ensureRefEnv() {
  const env = REF_ENV || "mainnet";
  const { init_env, getConfig } = await loadRefSdk();
  // Prefer provided URLs; otherwise default to Intea RPC
  const isTestnet = String(env).toLowerCase() === "testnet";
  const defaultNodeUrl = REF_NODE_URL || "https://rpc.intea.rs";
  const indexerUrl = REF_INDEXER_URL || undefined;
  init_env(env, indexerUrl || "", defaultNodeUrl);
  const cfg = getConfig(env);
  try {
    // Debug which nodeUrl is actually set for SDK
    // eslint-disable-next-line no-console
    const seenNodeEnv =
      process.env.NEXT_PUBLIC_REF_NODE_URL || process.env.REF_NODE_URL;
    const seenFastnear =
      process.env.FASTNEAR_API_KEY || process.env.NEXT_PUBLIC_FASTNEAR_API_KEY;
    console.log(
      "[ref-sdk][env]",
      JSON.stringify({
        env,
        nodeUrl: cfg?.nodeUrl,
        NEXT_PUBLIC_REF_NODE_URL: seenNodeEnv,
        FASTNEAR_API_KEY: seenFastnear ? "***" : undefined,
      })
    );
  } catch {}
  return cfg;
}

export async function initRefEnvWithNodeUrl(nodeUrl?: string) {
  const env = REF_ENV || "mainnet";
  const { init_env, getConfig } = await loadRefSdk();
  const indexerUrl = REF_INDEXER_URL || undefined;
  init_env(env, indexerUrl || "", nodeUrl);
  const cfg = getConfig(env);
  try {
    console.log(
      "[ref-sdk][env:override]",
      JSON.stringify({ env, nodeUrl: cfg?.nodeUrl })
    );
  } catch {}
  return cfg;
}

export async function refQuoteSimple(
  tokenInId: string,
  tokenOutId: string,
  amountInHuman: string
) {
  await ensureRefEnv();
  const {
    ftGetTokenMetadata,
    fetchAllPools,
    estimateSwap,
    getExpectedOutputFromSwapTodos,
  } = await loadRefSdk();
  const tokenIn = await fetchTokenMetadataResilient(
    ftGetTokenMetadata,
    tokenInId
  );
  const tokenOut = await fetchTokenMetadataResilient(
    ftGetTokenMetadata,
    tokenOutId
  );
  const { simplePools } = await fetchAllPools();
  const swapTodos = await estimateSwap({
    tokenIn,
    tokenOut,
    amountIn: amountInHuman,
    simplePools,
  });
  const expectedOut = getExpectedOutputFromSwapTodos(swapTodos, tokenOut.id);
  return { swapTodos, expectedOut };
}

export async function refQuoteSimpleNoInit(
  tokenInId: string,
  tokenOutId: string,
  amountInHuman: string
) {
  const {
    ftGetTokenMetadata,
    fetchAllPools,
    estimateSwap,
    getExpectedOutputFromSwapTodos,
  } = await loadRefSdk();
  const tokenIn = await fetchTokenMetadataResilient(
    ftGetTokenMetadata,
    tokenInId
  );
  const tokenOut = await fetchTokenMetadataResilient(
    ftGetTokenMetadata,
    tokenOutId
  );
  const { simplePools } = await fetchAllPools();
  const swapTodos = await estimateSwap({
    tokenIn,
    tokenOut,
    amountIn: amountInHuman,
    simplePools,
  });
  const expectedOut = getExpectedOutputFromSwapTodos(swapTodos, tokenOut.id);
  return { swapTodos, expectedOut };
}

export async function buildRefInstantSwapTransactions(params: {
  tokenInId: string;
  tokenOutId: string;
  amountInHuman: string;
  slippageBps: number; // basis points, e.g. 50 => 0.5%
  accountId: string;
  referralId?: string;
}) {
  const {
    tokenInId,
    tokenOutId,
    amountInHuman,
    slippageBps,
    accountId,
    referralId,
  } = params;
  await ensureRefEnv();
  const { ftGetTokenMetadata, fetchAllPools, estimateSwap, instantSwap } =
    await loadRefSdk();
  const tokenIn = await fetchTokenMetadataResilient(
    ftGetTokenMetadata,
    tokenInId
  );
  const tokenOut = await fetchTokenMetadataResilient(
    ftGetTokenMetadata,
    tokenOutId
  );
  const { simplePools } = await fetchAllPools();
  const swapTodos = await estimateSwap({
    tokenIn,
    tokenOut,
    amountIn: amountInHuman,
    simplePools,
  });
  const slippageTolerance = Math.max(0, slippageBps) / 10000;
  const txs = await instantSwap({
    tokenIn,
    tokenOut,
    amountIn: amountInHuman,
    swapTodos,
    slippageTolerance,
    AccountId: accountId,
    referralId,
  });
  return { txs, swapTodos };
}

export async function validateFtIds(tokenInId: string, tokenOutId: string) {
  await ensureRefEnv();
  const { ftGetTokenMetadata } = await loadRefSdk();
  try {
    await ftGetTokenMetadata(tokenInId);
  } catch (e: any) {
    const msg = String(e?.message || e);
    const err: any = new Error("token_in_not_exist");
    err.code = "token_in_not_exist";
    err.details = { id: tokenInId, message: msg };
    throw err;
  }
  try {
    await ftGetTokenMetadata(tokenOutId);
  } catch (e: any) {
    const msg = String(e?.message || e);
    const err: any = new Error("token_out_not_exist");
    err.code = "token_out_not_exist";
    err.details = { id: tokenOutId, message: msg };
    throw err;
  }
}

export async function buildRefInstantSwapTransactionsNoInit(params: {
  tokenInId: string;
  tokenOutId: string;
  amountInHuman: string;
  slippageBps: number;
  accountId: string;
  referralId?: string;
}) {
  const {
    tokenInId,
    tokenOutId,
    amountInHuman,
    slippageBps,
    accountId,
    referralId,
  } = params;
  const { ftGetTokenMetadata, fetchAllPools, estimateSwap, instantSwap } =
    await loadRefSdk();
  const tokenIn = await fetchTokenMetadataResilient(
    ftGetTokenMetadata,
    tokenInId
  );
  const tokenOut = await fetchTokenMetadataResilient(
    ftGetTokenMetadata,
    tokenOutId
  );
  const { simplePools } = await fetchAllPools();
  const swapTodos = await estimateSwap({
    tokenIn,
    tokenOut,
    amountIn: amountInHuman,
    simplePools,
  });
  const slippageTolerance = Math.max(0, slippageBps) / 10000;
  const txs = await instantSwap({
    tokenIn,
    tokenOut,
    amountIn: amountInHuman,
    swapTodos,
    slippageTolerance,
    AccountId: accountId,
    referralId,
  });
  return { txs, swapTodos };
}

type TokenMetadataLike = {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  spec?: string;
  icon?: string | null;
  reference?: string | null;
  reference_hash?: string | null;
};

async function fetchTokenMetadataResilient(
  sdkGetter: (id: string) => Promise<any>,
  id: string
): Promise<TokenMetadataLike> {
  try {
    return await sdkGetter(id);
  } catch (e: any) {
    const lowered = id.toLowerCase();
    // Known mainnet tokens fallback
    if (lowered === "wrap.near") {
      return {
        id: "wrap.near",
        symbol: "wNEAR",
        name: "Wrapped NEAR fungible token",
        decimals: 24,
        spec: "ft-1.0.0",
        icon: null,
        reference: null,
        reference_hash: null,
      };
    }
    if (
      lowered === "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near"
    ) {
      return {
        id,
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        spec: "ft-1.0.0",
        icon: null,
        reference: null,
        reference_hash: null,
      };
    }
    throw e;
  }
}
