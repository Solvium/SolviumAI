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
      const amountYocto = (Number.parseFloat(amount) * 1e24).toString();
      return handleContractCall("depositToGame", {}, amountYocto);
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
      const args = accountId ? { accountId } : {};
      return handleViewCall("getAllUserDeposits", args);
    },
    [handleViewCall]
  );

  const getContractBalance = useCallback(async () => {
    return handleViewCall("getContractBalance");
  }, [handleViewCall]);

  const getMultiplierFactor = useCallback(
    async (accountId?: string) => {
      const args = accountId ? { accountId } : {};
      return handleViewCall("getMultiplierFactor", args);
    },
    [handleViewCall]
  );

  const getSpinsAvailable = useCallback(
    async (accountId?: string) => {
      const args = accountId ? { accountId } : {};
      return handleViewCall("getSpinsAvailable", args);
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
      const args = accountId ? { accountId } : {};
      return handleViewCall("getUserDepositSummary", args);
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
  };
};
