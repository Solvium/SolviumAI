import { useState, useCallback } from "react";
import { WalletCheckResponse } from "@/lib/crypto";

interface UseWalletCheckReturn {
  checkWallet: (telegramUserId: number) => Promise<WalletCheckResponse | null>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useWalletCheck(): UseWalletCheckReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkWallet = useCallback(
    async (telegramUserId: number): Promise<WalletCheckResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/wallet/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            telegram_user_id: telegramUserId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `HTTP error! status: ${response.status}`
          );
        }

        const data: WalletCheckResponse = await response.json();
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(errorMessage);
        console.error("Wallet check failed:", err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    checkWallet,
    isLoading,
    error,
    clearError,
  };
}
