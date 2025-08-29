"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Account } from "near-api-js";
import {
  initializeNearWithPrivateKey,
  signAndSendTransaction,
  checkTokenRegistration,
  registerToken,
} from "../../lib/nearWallet";
import {
  CONTRACTID,
  MEME_TOKEN_ADDRESS,
} from "../../components/constants/contractId";
import { useMultiLoginContext } from "./MultiLoginContext";

interface PrivateKeyWalletContextType {
  // State
  isConnected: boolean;
  accountId: string | null;
  account: Account | null;
  isLoading: boolean;
  error: string | null;

  // Methods
  connectWithPrivateKey: (
    privateKey: string,
    accountId: string
  ) => Promise<void>;
  disconnect: () => void;
  signAndSendTransaction: (
    receiverId: string,
    actions: any[],
    gas?: string,
    deposit?: string
  ) => Promise<any>;
  checkTokenRegistration: (tokenAddress: string) => Promise<any>;
  registerToken: (tokenId: string) => Promise<any>;
  autoConnect: () => Promise<void>;
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

  const { userData: user } = useMultiLoginContext();

  // Auto-connect when user data is available
  useEffect(() => {
    if (user?.id && !isConnected) {
      autoConnect();
    }
  }, [user]);

  const autoConnect = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch wallet information from the database
      const response = await fetch(
        `/api/wallet/byTelegram/${user.id}?decrypt=1`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch wallet: ${response.statusText}`);
      }

      const walletData = await response.json();

      if (!walletData.privateKey || !walletData.accountId) {
        throw new Error("No wallet found for this user");
      }

      // Initialize NEAR connection with the fetched private key
      const { account: nearAccount } = await initializeNearWithPrivateKey(
        walletData.privateKey,
        walletData.accountId
      );

      setAccount(nearAccount);
      setAccountId(walletData.accountId);
      setIsConnected(true);

      console.log("Auto-connected wallet:", walletData.accountId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to auto-connect wallet";
      setError(errorMessage);
      console.error("Auto-connect error:", err);
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
      console.error("Wallet connection error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = () => {
    setAccount(null);
    setAccountId(null);
    setIsConnected(false);
    setError(null);

    // Clear saved credentials
    localStorage.removeItem("near_private_key");
    localStorage.removeItem("near_account_id");
  };

  const signAndSendTransactionWrapper = async (
    receiverId: string,
    actions: any[],
    gas: string = "300000000000000",
    deposit: string = "0"
  ) => {
    if (!account) {
      throw new Error("Wallet not connected");
    }

    return await signAndSendTransaction(
      account,
      receiverId,
      actions,
      gas,
      deposit
    );
  };

  const checkTokenRegistrationWrapper = async (tokenAddress: string) => {
    if (!account || !accountId) {
      throw new Error("Wallet not connected");
    }

    return await checkTokenRegistration(account, tokenAddress, accountId);
  };

  const registerTokenWrapper = async (tokenId: string) => {
    if (!account || !accountId) {
      throw new Error("Wallet not connected");
    }

    return await registerToken(account, tokenId, accountId);
  };

  const value: PrivateKeyWalletContextType = {
    isConnected,
    accountId,
    account,
    isLoading,
    error,
    connectWithPrivateKey,
    disconnect,
    signAndSendTransaction: signAndSendTransactionWrapper,
    checkTokenRegistration: checkTokenRegistrationWrapper,
    registerToken: registerTokenWrapper,
    autoConnect,
  };

  return (
    <PrivateKeyWalletContext.Provider value={value}>
      {children}
    </PrivateKeyWalletContext.Provider>
  );
};

export const usePrivateKeyWallet = () => {
  const context = useContext(PrivateKeyWalletContext);
  if (!context) {
    throw new Error(
      "usePrivateKeyWallet must be used within PrivateKeyWalletProvider"
    );
  }
  return context;
};
