import { REF_ENV, REF_INDEXER_URL, REF_NODE_URL } from "@/config/ref";
import { initializeRefSDK, isRefSDKInitialized, getRefConfig } from "./refInit";

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
    console.log(`[ref-sdk] Loaded CJS version of Ref Finance SDK`);
    return cjs?.default || cjs;
  } catch (e) {
    console.log(
      `[ref-sdk] CJS load failed, trying ESM:`,
      e instanceof Error ? e.message : String(e)
    );
  }
  const esm: any = await import("@ref-finance/ref-sdk");
  console.log(`[ref-sdk] Loaded ESM version of Ref Finance SDK`);
  return esm?.default || esm;
}

export async function ensureRefEnv() {
  // Use the global initialization if available
  if (isRefSDKInitialized()) {
    console.log("[ref-sdk] Using globally initialized Ref SDK");
    return await getRefConfig();
  }

  // Fallback to local initialization
  console.log(
    "[ref-sdk] Ref SDK not globally initialized, initializing locally..."
  );
  return await initializeRefSDK();
}

export async function initRefEnvWithNodeUrl(nodeUrl?: string) {
  // If no specific nodeUrl provided, use global initialization
  if (!nodeUrl) {
    return await ensureRefEnv();
  }

  // If a specific nodeUrl is provided, we need to reinitialize
  console.log(
    `[ref-sdk] Reinitializing Ref Finance SDK with custom RPC: ${nodeUrl}`
  );

  const env = REF_ENV || "mainnet";
  const { init_env, getConfig } = await loadRefSdk();
  const indexerUrl = REF_INDEXER_URL || undefined;

  // Set environment variables that Ref SDK might be using
  process.env.NEAR_NODE_URL = nodeUrl;
  process.env.NEXT_PUBLIC_NEAR_NODE_URL = nodeUrl;

  // Try to override the SDK's internal configuration
  try {
    // Some SDKs check for specific environment variables
    process.env.REF_NODE_URL = nodeUrl;
    process.env.NEAR_RPC_URL = nodeUrl;
    process.env.NEAR_ENDPOINT = nodeUrl;
  } catch (e) {
    console.log(
      `[ref-sdk] Environment variable override failed:`,
      e instanceof Error ? e.message : String(e)
    );
  }

  init_env(env, indexerUrl || "", nodeUrl);
  const cfg = getConfig(env);

  // Try to manually override the config if the SDK didn't respect our URL
  if (cfg && cfg.nodeUrl !== nodeUrl) {
    console.log(
      `[ref-sdk] SDK ignored our RPC URL, attempting manual override`
    );
    try {
      cfg.nodeUrl = nodeUrl;
      console.log(`[ref-sdk] Manual override applied: ${cfg.nodeUrl}`);
    } catch (e) {
      console.log(
        `[ref-sdk] Manual override failed:`,
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  try {
    console.log(
      "[ref-sdk][env:override]",
      JSON.stringify({
        env,
        nodeUrl: cfg?.nodeUrl,
        requestedNodeUrl: nodeUrl,
        usingInteaRPC: cfg?.nodeUrl?.includes("intea.rs"),
        processEnvNodeUrl: process.env.NEAR_NODE_URL,
        manualOverride: cfg?.nodeUrl === nodeUrl,
      })
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
    // REMOVED: Old bridged USDC token fallback - this was causing issues
    // Only using native usdc.near now
    throw e;
  }
}
