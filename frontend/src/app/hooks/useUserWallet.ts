import { useState, useCallback } from "react";
import { useAuth } from "@/app/contexts/AuthContext";

interface WalletTransaction {
  id: string;
  type: "deposit" | "withdraw" | "transfer";
  amount: number;
  status: "pending" | "completed" | "failed";
  timestamp: Date;
  txHash?: string;
}

interface UserWalletState {
  balance: number;
  transactions: WalletTransaction[];
  isLoading: boolean;
  error: string | null;
}

export const useUserWallet = () => {
  const { user } = useAuth();
  const [state, setState] = useState<UserWalletState>({
    balance: 0,
    transactions: [],
    isLoading: false,
    error: null,
  });

  // Get user's wallet balance from database
  const getBalance = useCallback(async () => {
    if (!user?.id) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/user/wallet/balance`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch balance");
      }

      const data = await response.json();
      setState((prev) => ({
        ...prev,
        balance: data.balance,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Failed to fetch balance",
        isLoading: false,
      }));
    }
  }, [user?.id]);

  // Get user's transaction history
  const getTransactions = useCallback(async () => {
    if (!user?.id) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/user/wallet/transactions`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data = await response.json();
      setState((prev) => ({
        ...prev,
        transactions: data.transactions,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch transactions",
        isLoading: false,
      }));
    }
  }, [user?.id]);

  // Send transaction using user's private key
  const sendTransaction = useCallback(
    async (
      type: "deposit" | "withdraw" | "transfer",
      amount: number,
      recipient?: string
    ) => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch(`/api/user/wallet/transaction`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type,
            amount,
            recipient,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Transaction failed");
        }

        const data = await response.json();

        // Update local state with new transaction
        setState((prev) => ({
          ...prev,
          transactions: [data.transaction, ...prev.transactions],
          balance: data.newBalance,
          isLoading: false,
        }));

        return data.transaction;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Transaction failed",
          isLoading: false,
        }));
        throw error;
      }
    },
    [user?.id]
  );

  // Initialize wallet data
  const initializeWallet = useCallback(async () => {
    await Promise.all([getBalance(), getTransactions()]);
  }, [getBalance, getTransactions]);

  return {
    // State
    balance: state.balance,
    transactions: state.transactions,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    getBalance,
    getTransactions,
    sendTransaction,
    initializeWallet,

    // Computed
    isConnected: !!user?.id,
    userId: user?.id,
  };
};
