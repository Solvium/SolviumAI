import { useState, useCallback } from "react";
import { connect, keyStores, KeyPair, utils, providers } from "near-api-js";

interface WalletState {
  isConnected: boolean;
  accountId: string | null;
  balance: string | null;
  isLoading: boolean;
  error: string | null;
}

interface DepositResult {
  success: boolean;
  transactionHash?: string;
  points?: number;
  multiplier?: number;
  error?: string;
}

interface Deposit {
  id: number;
  amount: string;
  startTime: number;
  multiplier: number;
  active: boolean;
}

export function useNearWallet() {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    accountId: null,
    balance: null,
    isLoading: false,
    error: null,
  });

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoadingDeposits, setIsLoadingDeposits] = useState(false);

  // Connect wallet using private key directly
  const connectWallet = useCallback(
    async (privateKey: string, accountId: string) => {
      setWalletState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Create key pair from private key
        const keyPair = KeyPair.fromString(privateKey as any);

        // Configure NEAR connection
        const keyStore = new keyStores.InMemoryKeyStore();
        await keyStore.setKey("testnet", accountId, keyPair);

        const near = await connect({
          networkId: "testnet",
          keyStore,
          nodeUrl: "https://rpc.testnet.near.org",
        });

        // Get account and balance
        const account = await near.account(accountId);
        const balance = await account.getAccountBalance();

        setWalletState({
          isConnected: true,
          accountId,
          balance: utils.format.formatNearAmount(balance.total),
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        setWalletState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to connect wallet",
        }));
      }
    },
    []
  );

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setWalletState({
      isConnected: false,
      accountId: null,
      balance: null,
      isLoading: false,
      error: null,
    });
    setDeposits([]);
  }, []);

  // Make a deposit directly from frontend
  const makeDeposit = useCallback(
    async (
      privateKey: string,
      accountId: string,
      amount: string
    ): Promise<DepositResult> => {
      setWalletState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Create key pair from private key
        const keyPair = KeyPair.fromString(privateKey as any);

        // Configure NEAR connection
        const keyStore = new keyStores.InMemoryKeyStore();
        await keyStore.setKey("testnet", accountId, keyPair);

        const near = await connect({
          networkId: "testnet",
          keyStore,
          nodeUrl: "https://rpc.testnet.near.org",
        });

        // Create account object
        const account = await near.account(accountId);

        // Convert amount to yoctoNEAR
        const depositAmount = utils.format.parseNearAmount(amount);

        // Create transaction
        const transaction = {
          signerId: accountId,
          receiverId: accountId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "depositToGame",
                args: {},
                gas: "30000000000000",
                deposit: depositAmount || "0",
              },
            },
          ],
        };

        // Sign and send transaction
        const result = await account.signAndSendTransaction(transaction as any);

        // Calculate multiplier (10x the deposit amount)
        const multiplier = parseFloat(amount) * 10;

        setWalletState((prev) => ({ ...prev, isLoading: false }));

        return {
          success: true,
          transactionHash: result.transaction.hash,
          points: parseFloat(amount) * 10,
          multiplier: multiplier,
        };
      } catch (error) {
        console.error("Failed to make deposit:", error);
        setWalletState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to make deposit",
        }));

        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to make deposit",
        };
      }
    },
    []
  );

  // Get user's deposits directly from contract
  const getDeposits = useCallback(
    async (privateKey: string, accountId: string) => {
      setIsLoadingDeposits(true);

      try {
        // Create key pair from private key
        const keyPair = KeyPair.fromString(privateKey as any);

        // Configure NEAR connection
        const keyStore = new keyStores.InMemoryKeyStore();
        await keyStore.setKey("testnet", accountId, keyPair);

        const near = await connect({
          networkId: "testnet",
          keyStore,
          nodeUrl: "https://rpc.testnet.near.org",
        });

        // Get provider for querying contract
        const provider = new providers.JsonRpcProvider({
          url: "https://rpc.testnet.near.org",
        });

        // Query contract for user deposits
        const res = await provider.query({
          request_type: "call_function",
          account_id: accountId,
          method_name: "getUserDepositSummary",
          args_base64: Buffer.from(
            JSON.stringify({ user: accountId })
          ).toString("base64"),
          finality: "optimistic",
        });

        // Parse the response
        const depositData = JSON.parse(
          Buffer.from((res as any).result).toString()
        );

        if (depositData.deposits) {
          const ONE_WEEK_IN_SECONDS = 604800;

          const isDepositActive = (startTimeInMs: number) => {
            const startTimeInSeconds = startTimeInMs / 1000;
            const currentTimeInSeconds = Math.floor(Date.now() / 1000);
            const endTimeInSeconds = startTimeInSeconds + ONE_WEEK_IN_SECONDS;
            return currentTimeInSeconds <= endTimeInSeconds;
          };

          const formattedDeposits = Object.values(depositData.deposits)
            .map((deposit: any) => {
              const startTimeInMs = Number(deposit.startTime) / 1000000;
              return {
                id: deposit.id,
                amount: utils.format.formatNearAmount(deposit.amount),
                startTime: startTimeInMs,
                multiplier: Number(deposit.multiplier) / 1e16,
                active: isDepositActive(startTimeInMs),
              };
            })
            .sort((a: Deposit, b: Deposit) => b.startTime - a.startTime);

          setDeposits(formattedDeposits);
        }
      } catch (error) {
        console.error("Failed to fetch deposits:", error);
        setWalletState((prev) => ({
          ...prev,
          error:
            error instanceof Error ? error.message : "Failed to fetch deposits",
        }));
      } finally {
        setIsLoadingDeposits(false);
      }
    },
    []
  );

  // Get account balance
  const getBalance = useCallback(
    async (privateKey: string, accountId: string) => {
      try {
        // Create key pair and get balance
        const keyPair = KeyPair.fromString(privateKey as any);
        const keyStore = new keyStores.InMemoryKeyStore();
        await keyStore.setKey("testnet", accountId, keyPair);

        const near = await connect({
          networkId: "testnet",
          keyStore,
          nodeUrl: "https://rpc.testnet.near.org",
        });

        const account = await near.account(accountId);
        const balance = await account.getAccountBalance();

        const formattedBalance = utils.format.formatNearAmount(balance.total);

        setWalletState((prev) => ({
          ...prev,
          balance: formattedBalance,
        }));

        return formattedBalance;
      } catch (error) {
        console.error("Failed to get balance:", error);
        setWalletState((prev) => ({
          ...prev,
          error:
            error instanceof Error ? error.message : "Failed to get balance",
        }));
        return null;
      }
    },
    []
  );

  // Transfer NEAR to another account
  const transferNear = useCallback(
    async (
      privateKey: string,
      accountId: string,
      receiverId: string,
      amount: string
    ) => {
      setWalletState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Create key pair from private key
        const keyPair = KeyPair.fromString(privateKey as any);

        // Configure NEAR connection
        const keyStore = new keyStores.InMemoryKeyStore();
        await keyStore.setKey("testnet", accountId, keyPair);

        const near = await connect({
          networkId: "testnet",
          keyStore,
          nodeUrl: "https://rpc.testnet.near.org",
        });

        // Create account object
        const account = await near.account(accountId);

        // Convert amount to yoctoNEAR
        const transferAmount = utils.format.parseNearAmount(amount);

        // Create transfer transaction
        const transaction = {
          signerId: accountId,
          receiverId: receiverId,
          actions: [
            {
              type: "Transfer",
              params: {
                deposit: transferAmount || "0",
              },
            },
          ],
        };

        // Sign and send transaction
        const result = await account.signAndSendTransaction(transaction as any);

        setWalletState((prev) => ({ ...prev, isLoading: false }));

        return {
          success: true,
          transactionHash: result.transaction.hash,
        };
      } catch (error) {
        console.error("Failed to transfer NEAR:", error);
        setWalletState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to transfer NEAR",
        }));

        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to transfer NEAR",
        };
      }
    },
    []
  );

  return {
    // State
    ...walletState,
    deposits,
    isLoadingDeposits,

    // Actions
    connectWallet,
    disconnectWallet,
    makeDeposit,
    getDeposits,
    getBalance,
    transferNear,
  };
}
