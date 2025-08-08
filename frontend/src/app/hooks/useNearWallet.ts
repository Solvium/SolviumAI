import { useState, useCallback } from "react";
import { connect, keyStores, KeyPair, utils, providers } from "near-api-js";

// Test private key for development - replace with real keys in production
const TEST_PRIVATE_KEY =
  "ed25519:67GAt1YMsVXFwudpTca9qKme7RZUAKZ5FhY4PaVuBbVPMU2kMHiUXrXkdAXJn4rxiyFn8JDNCdBmeDWwNqJvYDSR";
const TEST_ACCOUNT_ID = "ajemark0.testnet";

export interface WalletState {
  isConnected: boolean;
  accountId: string;
  balance: string;
  error: string | null;
}

export interface DepositResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export interface Deposit {
  id: string;
  amount: string;
  startTime: number;
  multiplier: number;
  active: boolean;
}

export const useNearWallet = () => {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    accountId: "",
    balance: "0",
    error: null,
  });

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const connectWallet = useCallback(
    async (privateKey?: string, accountId?: string) => {
      setIsLoading(true);
      setState((prev) => ({ ...prev, error: null }));

      try {
        // Use test private key for development, fallback to provided key
        const keyToUse = privateKey || TEST_PRIVATE_KEY;
        const accountToUse = accountId || TEST_ACCOUNT_ID;

        console.log("Connecting to NEAR wallet with test key:", accountToUse);

        const keyStore = new keyStores.InMemoryKeyStore();
        const keyPair = KeyPair.fromString(keyToUse as any);
        await keyStore.setKey("testnet", accountToUse, keyPair);

        const nearConnection = await connect({
          networkId: "testnet",
          keyStore,
          nodeUrl: "/api/near-rpc",
        });

        const account = await nearConnection.account(accountToUse);

        // Get balance
        const balance = await account.getAccountBalance();
        const balanceInNEAR = utils.format.formatNearAmount(balance.total);

        setState({
          isConnected: true,
          accountId: accountToUse,
          balance: balanceInNEAR,
          error: null,
        });

        console.log("Wallet connected successfully:", accountToUse);
        console.log("Balance:", balanceInNEAR, "NEAR");
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error ? error.message : "Failed to connect wallet",
        }));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const disconnectWallet = useCallback(() => {
    setState({
      isConnected: false,
      accountId: "",
      balance: "0",
      error: null,
    });
    setDeposits([]);
  }, []);

  const makeDeposit = useCallback(
    async (
      amount: string,
      privateKey?: string,
      accountId?: string
    ): Promise<DepositResult> => {
      try {
        const keyToUse = privateKey || TEST_PRIVATE_KEY;
        const accountToUse = accountId || TEST_ACCOUNT_ID;

        console.log("Making deposit:", amount, "NEAR to", accountToUse);

        const keyStore = new keyStores.InMemoryKeyStore();
        const keyPair = KeyPair.fromString(keyToUse as any);
        await keyStore.setKey("testnet", accountToUse, keyPair);

        const nearConnection = await connect({
          networkId: "testnet",
          keyStore,
          nodeUrl: "/api/near-rpc",
        });

        const account = await nearConnection.account(accountToUse);
        const contractId =
          process.env.NEXT_PUBLIC_CONTRACT_ID || "solviumpuzzlegame.testnet";

        // Convert amount to yoctoNEAR
        const depositAmount = utils.format.parseNearAmount(amount);
        if (!depositAmount) {
          throw new Error("Invalid amount");
        }

        // Create transaction
        const transaction = {
          signerId: accountToUse,
          receiverId: contractId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "depositToGame",
                args: {},
                gas: "30000000000000",
                deposit: depositAmount,
              },
            },
          ],
        };

        // Sign and send transaction
        const result = await account.signAndSendTransaction(transaction as any);

        console.log("Deposit successful:", result.transaction.hash);

        return {
          success: true,
          transactionHash: result.transaction.hash,
        };
      } catch (error) {
        console.error("Deposit failed:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Deposit failed",
        };
      }
    },
    []
  );

  const getDeposits = useCallback(
    async (privateKey?: string, accountId?: string) => {
      try {
        const keyToUse = privateKey || TEST_PRIVATE_KEY;
        const accountToUse = accountId || TEST_ACCOUNT_ID;

        console.log("Fetching deposits for:", accountToUse);

        const keyStore = new keyStores.InMemoryKeyStore();
        const keyPair = KeyPair.fromString(keyToUse as any);
        await keyStore.setKey("testnet", accountToUse, keyPair);

        const nearConnection = await connect({
          networkId: "testnet",
          keyStore,
          nodeUrl: "/api/near-rpc",
        });

        const account = await nearConnection.account(accountToUse);
        const contractId =
          process.env.NEXT_PUBLIC_CONTRACT_ID || "solviumpuzzlegame.testnet";

        // Call view method to get deposits
        const depositsResult = await account.viewFunction({
          contractId,
          methodName: "getDeposits",
          args: { accountId: accountToUse },
        });

        console.log("Deposits fetched:", depositsResult);

        // Transform deposits data
        const transformedDeposits: Deposit[] = depositsResult.map(
          (deposit: any) => ({
            id: deposit.id,
            amount: utils.format.formatNearAmount(deposit.amount),
            startTime: Number(deposit.startTime) / 1000000, // Convert to milliseconds
            multiplier: Number(deposit.multiplier) / 1e16,
            active: true, // You might want to calculate this based on time
          })
        );

        setDeposits(transformedDeposits);
      } catch (error) {
        console.error("Failed to fetch deposits:", error);
        setDeposits([]);
      }
    },
    []
  );

  const getBalance = useCallback(
    async (privateKey?: string, accountId?: string) => {
      try {
        const keyToUse = privateKey || TEST_PRIVATE_KEY;
        const accountToUse = accountId || TEST_ACCOUNT_ID;

        const keyStore = new keyStores.InMemoryKeyStore();
        const keyPair = KeyPair.fromString(keyToUse as any);
        await keyStore.setKey("testnet", accountToUse, keyPair);

        const nearConnection = await connect({
          networkId: "testnet",
          keyStore,
          nodeUrl: "/api/near-rpc",
        });

        const account = await nearConnection.account(accountToUse);
        const balance = await account.getAccountBalance();
        const balanceInNEAR = utils.format.formatNearAmount(balance.total);

        setState((prev) => ({
          ...prev,
          balance: balanceInNEAR,
        }));

        return balanceInNEAR;
      } catch (error) {
        console.error("Failed to get balance:", error);
        return "0";
      }
    },
    []
  );

  const transferNear = useCallback(
    async (
      receiverId: string,
      amount: string,
      privateKey?: string,
      accountId?: string
    ): Promise<DepositResult> => {
      try {
        const keyToUse = privateKey || TEST_PRIVATE_KEY;
        const accountToUse = accountId || TEST_ACCOUNT_ID;

        const keyStore = new keyStores.InMemoryKeyStore();
        const keyPair = KeyPair.fromString(keyToUse as any);
        await keyStore.setKey("testnet", accountToUse, keyPair);

        const nearConnection = await connect({
          networkId: "testnet",
          keyStore,
          nodeUrl: "/api/near-rpc",
        });

        const account = await nearConnection.account(accountToUse);
        const transferAmount = utils.format.parseNearAmount(amount);

        if (!transferAmount) {
          throw new Error("Invalid amount");
        }

        const transaction = {
          signerId: accountToUse,
          receiverId,
          actions: [
            {
              type: "Transfer",
              params: {
                deposit: transferAmount,
              },
            },
          ],
        };

        const result = await account.signAndSendTransaction(transaction as any);

        return {
          success: true,
          transactionHash: result.transaction.hash,
        };
      } catch (error) {
        console.error("Transfer failed:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Transfer failed",
        };
      }
    },
    []
  );

  return {
    state,
    deposits,
    isLoading,
    connectWallet,
    disconnectWallet,
    makeDeposit,
    getDeposits,
    getBalance,
    transferNear,
  };
};
