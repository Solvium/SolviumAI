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
import {
  initializeNearWithPrivateKey,
  verifyAccountExists,
} from "@/lib/nearWallet";
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
  createWallet: () => Promise<boolean>;
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
  verifyRecipient: (accountId: string) => Promise<boolean>;
  sendFungibleToken: (
    tokenAddress: string,
    receiverId: string,
    amountHuman: string,
    decimals?: number
  ) => Promise<any>;
  checkTokenRegistrationFor: (
    tokenId: string,
    accountId: string
  ) => Promise<boolean>;
  registerTokenFor: (tokenId: string, accountId: string) => Promise<boolean>;
  // Intents / swap helpers
  depositInto: (
    tokenId: string,
    receiverId: string,
    amountRaw: string
  ) => Promise<any>;
  executeIntents: (
    verifierId: string,
    args: { intents: any[]; beneficiary: string }
  ) => Promise<any>;
  wrapNear: (amountYocto: string) => Promise<any>;
  unwrapNear: (amountYocto: string) => Promise<any>;
  simulateIntents: (
    verifierId: string,
    args: { intents: any[]; beneficiary: string }
  ) => Promise<any>;
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

  // Auto-sync connected NEAR accountId to backend once per accountId
  useEffect(() => {
    const syncIfNeeded = async () => {
      if (!accountId) return;
      if (!user?.id) return; // require authenticated user
      const flagKey = `wallet_synced:${accountId}`;
      if (typeof window !== "undefined" && localStorage.getItem(flagKey)) {
        return; // already synced
      }
      try {
        console.log(
          "[WalletSync] Attempting to sync wallet accountId:",
          accountId
        );
        const res = await fetch("/api/user/wallet-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });
        if (res.ok) {
          if (typeof window !== "undefined") {
            localStorage.setItem(flagKey, "1");
            localStorage.setItem("near_account_id", accountId);
          }
          console.log("[WalletSync] Wallet synced successfully");
        } else {
          const txt = await res.text();
          console.warn("[WalletSync] Sync failed:", res.status, txt);
        }
      } catch (e) {
        console.warn("[WalletSync] Sync error:", e);
      }
    };
    syncIfNeeded();
  }, [accountId, user?.id]);

  // Auto-connect when user data is available
  useEffect(() => {
    if (!isConnected) {
      autoConnect();
    }
  }, [user?.chatId, (user as any)?.telegramId]);

  const autoConnect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to get existing wallet first (no need to pass telegram_user_id - server gets it from session)
      let response = await fetch(`/api/wallet`, {
        method: "POST",
        body: JSON.stringify({}), // Empty body - server gets user from authenticated session
      });

      let walletData = null;

      if (response.ok) {
        const result = await response.json();
        walletData = result.wallet_info;
      }

      // If no wallet exists, create one using the mini-app API
      if (!walletData?.private_key || !walletData?.account_id) {
        console.log("No wallet found, creating new wallet for user...");

        try {
          const createWalletResponse = await fetch(
            `/api/wallet?action=mini-app-get-or-create`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}), // Empty body - server gets user from authenticated session
            }
          );

          if (createWalletResponse.ok) {
            const createResult = await createWalletResponse.json();
            console.log("Wallet created successfully:", createResult);

            // Now try to get the wallet again (no need to pass telegram_user_id - server gets it from session)
            response = await fetch(`/api/wallet`, {
              method: "POST",
              body: JSON.stringify({}), // Empty body - server gets user from authenticated session
            });

            if (response.ok) {
              const result = await response.json();
              walletData = result.wallet_info;
            }
          } else {
            console.error(
              "Failed to create wallet:",
              await createWalletResponse.text()
            );
          }
        } catch (createError) {
          console.error("Error creating wallet:", createError);
        }
      }

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
        const errorMsg = "Unable to get or create wallet for this user";

        throw new Error(errorMsg);
      }

      const { account: nearAccount } = await initializeNearWithPrivateKey(
        mapped.privateKey,
        mapped.accountId
      );

      setAccount(nearAccount);
      setAccountId(mapped.accountId);
      setIsConnected(true);
      console.log("Wallet connected successfully:", mapped.accountId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to auto-connect wallet";

      setError(errorMessage);
      console.error("Auto-connect error:", errorMessage);
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

  const createWallet = async () => {
    const tgIdRaw =
      (user?.chatId as string) || ((user as any)?.telegramId as string);

    if (!tgIdRaw) {
      setError("No user ID available for wallet creation");
      return false;
    }

    const tgId = String(parseInt(tgIdRaw, 10));
    if (!tgId || tgId === "NaN") {
      setError("Invalid Telegram ID");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Creating new wallet for user...");

      const createWalletResponse = await fetch(
        `/api/wallet?action=mini-app-get-or-create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}), // Empty body - server gets user from authenticated session
        }
      );

      if (createWalletResponse.ok) {
        const createResult = await createWalletResponse.json();
        console.log("Wallet created successfully:", createResult);

        // Try to connect to the newly created wallet
        await autoConnect();
        return true;
      } else {
        const errorText = await createWalletResponse.text();
        console.error("Failed to create wallet:", errorText);
        setError(`Failed to create wallet: ${errorText}`);
        return false;
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create wallet";
      setError(errorMessage);
      console.error("Wallet creation error:", errorMessage);
      return false;
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
    createWallet,
    disconnect,
    autoConnect,
    refreshSolviumWallet,
    signAndSendTransaction: async (receiverId, actions) => {
      if (!account) throw new Error("NEAR account not initialized");

      if (!actions || actions.length === 0) {
        throw new Error("No actions provided");
      }

      console.log(`Executing ${actions.length} action(s) on ${receiverId}`);

      // Execute each FunctionCall action sequentially using account.functionCall
      // Return the result of the last action
      let lastResult: any = null;
      for (const action of actions) {
        if (action.type !== "FunctionCall") {
          throw new Error("Unsupported action type");
        }
        const methodName = action.params.methodName;
        const args = action.params.args || {};
        // Normalize gas/deposit to BigInt-compatible strings
        const gasStr = action.params.gas || "300000000000000";
        const depositStr = action.params.deposit || "0";

        // Convert to BigInt; accept numeric-like strings
        const gas = BigInt(gasStr);
        const attachedDeposit = BigInt(depositStr);

        lastResult = await (account as any).functionCall({
          contractId: receiverId,
          methodName,
          args,
          gas,
          attachedDeposit,
        });
      }

      return lastResult;
    },
    checkTokenRegistration: async (tokenId: string) => {
      if (!account) throw new Error("NEAR account not initialized");
      try {
        console.log(`Checking storage registration for token: ${tokenId}`);
        const result = await account.viewFunction({
          contractId: tokenId,
          methodName: "storage_balance_of",
          args: { account_id: account.accountId },
        });
        const isRegistered = result !== null && result !== undefined;
        console.log(
          `Storage registration status for ${tokenId}:`,
          isRegistered,
          result
        );
        return isRegistered;
      } catch (error) {
        console.error(
          `Error checking token registration for ${tokenId}:`,
          error
        );
        return false;
      }
    },
    registerToken: async (tokenId: string) => {
      if (!account) throw new Error("NEAR account not initialized");
      try {
        console.log(`Registering storage for token: ${tokenId}`);
        const result = await account.functionCall({
          contractId: tokenId,
          methodName: "storage_deposit",
          args: {},
          attachedDeposit: BigInt("1250000000000000000000"), // 0.00125 NEAR
        });
        console.log(`Storage registration result for ${tokenId}:`, result);
        return result !== null;
      } catch (error) {
        console.error(`Error registering token ${tokenId}:`, error);
        throw error; // Re-throw to allow proper error handling
      }
    },
    checkTokenRegistrationFor: async (
      tokenId: string,
      accountToCheck: string
    ) => {
      if (!account) throw new Error("NEAR account not initialized");
      try {
        const result = await account.viewFunction({
          contractId: tokenId,
          methodName: "storage_balance_of",
          args: { account_id: accountToCheck },
        });
        // Only true when a non-null storage balance object is returned
        return result !== null && result !== undefined;
      } catch (error) {
        // Propagate so caller can avoid auto-deposit on API errors
        throw error as Error;
      }
    },
    registerTokenFor: async (tokenId: string, accountToRegister: string) => {
      if (!account) throw new Error("NEAR account not initialized");
      try {
        console.log(
          `Registering storage for account ${accountToRegister} on token: ${tokenId}`
        );
        const result = await account.functionCall({
          contractId: tokenId,
          methodName: "storage_deposit",
          args: { account_id: accountToRegister, registration_only: true },
          attachedDeposit: BigInt("1250000000000000000000"),
        });
        console.log(
          `Storage registration result for ${accountToRegister} on ${tokenId}:`,
          result
        );
        return result !== null;
      } catch (error) {
        console.error(
          `Error registering token for account ${accountToRegister} on ${tokenId}:`,
          error
        );
        throw error; // Re-throw to allow proper error handling
      }
    },
    sendFungibleToken: async (
      tokenAddress: string,
      receiverId: string,
      amountHuman: string,
      decimals?: number
    ) => {
      if (!account) throw new Error("NEAR account not initialized");
      if (!tokenAddress) throw new Error("Token address is required");
      if (!receiverId) throw new Error("Receiver is required");
      const d = typeof decimals === "number" && decimals >= 0 ? decimals : 24;
      const [w = "0", f = ""] = String(amountHuman).trim().split(".");
      const frac = (f + "0".repeat(d)).slice(0, d);
      const raw = (
        BigInt(w) * BigInt(10) ** BigInt(d) +
        BigInt(frac || "0")
      ).toString();
      try {
        const result = await (account as any).functionCall({
          contractId: tokenAddress,
          methodName: "ft_transfer",
          args: { receiver_id: receiverId, amount: raw },
          gas: BigInt("150000000000000"),
          attachedDeposit: BigInt(1),
        });
        return result;
      } catch (error) {
        console.error("Error sending FT:", error);
        throw error;
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
    verifyRecipient: async (accountId: string) => {
      try {
        return await verifyAccountExists(accountId);
      } catch (error) {
        console.error("Error verifying recipient:", error);
        return false;
      }
    },
    depositInto: async (
      tokenId: string,
      receiverId: string,
      amountRaw: string
    ) => {
      if (!account) throw new Error("NEAR account not initialized");
      if (!tokenId || !receiverId)
        throw new Error("tokenId and receiverId are required");
      return (account as any).functionCall({
        contractId: tokenId,
        methodName: "ft_transfer_call",
        args: { receiver_id: receiverId, amount: amountRaw, msg: "deposit" },
        gas: BigInt("150000000000000"),
        attachedDeposit: BigInt(1),
      });
    },
    executeIntents: async (
      verifierId: string,
      args: { intents: any[]; beneficiary: string }
    ) => {
      if (!account) throw new Error("NEAR account not initialized");
      if (!verifierId) throw new Error("verifierId is required");
      return (account as any).functionCall({
        contractId: verifierId,
        methodName: "execute_intents",
        args,
        gas: BigInt("200000000000000"),
      });
    },
    simulateIntents: async (
      verifierId: string,
      args: { intents: any[]; beneficiary: string }
    ) => {
      if (!account) throw new Error("NEAR account not initialized");
      if (!verifierId) throw new Error("verifierId is required");
      try {
        const result = await (account as any).viewFunction({
          contractId: verifierId,
          methodName: "simulate_intents",
          args,
        });
        return result;
      } catch (e) {
        // Surface simulation errors to caller
        throw e as Error;
      }
    },
    wrapNear: async (amountYocto: string) => {
      if (!account) throw new Error("NEAR account not initialized");
      return (account as any).functionCall({
        contractId: "wrap.near",
        methodName: "near_deposit",
        args: {},
        gas: BigInt("80000000000000"),
        attachedDeposit: BigInt(amountYocto),
      });
    },
    unwrapNear: async (amountYocto: string) => {
      if (!account) throw new Error("NEAR account not initialized");
      return (account as any).functionCall({
        contractId: "wrap.near",
        methodName: "near_withdraw",
        args: { amount: amountYocto },
        gas: BigInt("80000000000000"),
        attachedDeposit: BigInt("1"), // Required 1 yoctoNEAR deposit
      });
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
