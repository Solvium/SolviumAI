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
        const response = await fetch("/api/wallet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            telegram_user_id: telegramUserId,
          }),
        });

        let data: WalletCheckResponse | null = null;
        if (!response.ok) {
          try {
            const errorData = await response.json();
            throw new Error(
              (errorData as any)?.error ||
                (errorData as any)?.message ||
                `HTTP ${response.status}`
            );
          } catch (e) {
            const text = await response.text();
            throw new Error(text?.slice(0, 200) || `HTTP ${response.status}`);
          }
        }

        try {
          data = (await response.json()) as WalletCheckResponse;
        } catch (e) {
          const text = await response.text();
          throw new Error(text?.slice(0, 200) || "Invalid JSON response");
        }
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
