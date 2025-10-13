import { useState, useCallback, useRef } from "react";

interface BalanceCache {
  balance: string;
  timestamp: number;
  accountId: string;
}

// Global cache to prevent duplicate balance calls
const balanceCache = new Map<string, BalanceCache>();
const CACHE_DURATION = 30000; // 30 seconds

export const useBalanceCache = () => {
  const [isLoading, setIsLoading] = useState(false);
  const activeRequests = useRef(new Set<string>());

  const getCachedBalance = useCallback((accountId: string): string | null => {
    const cached = balanceCache.get(accountId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.balance;
    }
    return null;
  }, []);

  const setCachedBalance = useCallback((accountId: string, balance: string) => {
    balanceCache.set(accountId, {
      balance,
      timestamp: Date.now(),
      accountId,
    });
  }, []);

  const fetchBalance = useCallback(
    async (
      account: any,
      accountId: string,
      forceRefresh: boolean = false
    ): Promise<string> => {
      // Check cache first
      if (!forceRefresh) {
        const cached = getCachedBalance(accountId);
        if (cached) {
          return cached;
        }
      }

      // Prevent duplicate requests
      if (activeRequests.current.has(accountId)) {
        // Wait for existing request
        return new Promise((resolve) => {
          const checkCache = () => {
            const cached = getCachedBalance(accountId);
            if (cached) {
              resolve(cached);
            } else {
              setTimeout(checkCache, 100);
            }
          };
          checkCache();
        });
      }

      activeRequests.current.add(accountId);
      setIsLoading(true);

      try {
        const balance = await account.getAccountBalance();
        const nearBalance = (parseInt(balance.available) / 1e24).toFixed(4);

        setCachedBalance(accountId, nearBalance);
        return nearBalance;
      } catch (error) {
        console.error("Error fetching balance:", error);
        return "0.0000";
      } finally {
        activeRequests.current.delete(accountId);
        setIsLoading(false);
      }
    },
    [getCachedBalance, setCachedBalance]
  );

  const clearCache = useCallback((accountId?: string) => {
    if (accountId) {
      balanceCache.delete(accountId);
    } else {
      balanceCache.clear();
    }
  }, []);

  return {
    getCachedBalance,
    fetchBalance,
    clearCache,
    isLoading,
  };
};

