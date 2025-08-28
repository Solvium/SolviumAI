import {
  connect,
  keyStores,
  KeyPair,
  WalletConnection,
  Account,
} from "near-api-js";
import { BLOCKCHAIN_NET } from "../components/constants/contractId";

// Create a custom key store for private key usage
export class PrivateKeyStore extends keyStores.KeyStore {
  private keyPair: KeyPair;
  private accountId: string;

  constructor(privateKey: string, accountId: string) {
    super();
    this.keyPair = KeyPair.fromString(privateKey);
    this.accountId = accountId;
  }

  async getKey(networkId: string, accountId: string): Promise<KeyPair> {
    if (accountId === this.accountId) {
      return this.keyPair;
    }
    throw new Error(`Key not found for account ${accountId}`);
  }

  async setKey(
    networkId: string,
    accountId: string,
    keyPair: KeyPair
  ): Promise<void> {
    // This is a read-only key store for private key usage
    throw new Error("Cannot set key in PrivateKeyStore");
  }

  async removeKey(networkId: string, accountId: string): Promise<void> {
    throw new Error("Cannot remove key from PrivateKeyStore");
  }

  async clear(): Promise<void> {
    throw new Error("Cannot clear PrivateKeyStore");
  }

  async getNetworks(): Promise<string[]> {
    return [BLOCKCHAIN_NET];
  }

  async getAccounts(networkId: string): Promise<string[]> {
    return [this.accountId];
  }
}

// Initialize NEAR connection with private key
export const initializeNearWithPrivateKey = async (
  privateKey: string,
  accountId: string
) => {
  const keyStore = new PrivateKeyStore(privateKey, accountId);

  const near = await connect({
    networkId: BLOCKCHAIN_NET,
    keyStore,
    nodeUrl:
      BLOCKCHAIN_NET === "mainnet"
        ? "https://rpc.mainnet.near.org"
        : "https://rpc.testnet.near.org",
    walletUrl:
      BLOCKCHAIN_NET === "mainnet"
        ? "https://wallet.near.org"
        : "https://wallet.testnet.near.org",
    helperUrl:
      BLOCKCHAIN_NET === "mainnet"
        ? "https://helper.mainnet.near.org"
        : "https://helper.testnet.near.org",
    explorerUrl:
      BLOCKCHAIN_NET === "mainnet"
        ? "https://explorer.mainnet.near.org"
        : "https://explorer.testnet.near.org",
  });

  const account = new Account(near.connection, accountId);

  return {
    near,
    account,
    accountId,
    keyPair: keyStore.keyPair,
  };
};

// Sign and send transaction using private key
export const signAndSendTransaction = async (
  account: Account,
  receiverId: string,
  actions: any[],
  gas: string = "300000000000000",
  deposit: string = "0"
) => {
  try {
    const result = await account.functionCall({
      contractId: receiverId,
      methodName: actions[0].params.methodName,
      args: actions[0].params.args,
      gas: gas,
      attachedDeposit: deposit,
    });

    return result;
  } catch (error) {
    console.error("Transaction failed:", error);
    throw error;
  }
};

// Check token registration
export const checkTokenRegistration = async (
  account: Account,
  tokenAddress: string,
  accountId: string
) => {
  try {
    const result = await account.viewFunction({
      contractId: tokenAddress,
      methodName: "storage_balance_of",
      args: { account_id: accountId },
    });
    return result;
  } catch (error) {
    console.error("Token registration check failed:", error);
    return null;
  }
};

// Register token
export const registerToken = async (
  account: Account,
  tokenId: string,
  accountId: string
) => {
  try {
    const result = await account.functionCall({
      contractId: tokenId,
      methodName: "storage_deposit",
      args: {
        account_id: accountId,
        registration_only: true,
      },
      gas: "30000000000000",
      attachedDeposit: "1250000000000000000000", // 0.00125 NEAR
    });

    return result;
  } catch (error) {
    console.error("Token registration failed:", error);
    throw error;
  }
};
