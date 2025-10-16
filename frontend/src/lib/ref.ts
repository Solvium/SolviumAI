import {
  getConfig,
  init_env,
  ftGetTokenMetadata,
  fetchAllPools,
  estimateSwap,
  getExpectedOutputFromSwapTodos,
  instantSwap,
} from "@ref-finance/ref-sdk";
import { REF_ENV, REF_INDEXER_URL, REF_NODE_URL } from "@/config/ref";

export async function ensureRefEnv() {
  const env = REF_ENV || "mainnet";
  // Pass optional custom indexer and node url if provided via env
  if (REF_INDEXER_URL || REF_NODE_URL) {
    init_env(env, REF_INDEXER_URL || "", REF_NODE_URL || undefined);
  } else {
    init_env(env);
  }
  return getConfig(env);
}

export async function refQuoteSimple(
  tokenInId: string,
  tokenOutId: string,
  amountInHuman: string
) {
  await ensureRefEnv();
  const tokenIn = await ftGetTokenMetadata(tokenInId);
  const tokenOut = await ftGetTokenMetadata(tokenOutId);
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
  const tokenIn = await ftGetTokenMetadata(tokenInId);
  const tokenOut = await ftGetTokenMetadata(tokenOutId);
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
