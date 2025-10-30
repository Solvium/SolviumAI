import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface Deposit {
  id: number;
  amount: number;
  timestamp: Date;
  status: "pending" | "completed" | "failed";
  txHash?: string;
}

export function useDepositContract() {
  const { user } = useAuth();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user's deposits from database
  const getUserDeposits = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/deposits`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch deposits");
      }

      const data = await response.json();
      setDeposits(data.deposits);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to fetch deposits"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle deposit using user's private key
  const handleDeposit = async (amount: string) => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/deposits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Deposit failed");
      }

      const data = await response.json();

      // Add new deposit to local state
      setDeposits((prev) => [data.deposit, ...prev]);

      return data.deposit;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Deposit failed");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Admin withdraw function (only for admin users)
  const adminWithdraw = async (amount: string) => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/deposits/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Withdraw failed");
      }

      const data = await response.json();
      return data.transaction;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Withdraw failed");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      getUserDeposits();
    }
  }, [user?.id]);

  return {
    deposits,
    isLoading,
    error,
    handleDeposit,
    adminWithdraw,
    getUserDeposits,
    // Contract address (for compatibility)
    ca: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "",
  };
}
