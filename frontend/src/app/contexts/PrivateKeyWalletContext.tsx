"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { Account } from "near-api-js";
import { initializeNearWithPrivateKey } from "@/lib/nearWallet";
import { useMultiLoginContext } from "./MultiLoginContext";
import { WalletCheckResponse } from "@/lib/crypto";

const FILE_NAME = "PrivateKeyWalletContext.tsx";

interface PrivateKeyWalletContextType {
  isConnected: boolean;
  accountId: string | null;
  account: Account | null;
  isLoading: boolean;
  error: string | null;
  solviumWallet: WalletCheckResponse | null;
  connectWithPrivateKey: (
    privateKey: string,
    accountId: string
  ) => Promise<void>;
  disconnect: () => void;
  autoConnect: () => Promise<void>;
  refreshSolviumWallet: () => Promise<void>;
}

const PrivateKeyWalletContext =
  createContext<PrivateKeyWalletContextType | null>(null);

export const PrivateKeyWalletProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solviumWallet, setSolviumWallet] =
    useState<WalletCheckResponse | null>(null);

  const { userData: user } = useMultiLoginContext();

  // Auto-connect when user data is available
  useEffect(() => {
    console.log(`[${FILE_NAME}:useEffect] useEffect triggered - user:`, {
      chatId: user?.chatId,
      telegramId: (user as any)?.telegramId,
      isConnected,
      userId: user?.id,
      username: user?.username,
    });

    if ((user?.chatId || (user as any)?.telegramId) && !isConnected) {
      console.log(
        `[${FILE_NAME}:useEffect] Auto-connect triggered for user:`,
        user
      );
      autoConnect();
    } else {
      console.log(`[${FILE_NAME}:useEffect] Auto-connect conditions not met:`, {
        hasChatId: !!user?.chatId,
        hasTelegramId: !!(user as any)?.telegramId,
        isConnected,
        userExists: !!user,
      });
    }
  }, [user?.chatId, (user as any)?.telegramId]);

  const autoConnect = async () => {
    console.log(`[${FILE_NAME}:autoConnect] autoConnect() called`);

    const tgIdRaw = "724141849";
    // (user?.chatId as string) || ((user as any)?.telegramId as string);

    console.log(`[${FILE_NAME}:autoConnect] Raw Telegram ID:`, tgIdRaw);

    if (!tgIdRaw) {
      console.log(
        `[${FILE_NAME}:autoConnect] No Telegram ID found, returning early`
      );
      return;
    }

    // Coerce to number string for API that expects numeric id
    const tgId = String(parseInt(tgIdRaw, 10));
    console.log(`[${FILE_NAME}:autoConnect] Parsed Telegram ID:`, tgId);

    if (!tgId || tgId === "NaN") {
      const errorMsg = "Invalid Telegram ID";
      console.error(`[${FILE_NAME}:autoConnect] ${errorMsg}:`, tgIdRaw);
      setError(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);
    console.log(
      `[${FILE_NAME}:autoConnect] Starting wallet fetch for Telegram ID:`,
      tgId
    );

    try {
      // Try primary route
      console.log(
        `[${FILE_NAME}:autoConnect] Trying primary wallet API route...`
      );
      let response = await fetch(
        `/api/wallet/byTelegram/${encodeURIComponent(tgId)}?decrypt=1`
      );

      console.log(`[${FILE_NAME}:autoConnect] Primary route response:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      // Fallback to alternate route if needed
      if (!response.ok) {
        console.log(
          `[${FILE_NAME}:autoConnect] Primary route failed, trying fallback...`
        );
        const alt = await fetch(
          `/api/wallet/by-telegram/${encodeURIComponent(tgId)}?decrypt=1`
        );
        console.log(`[${FILE_NAME}:autoConnect] Fallback route response:`, {
          status: alt.status,
          statusText: alt.statusText,
          ok: alt.ok,
        });
        if (alt.ok) response = alt;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const errorMsg = `Failed to fetch wallet (${response.status}): ${
          text || response.statusText
        }`;
        console.error(`[${FILE_NAME}:autoConnect] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const walletData = await response.json();
      console.log(`[${FILE_NAME}:autoConnect] Wallet data received:`, {
        hasPrivateKey: !!walletData.privateKey,
        hasAccountId: !!walletData.accountId,
        accountId: walletData.accountId,
        privateKeyLength: walletData.privateKey?.length || 0,
      });

      if (!walletData.privateKey || !walletData.accountId) {
        const errorMsg = "Wallet not found for this user";
        console.error(`[${FILE_NAME}:autoConnect] ${errorMsg}:`, walletData);
        throw new Error(errorMsg);
      }

      console.log(`[${FILE_NAME}:autoConnect] Initializing NEAR connection...`);
      const { account: nearAccount } = await initializeNearWithPrivateKey(
        walletData.privateKey,
        walletData.accountId
      );

      console.log(`[${FILE_NAME}:autoConnect] NEAR connection successful:`, {
        accountId: walletData.accountId,
        accountExists: !!nearAccount,
      });

      setAccount(nearAccount);
      setAccountId(walletData.accountId);
      setIsConnected(true);
      console.log(
        `[${FILE_NAME}:autoConnect] Auto-connected wallet:`,
        walletData.accountId
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to auto-connect wallet";
      console.error(`[${FILE_NAME}:autoConnect] Auto-connect error:`, err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      console.log(
        `[${FILE_NAME}:autoConnect] Auto-connect completed, loading:`,
        false
      );
    }
  };

  const connectWithPrivateKey = async (
    privateKey: string,
    accountId: string
  ) => {
    console.log(
      `[${FILE_NAME}:connectWithPrivateKey] connectWithPrivateKey() called with:`,
      {
        accountId,
        privateKeyLength: privateKey.length,
      }
    );

    setIsLoading(true);
    setError(null);

    try {
      console.log(
        `[${FILE_NAME}:connectWithPrivateKey] Initializing NEAR with private key...`
      );
      const { account: nearAccount } = await initializeNearWithPrivateKey(
        privateKey,
        accountId
      );

      console.log(
        `[${FILE_NAME}:connectWithPrivateKey] NEAR initialization successful:`,
        {
          accountId,
          accountExists: !!nearAccount,
        }
      );

      setAccount(nearAccount);
      setAccountId(accountId);
      setIsConnected(true);

      // Save credentials (consider encrypting in production)
      localStorage.setItem("near_private_key", privateKey);
      localStorage.setItem("near_account_id", accountId);

      console.log(
        `[${FILE_NAME}:connectWithPrivateKey] Wallet connected successfully:`,
        accountId
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to connect wallet";
      console.error(
        `[${FILE_NAME}:connectWithPrivateKey] Wallet connection error:`,
        err
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = () => {
    console.log(`[${FILE_NAME}:disconnect] disconnect() called`);

    setAccount(null);
    setAccountId(null);
    setIsConnected(false);
    setError(null);

    // Clear stored credentials
    localStorage.removeItem("near_private_key");
    localStorage.removeItem("near_account_id");

    console.log(`[${FILE_NAME}:disconnect] Wallet disconnected`);
  };

  const refreshSolviumWallet = useCallback(async () => {
    console.log(
      `[${FILE_NAME}:refreshSolviumWallet] refreshSolviumWallet() called`
    );
    setIsLoading(true);
    setError(null);

    try {
      const tgIdRaw =
        (user?.chatId as string) || ((user as any)?.telegramId as string);
      const tgId = String(parseInt(String(tgIdRaw), 10));
      if (!tgId || tgId === "NaN") {
        throw new Error("Invalid Telegram ID for decrypted wallet fetch");
      }

      console.log(
        `[${FILE_NAME}:refreshSolviumWallet] Fetching decrypted wallet via byTelegram route...`
      );
      let response = await fetch(
        `/api/wallet/byTelegram/${encodeURIComponent(tgId)}?decrypt=1`
      );
      console.log(
        `[${FILE_NAME}:refreshSolviumWallet] Primary byTelegram response:`,
        {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
        }
      );

      if (!response.ok) {
        console.log(
          `[${FILE_NAME}:refreshSolviumWallet] Primary failed, trying fallback by-telegram...`
        );
        const alt = await fetch(
          `/api/wallet/by-telegram/${encodeURIComponent(tgId)}?decrypt=1`
        );
        console.log(
          `[${FILE_NAME}:refreshSolviumWallet] Fallback by-telegram response:`,
          { ok: alt.ok, status: alt.status, statusText: alt.statusText }
        );
        if (alt.ok) response = alt;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const errorMsg = `Failed to fetch decrypted wallet (${
          response.status
        }): ${text || response.statusText}`;
        console.error(`[${FILE_NAME}:refreshSolviumWallet] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const decrypted = await response.json();
      console.log(
        `[${FILE_NAME}:refreshSolviumWallet] Decrypted wallet payload:`,
        decrypted
      );
      // Not mutating solviumWallet state here since this route returns decrypted credentials,
      // which differ from WalletCheckResponse. We only log as requested.
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch decrypted wallet";
      console.error(`[${FILE_NAME}:refreshSolviumWallet] Error:`, err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh solvium wallet when user changes
  useEffect(() => {
    if (user?.chatId || (user as any)?.telegramId) {
      console.log(
        `[${FILE_NAME}:useEffect] Refreshing solvium wallet for user:`,
        user
      );
      refreshSolviumWallet();
    }
  }, [user?.chatId, (user as any)?.telegramId, refreshSolviumWallet]);

  const contextValue: PrivateKeyWalletContextType = {
    isConnected,
    accountId,
    account,
    isLoading,
    error,
    solviumWallet,
    connectWithPrivateKey,
    disconnect,
    autoConnect,
    refreshSolviumWallet,
  };

  console.log(`[${FILE_NAME}:render] Context value updated:`, {
    isConnected,
    accountId,
    isLoading,
    hasError: !!error,
  });

  return (
    <PrivateKeyWalletContext.Provider value={contextValue}>
      {children}
    </PrivateKeyWalletContext.Provider>
  );
};

export const usePrivateKeyWallet = () => {
  const context = useContext(PrivateKeyWalletContext);
  if (!context) {
    throw new Error(
      "usePrivateKeyWallet must be used within a PrivateKeyWalletProvider"
    );
  }
  return context;
};
