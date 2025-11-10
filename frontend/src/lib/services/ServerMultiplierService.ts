// Server-side multiplier service for API routes
// This doesn't use React hooks and can be imported in API routes

import { providers } from "near-api-js";
import type { CodeResult } from "near-api-js/lib/providers/provider";

export interface PointCalculationResult {
  basePoints: number;
  multiplier: number;
  boostedPoints: number;
  totalPoints: number;
  boostAmount: number;
}

function getRpcUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_NEAR_RPC_URL ||
    process.env.NEAR_NODE_URL ||
    process.env.NEXT_PUBLIC_NEAR_NODE_URL ||
    "https://rpc.intea.rs";
  console.log("[ServerMultiplier] Using RPC URL:", url);
  return url;
}

function getContractId(): string {
  const id = process.env.NEXT_PUBLIC_CONTRACT_ID || "solviumpuzzle.near";
  console.log("[ServerMultiplier] Using Contract ID:", id);
  return id;
}

function isDepositActive(startTimeNs: string): boolean {
  const now = Date.now() * 1_000_000; // ms -> ns
  const oneWeekNs = 7 * 24 * 60 * 60 * 1000 * 1_000_000;
  const age = now - parseInt(startTimeNs);
  return age <= oneWeekNs;
}

async function fetchUserDepositSummary(accountId: string): Promise<any | null> {
  console.log("[ServerMultiplier] Fetching deposit summary for:", accountId);
  try {
    const provider = new providers.JsonRpcProvider({ url: getRpcUrl() });
    const res = await provider.query<CodeResult>({
      request_type: "call_function",
      account_id: getContractId(),
      method_name: "getUserDepositSummary",
      args_base64: Buffer.from(JSON.stringify({ user: accountId })).toString(
        "base64"
      ),
      finality: "optimistic",
    });
    const result = JSON.parse(Buffer.from(res.result).toString());
    console.log(
      "[ServerMultiplier] Raw deposit summary:",
      JSON.stringify(result)?.slice(0, 500)
    );
    return result;
  } catch (e) {
    console.error("[ServerMultiplier] Failed to fetch deposit summary:", e);
    return null;
  }
}

async function fetchContractMultiplier(accountId?: string): Promise<number> {
  console.log(
    "[ServerMultiplier] Fetching contract multiplier for:",
    accountId
  );
  try {
    const provider = new providers.JsonRpcProvider({ url: getRpcUrl() });
    const res = await provider.query<CodeResult>({
      request_type: "call_function",
      account_id: getContractId(),
      method_name: "getMultiplierFactor",
      args_base64: Buffer.from(
        JSON.stringify(accountId ? { accountId } : {})
      ).toString("base64"),
      finality: "optimistic",
    });
    const result = JSON.parse(Buffer.from(res.result).toString());
    const num = Number(result);
    const safe = Number.isFinite(num) && num > 0 ? num : 1;
    console.log(
      "[ServerMultiplier] Contract multiplier:",
      num,
      "=> used:",
      safe
    );
    return safe;
  } catch (e) {
    console.error("[ServerMultiplier] Failed to fetch contract multiplier:", e);
    return 1;
  }
}

async function computeEffectiveMultiplier(accountId: string): Promise<number> {
  const summary = await fetchUserDepositSummary(accountId);
  if (!summary || !summary.deposits) {
    console.log("[ServerMultiplier] No deposits found; using multiplier 1");
    return 1;
  }

  // Filter and sum only ACTIVE deposits (based on start time only)
  // A deposit is active if it was started within the last week
  let totalYocto = BigInt(0);
  let activeCount = 0;
  Object.values(summary.deposits as Record<string, any>).forEach((d: any) => {
    // Only check start time - deposit is active if within 1 week
    const isActive = d?.startTime && isDepositActive(String(d.startTime));

    if (isActive) {
      try {
        totalYocto += BigInt(d.amount);
        activeCount += 1;
      } catch {}
    }
  });
  const totalNear = Number(totalYocto) / 1e24;
  console.log(
    "[ServerMultiplier] Active deposits:",
    activeCount,
    "Total NEAR:",
    totalNear
  );
  if (!Number.isFinite(totalNear) || totalNear <= 0) return 1;

  // Get contract multiplier factor
  const contractMul = await fetchContractMultiplier(accountId);

  // USER MULTIPLIER = totalNear * contractMul
  // This is the effective multiplier from getUserDepositSummary
  // Example: 2.1 NEAR * 10 contractMul = 21x user multiplier
  const effective = totalNear * contractMul;
  console.log(
    "[ServerMultiplier] Effective multiplier (USER MULTIPLIER) = totalNear * contractMul:",
    totalNear,
    "*",
    contractMul,
    "=",
    effective
  );
  return effective > 0 ? effective : 1;
}

export const calculatePointsWithMultiplier = async (
  basePoints: number,
  accountId?: string
): Promise<PointCalculationResult> => {
  console.log("[ServerMultiplier] Calculating points:", {
    basePoints,
    accountId,
  });
  const multiplier = accountId
    ? await computeEffectiveMultiplier(accountId)
    : 1;
  const boostedPoints = Math.round(basePoints * multiplier);
  const boostAmount = boostedPoints - basePoints;
  console.log("[ServerMultiplier] Result:", {
    multiplier,
    boostedPoints,
    boostAmount,
  });

  return {
    basePoints,
    multiplier,
    boostedPoints,
    totalPoints: boostedPoints,
    boostAmount,
  };
};
