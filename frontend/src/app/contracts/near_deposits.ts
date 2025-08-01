import { providers } from "near-api-js";
import { CodeResult } from "near-api-js/lib/providers/provider";

// interface NearDeposit {
//   amount: string;
//   timestamp: number;
//   multiplier: number;
//   active: boolean;
// }

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
}

export const getUserDeposits = async (
  selector: any,
  accountId: string
): Promise<NearDepositResponse> => {
  try {
    const { network } = selector.options;
    const provider = new providers.JsonRpcProvider({ url: network.nodeUrl });
    const { contract } = selector.store.getState();

    const res = await provider.query<CodeResult>({
      request_type: "call_function",
      account_id: contract!.contractId,
      method_name: "getUserDepositSummary",
      args_base64: Buffer.from(JSON.stringify({ user: accountId })).toString(
        "base64"
      ),
      finality: "optimistic",
    });

    const resSec = await provider.query<CodeResult>({
      request_type: "call_function",
      account_id: "solviumpuzzlegame.near",
      method_name: "getUserDepositSummary",
      args_base64: Buffer.from(JSON.stringify({ user: accountId })).toString(
        "base64"
      ),
      finality: "optimistic",
    });

    const result = {
      ...JSON.parse(Buffer.from(res.result).toString()),
      ...JSON.parse(Buffer.from(resSec.result).toString()),
    };

    return result;
  } catch (error) {
    console.error("Failed to fetch deposits:", error);
    throw error;
  }
};

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "../contexts/WalletContext";

export function useNearDeposits() {
  const {
    state: { selector, accountId },
  } = useWallet();
  const [deposits, setDeposits] = useState<NearDepositResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDeposits = useCallback(async () => {
    if (!selector || !accountId) return;

    try {
      setLoading(true);
      const results = await getUserDeposits(selector, accountId);
      console.log("results", results);
      setDeposits(results);
    } catch (error) {
      console.error("Error fetching deposits:", error);
    } finally {
      setLoading(false);
    }
  }, [selector, accountId]);

  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  return { deposits, loading, refetch: fetchDeposits };
}
