import { useState, useCallback, useEffect } from "react";
import { useSolviumContract } from "./useSolviumContract";
import { useAuth } from "../contexts/AuthContext";
import { providers } from "near-api-js";
import { CodeResult } from "near-api-js/lib/providers/provider";

interface NearDepositData {
  id: number;
  amount: string;
  multiplier: string;
  startTime: string;
  active: boolean;
}

interface NearDepositResponse {
  totalDeposits: string;
  deposits: {
    [key: string]: NearDepositData;
  };
  lastDepositId: number;
  multiplierFactor?: number;
}

interface MultiplierTrackingState {
  currentMultiplier: number;
  previousMultiplier: number;
  multiplierChanged: boolean;
  isLoading: boolean;
  error: string | null;
}

// Direct contract query function
const getUserDepositsDirect = async (
  accountId: string
): Promise<NearDepositResponse> => {
  try {
    console.log("🔍 Direct contract query for account:", accountId);

    const provider = new providers.JsonRpcProvider({
      url:
        process.env.NEXT_PUBLIC_NEAR_RPC_URL || "https://rpc.testnet.near.org",
    });

    const contractId =
      process.env.NEXT_PUBLIC_CONTRACT_ID || "solviumpuzzlegame.testnet";

    const res = await provider.query<CodeResult>({
      request_type: "call_function",
      account_id: contractId,
      method_name: "getUserDepositSummary",
      args_base64: Buffer.from(JSON.stringify({ user: accountId })).toString(
        "base64"
      ),
      finality: "optimistic",
    });

    console.log("📊 Direct contract response:", res);

    const result = JSON.parse(Buffer.from(res.result).toString());
    console.log("✅ Parsed deposit data:", result);

    return result;
  } catch (error) {
    console.error("❌ Failed to fetch deposits directly:", error);
    throw error;
  }
};

export const useDepositMultiplier = () => {
  const { user, refreshUser } = useAuth();
  const { getMultiplierFactor, isConnected } = useSolviumContract();

  const [state, setState] = useState<MultiplierTrackingState>({
    currentMultiplier: 1,
    previousMultiplier: 1,
    multiplierChanged: false,
    isLoading: false,
    error: null,
  });

  const [userDepositData, setUserDepositData] =
    useState<NearDepositResponse | null>(null);

  // Fetch user deposit data directly from contract
  const fetchUserDepositData = useCallback(async (accountId: string) => {
    try {
      console.log("🔄 Fetching user deposit data directly from contract...");
      const result = await getUserDepositsDirect(accountId);
      console.log("📊 User deposit data:", result);
      setUserDepositData(result);
      return result;
    } catch (error) {
      console.error("❌ Failed to fetch user deposit data:", error);
      throw error;
    }
  }, []);

  // Fetch current multiplier from contract
  const fetchCurrentMultiplier = useCallback(async () => {
    if (!isConnected) {
      console.log("⚠️ Cannot fetch multiplier - wallet not connected");
      return;
    }

    console.log("🔄 Fetching contract multiplier...");
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await getMultiplierFactor();
      console.log("📊 Contract Multiplier Result:", result);

      if (result.success) {
        const newMultiplier = result.data || 1;
        const previousMultiplier = state.currentMultiplier;
        const multiplierChanged = previousMultiplier !== newMultiplier;

        console.log("⚡ Contract Multiplier Data:", {
          newMultiplier,
          previousMultiplier,
          multiplierChanged,
          rawData: result.data,
        });

        setState((prev) => ({
          ...prev,
          currentMultiplier: newMultiplier,
          previousMultiplier,
          multiplierChanged,
          isLoading: false,
        }));

        // If multiplier changed, update user data
        if (multiplierChanged && user?.multiplier !== newMultiplier) {
          await refreshUser();
        }

        return { multiplier: newMultiplier, changed: multiplierChanged };
      } else {
        console.log("❌ Contract multiplier fetch failed:", result.error);
        throw new Error(result.error || "Failed to fetch multiplier");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch multiplier";
      console.log("💥 Error fetching contract multiplier:", error);
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      throw error;
    }
  }, [
    getMultiplierFactor,
    isConnected,
    state.currentMultiplier,
    user?.multiplier,
    refreshUser,
  ]);

  // Track multiplier before and after deposit
  const trackDepositMultiplier = useCallback(
    async (depositAmount: string) => {
      if (!isConnected) {
        throw new Error("Wallet not connected");
      }

      // Get multiplier before deposit
      const beforeResult = await fetchCurrentMultiplier();
      const beforeMultiplier = beforeResult?.multiplier || 1;

      // Return a function to check multiplier after deposit
      return {
        beforeMultiplier,
        checkAfterDeposit: async () => {
          const afterResult = await fetchCurrentMultiplier();
          const afterMultiplier = afterResult?.multiplier || 1;

          return {
            beforeMultiplier,
            afterMultiplier,
            multiplierChanged: beforeMultiplier !== afterMultiplier,
            changeAmount: afterMultiplier - beforeMultiplier,
          };
        },
      };
    },
    [isConnected, fetchCurrentMultiplier]
  );

  // Auto-fetch multiplier when connected
  useEffect(() => {
    if (isConnected) {
      fetchCurrentMultiplier();
    }
  }, [isConnected, fetchCurrentMultiplier]);

  return {
    ...state,
    fetchCurrentMultiplier,
    trackDepositMultiplier,
    fetchUserDepositData,
    userDepositData,
  };
};
