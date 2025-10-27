import { useCallback, useState } from "react";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { CONTRACTID } from "@/lib/constants/contractId";

interface ContractCallResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  data?: any;
}

interface UserDepositSummary {
  totalDeposits: string;
  multiplierFactor: number;
  spinsAvailable: number;
}

interface SpinsData {
  regularSpin?: boolean;
  extraSpins?: number;
}

// Utility function to parse spins data from contract
const parseSpinsData = (spinsData: any): number => {
  if (typeof spinsData === "number") {
    return spinsData;
  } else if (typeof spinsData === "object" && spinsData !== null) {
    // Handle object format: {regularSpin: true, extraSpins: 1}
    let totalSpins = 0;
    if (spinsData.regularSpin) totalSpins += 1;
    if (spinsData.extraSpins) totalSpins += spinsData.extraSpins;
    return totalSpins;
  }
  return 0;
};

// Utility function to check if a deposit is still active (within 1 week)
const isDepositActive = (startTime: string): boolean => {
  const now = Date.now() * 1000000; // Convert to nanoseconds
  const oneWeekInNanoseconds = 7 * 24 * 60 * 60 * 1000 * 1000000; // 1 week in nanoseconds
  const depositAge = now - parseInt(startTime);
  return depositAge <= oneWeekInNanoseconds;
};

// Utility function to filter active deposits and calculate totals
const filterActiveDeposits = (deposits: any) => {
  const activeDeposits: any[] = [];
  let totalActiveDeposits = "0";
  let totalActiveMultiplier = 0;

  Object.values(deposits).forEach((deposit: any) => {
    if (isDepositActive(deposit.startTime)) {
      activeDeposits.push(deposit);
      // Add to total deposits
      totalActiveDeposits = (
        BigInt(totalActiveDeposits) + BigInt(deposit.amount)
      ).toString();
      // Add to total multiplier (weighted by amount)
      const depositMultiplier = parseFloat(deposit.multiplier) / 1e16;
      const depositAmount = parseFloat(deposit.amount) / 1e24;
      totalActiveMultiplier += depositMultiplier * depositAmount;
    }
  });

  // Calculate weighted average multiplier
  const totalAmount = parseFloat(totalActiveDeposits) / 1e24;
  const averageMultiplier =
    totalAmount > 0 ? totalActiveMultiplier / totalAmount : 0;

  return {
    activeDeposits,
    totalActiveDeposits,
    averageMultiplier,
    totalAmount,
  };
};

interface PreparedTransfer {
  id: string;
  amount: string;
  recipient: string;
  status: string;
}

