import { useState, useCallback } from "react";
import {
  MiniAppGetOrCreateRequest,
  MiniAppGetOrCreateResponse,
} from "@/lib/miniAppApi";

interface UseMiniAppApiReturn {
  getOrCreateUser: (
    request: MiniAppGetOrCreateRequest
  ) => Promise<MiniAppGetOrCreateResponse | null>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useMiniAppApi(): UseMiniAppApiReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getOrCreateUser = useCallback(
    async (
      request: MiniAppGetOrCreateRequest
    ): Promise<MiniAppGetOrCreateResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          "/api/wallet?action=mini-app-get-or-create",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData?.message || errorData?.error || `HTTP ${response.status}`
          );
        }

        const data = await response.json();
        return data as MiniAppGetOrCreateResponse;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(errorMessage);
        console.error("Mini app API error:", err);
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
    getOrCreateUser,
    isLoading,
    error,
    clearError,
  };
}
