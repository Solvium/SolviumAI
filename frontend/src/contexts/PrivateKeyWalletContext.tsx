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
import { WalletCheckResponse } from "@/lib/crypto";
import { useAuth } from "./AuthContext";

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
  signAndSendTransaction: (
    receiverId: string,
    actions: Array<{
      type: "FunctionCall";
      params: {
        methodName: string;
        args: Record<string, any>;
        gas: string;
        deposit: string;
      };
    }>
  ) => Promise<any>;
  sendNearNative: (receiverId: string, amountYocto: string) => Promise<any>;
  checkTokenRegistration: (tokenId: string) => Promise<boolean>;
  registerToken: (tokenId: string) => Promise<boolean>;
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

  const { user } = useAuth();

  // Auto-connect when user data is available
  useEffect(() => {
    if (!isConnected) {
      autoConnect();
    }
  }, [user?.chatId, (user as any)?.telegramId]);

  const autoConnect = async () => {
    const tgIdRaw =
      (user?.chatId as string) || ((user as any)?.telegramId as string);

    if (!tgIdRaw) {
      return;
    }

    console.log("tgIdRaw", tgIdRaw);
    // Coerce to number string for API that expects numeric id
    const tgId = String(parseInt(tgIdRaw, 10));

    if (!tgId || tgId === "NaN") {
      const errorMsg = "Invalid Telegram ID";

      setError(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try primary route

      let response = await fetch(`/api/wallet`, {
        method: "POST",
        body: JSON.stringify({ telegram_user_id: Number(tgId) }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const errorMsg = `Failed to fetch wallet (${response.status}): ${
          text || response.statusText
        }`;

        throw new Error(errorMsg);
      }

      const walletData = (await response.json()).wallet_info;

      // Map snake_case API response to camelCase fields used locally
      const mapped = walletData
        ? {
            accountId: walletData.account_id,
            privateKey: walletData.private_key, // This is now the encrypted private key from cache
            publicKey: walletData.public_key,
            network: walletData.network,
            isDemo: walletData.is_demo,
          }
        : null;

      if (!mapped?.privateKey || !mapped?.accountId) {
        const errorMsg = "Wallet not found for this user";

        throw new Error(errorMsg);
      }

      const { account: nearAccount } = await initializeNearWithPrivateKey(
        mapped.privateKey,
        mapped.accountId
      );

      setAccount(nearAccount);
      setAccountId(mapped.accountId);
      setIsConnected(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to auto-connect wallet";

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const connectWithPrivateKey = async (
    privateKey: string,
    accountId: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const { account: nearAccount } = await initializeNearWithPrivateKey(
        privateKey,
        accountId
      );

      setAccount(nearAccount);
      setAccountId(accountId);
      setIsConnected(true);

      // Save credentials (consider encrypting in production)
      localStorage.setItem("near_private_key", privateKey);
      localStorage.setItem("near_account_id", accountId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to connect wallet";

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = () => {
    setAccount(null);
    setAccountId(null);
    setIsConnected(false);
    setError(null);

    // Clear stored credentials
    localStorage.removeItem("near_private_key");
    localStorage.removeItem("near_account_id");
  };

  const refreshSolviumWallet = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const tgIdRaw =
        (user?.chatId as string) || ((user as any)?.telegramId as string);
      const tgId = String(parseInt(String(tgIdRaw), 10));
      if (!tgId || tgId === "NaN") {
        throw new Error("Invalid Telegram ID for decrypted wallet fetch");
      }

      let response = await fetch(
        `/api/wallet/byTelegram/${encodeURIComponent(tgId)}?decrypt=1`
      );

      if (!response.ok) {
        const alt = await fetch(
          `/api/wallet/by-telegram/${encodeURIComponent(tgId)}?decrypt=1`
        );

        if (alt.ok) response = alt;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const errorMsg = `Failed to fetch decrypted wallet (${
          response.status
        }): ${text || response.statusText}`;

        throw new Error(errorMsg);
      }

      const decrypted = await response.json();

      // Not mutating solviumWallet state here since this route returns decrypted credentials,
      // which differ from WalletCheckResponse. We only log as requested.
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch decrypted wallet";

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh solvium wallet when user changes
  useEffect(() => {
    if (user?.chatId || (user as any)?.telegramId) {
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
    signAndSendTransaction: async (receiverId, actions) => {
      if (!account) throw new Error("NEAR account not initialized");
      const first = actions?.[0];
      if (!first || first.type !== "FunctionCall") {
        throw new Error("Unsupported action");
      }
      return (account as any).functionCall({
        contractId: receiverId,
        methodName: first.params.methodName,
        args: first.params.args || {},
        gas: first.params.gas,
        attachedDeposit: first.params.deposit,
      });
    },
    checkTokenRegistration: async (tokenId: string) => {
      if (!account) throw new Error("NEAR account not initialized");
      try {
        const result = await account.viewFunction({
          contractId: tokenId,
          methodName: "storage_balance_of",
          args: { account_id: account.accountId },
        });
        return result !== null;
      } catch (error) {
        console.error("Error checking token registration:", error);
        return false;
      }
    },
    registerToken: async (tokenId: string) => {
      if (!account) throw new Error("NEAR account not initialized");
      try {
        const result = await account.functionCall({
          contractId: tokenId,
          methodName: "storage_deposit",
          args: {},
          attachedDeposit: BigInt("1250000000000000000000"), // 0.00125 NEAR
        });
        return result !== null;
      } catch (error) {
        console.error("Error registering token:", error);
        return false;
      }
    },
    sendNearNative: async (receiverId: string, amountYocto: string) => {
      if (!account) throw new Error("NEAR account not initialized");
      try {
        // Use Account.sendMoney for native NEAR transfers
        const result = await (account as any).sendMoney(
          receiverId,
          BigInt(amountYocto)
        );
        return result;
      } catch (error) {
        console.error("Error sending NEAR:", error);
        throw error;
      }
    },
  };

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