export const useSolviumContract = () => {
  const { account, isConnected, signAndSendTransaction } =
    usePrivateKeyWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContractCall = useCallback(
    async (
      methodName: string,
      args: Record<string, any> = {},
      deposit: string = "0",
      gas: string = "30000000000000"
    ): Promise<ContractCallResult> => {
      if (!isConnected || !account) {
        return {
          success: false,
          error: "Wallet not connected",
        };
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await signAndSendTransaction(CONTRACTID, [
          {
            type: "FunctionCall",
            params: {
              methodName,
              args,
              gas,
              deposit,
            },
          },
        ]);

        return {
          success: true,
          transactionHash: (result as any)?.transaction?.hash,
          data: result,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Contract call failed";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [account, isConnected, signAndSendTransaction]
  );

  const handleViewCall = useCallback(
    async (
      methodName: string,
      args: Record<string, any> = {}
    ): Promise<ContractCallResult> => {
      if (!isConnected || !account) {
        return {
          success: false,
          error: "Wallet not connected",
        };
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await (account as any).viewFunction({
          contractId: CONTRACTID,
          methodName,
          args,
        });

        return {
          success: true,
          data: result,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "View call failed";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [account, isConnected]
  );

  // Contract Functions (converted from snake_case to camelCase)

  const solviumGame = useCallback(
    async (gameData: Record<string, any>) => {
      return handleContractCall("solviumGame", gameData);
    },
    [handleContractCall]
  );

  const adminWithdraw = useCallback(
    async (amount: string) => {
      const amountYocto = (Number.parseFloat(amount) * 1e24).toString();
      return handleContractCall("adminWithdraw", { amount: amountYocto });
    },
    [handleContractCall]
  );

  const changeOldAddress = useCallback(
    async (oldAddress: string, newAddress: string) => {
      return handleContractCall("changeOldAddress", { oldAddress, newAddress });
    },
    [handleContractCall]
  );

  const claimWheel = useCallback(
    async (rewardAmount: string, tokenAddress: string) => {
      return handleContractCall("claimWheel", { rewardAmount, tokenAddress });
    },
    [handleContractCall]
  );

  const depositToGame = useCallback(
    async (amount: string) => {
      try {
        // Validate and parse the amount
        const numAmount = Number.parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
          throw new Error("Invalid amount: must be a positive number");
        }

        // Convert to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
        // Use BigInt for precise calculation to avoid floating point issues
        const amountInYocto = BigInt(Math.floor(numAmount * 1e24));
        const amountYocto = amountInYocto.toString();

        console.log(`Depositing ${amount} NEAR (${amountYocto} yoctoNEAR)`);

        return handleContractCall("depositToGame", {}, amountYocto);
      } catch (error) {
        console.error("Error converting amount to yoctoNEAR:", error);
        throw new Error(
          `Invalid amount format: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
    [handleContractCall]
  );

  const executeDirectTransfer = useCallback(
    async (recipient: string, amount: string) => {
      const amountYocto = (Number.parseFloat(amount) * 1e24).toString();
      return handleContractCall("executeDirectTransfer", {
        recipient,
        amount: amountYocto,
      });
    },
    [handleContractCall]
  );

  const executeTransfer = useCallback(
    async (transferId: string) => {
      return handleContractCall("executeTransfer", { transferId });
    },
    [handleContractCall]
  );

  const purchaseSpinWithPoints = useCallback(
    async (points: string) => {
      return handleContractCall("purchaseSpinWithPoints", { points });
    },
    [handleContractCall]
  );

  const prepareTransfer = useCallback(
    async (recipient: string, amount: string) => {
      const amountYocto = (Number.parseFloat(amount) * 1e24).toString();
      return handleContractCall("prepareTransfer", {
        recipient,
        amount: amountYocto,
      });
    },
    [handleContractCall]
  );

  const updateMultiplierFactor = useCallback(
    async (factor: number) => {
      return handleContractCall("updateMultiplierFactor", { factor });
    },
    [handleContractCall]
  );

  // View Functions (read-only)

  const getAllUserDeposits = useCallback(
    async (accountId?: string) => {
      const args = accountId ? { user: accountId } : {};
      const res = await handleViewCall("getAllUserDeposits", args);

      // Filter out expired deposits (older than 1 week)
      if (res.success && res.data) {
        const { activeDeposits } = filterActiveDeposits(res.data);

        // Convert array back to object format
        const activeDepositsObj: any = {};
        activeDeposits.forEach((deposit, index) => {
          activeDepositsObj[index + 1] = deposit;
        });

        res.data = activeDepositsObj;
        console.log(
          "🔄 Filtered getAllUserDeposits - Active deposits:",
          activeDeposits.length
        );
      }

      console.log("getAllUserDeposits", res);
      return res;
    },
    [handleViewCall]
  );

  const getContractBalance = useCallback(async () => {
    return handleViewCall("getContractBalance");
  }, [handleViewCall]);

  const getMultiplierFactor = useCallback(
    async (accountId?: string) => {
      const args = accountId ? { accountId } : {};
      const res = handleViewCall("getMultiplierFactor", args);

      return res;
    },
    [handleViewCall]
  );

  const getSpinsAvailable = useCallback(
    async (accountId?: string) => {
      const args = accountId ? { accountId } : {};
      const result = await handleViewCall("getSpinsAvailable", args);

      // Parse the spins data to ensure consistent format
      if (result.success && result.data !== undefined) {
        return {
          ...result,
          data: parseSpinsData(result.data),
        };
      }

      return result;
    },
    [handleViewCall]
  );

  const getTotalDeposits = useCallback(async () => {
    return handleViewCall("getTotalDeposits");
  }, [handleViewCall]);

  const getUserDepositSummary = useCallback(
    async (
      accountId?: string
    ): Promise<ContractCallResult & { data?: UserDepositSummary }> => {
      const args = accountId ? { user: accountId } : {};
      const result = await handleViewCall("getUserDepositSummary", args);

      // Filter out expired deposits (older than 1 week) and recalculate totals
      if (result.success && result.data && result.data.deposits) {
        const {
          activeDeposits,
          totalActiveDeposits,
          averageMultiplier,
          totalAmount,
        } = filterActiveDeposits(result.data.deposits);

        // Update the result with filtered data
        result.data = {
          ...result.data,
          deposits: activeDeposits.reduce((acc, deposit, index) => {
            acc[index + 1] = deposit;
            return acc;
          }, {} as any),
          totalDeposits: totalActiveDeposits,
          multiplierFactor: averageMultiplier,
          lastDepositId:
            activeDeposits.length > 0
              ? Math.max(...activeDeposits.map((d) => d.id))
              : 0,
        };

        console.log(
          "🔄 Filtered deposits - Active:",
          activeDeposits.length,
          "Total Amount:",
          totalAmount,
          "Avg Multiplier:",
          averageMultiplier
        );
      }

      return result;
    },
    [handleViewCall]
  );

  const getPreparedTransfer = useCallback(
    async (
      transferId: string
    ): Promise<ContractCallResult & { data?: PreparedTransfer }> => {
      return handleViewCall("getPreparedTransfer", { transferId });
    },
    [handleViewCall]
  );

  const init = useCallback(
    async (initData: Record<string, any>) => {
      return handleContractCall("init", initData);
    },
    [handleContractCall]
  );

  return {
    // State
    isLoading,
    error,
    isConnected,

    // Contract Functions
    solviumGame,
    adminWithdraw,
    changeOldAddress,
    claimWheel,
    depositToGame,
    executeDirectTransfer,
    executeTransfer,
    purchaseSpinWithPoints,
    prepareTransfer,
    updateMultiplierFactor,
    init,

    // View Functions
    getAllUserDeposits,
    getContractBalance,
    getMultiplierFactor,
    getSpinsAvailable,
    getTotalDeposits,
    getUserDepositSummary,
    getPreparedTransfer,

    // Utility
    handleContractCall,
    handleViewCall,
    parseSpinsData,
  };
};
