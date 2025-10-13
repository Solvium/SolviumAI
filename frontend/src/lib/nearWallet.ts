import { connect, keyStores, KeyPair, Account } from "near-api-js";

const FILE_NAME = "nearWallet.ts";

// Network selection: default to mainnet, override via env
const BLOCKCHAIN_NET =
  (process.env.NEXT_PUBLIC_NEAR_NETWORK_ID as string) || "mainnet";

// FastNear API Key
const FASTNEAR_API_KEY = "TEMP648WSeY9y1XDyiAHL2KMbZxxnn3Tq4Dxggdd3eGniSy2";

function getNetworkUrls(networkId: string) {
  if (networkId === "testnet") {
    return {
      nodeUrl: `https://rpc.testnet.fastnear.com?apiKey=${FASTNEAR_API_KEY}`,
      walletUrl: "https://wallet.testnet.near.org",
      helperUrl: "https://helper.testnet.near.org",
    };
  }
  return {
    nodeUrl: `https://rpc.mainnet.fastnear.com?apiKey=${FASTNEAR_API_KEY}`,
    walletUrl: "https://wallet.mainnet.near.org",
    helperUrl: "https://helper.mainnet.near.org",
  };
}

// Custom key store for private key usage
export class PrivateKeyStore extends keyStores.KeyStore {
  private privateKey: string;
  private accountId: string;

  constructor(privateKey: string, accountId: string) {
    super();

    this.privateKey = privateKey;
    this.accountId = accountId;
  }

  async setKey(
    networkId: string,
    accountId: string,
    keyPair: KeyPair
  ): Promise<void> {
    // Implementation for setting key
  }

  async getKey(networkId: string, accountId: string): Promise<KeyPair> {
    if (accountId === this.accountId) {
      try {
        const keyPair = KeyPair.fromString(this.privateKey as any);

        return keyPair;
      } catch (error) {
        throw new Error(`Failed to create KeyPair: ${error}`);
      }
    }

    throw new Error(`Key not found for account ${accountId}`);
  }

  async removeKey(networkId: string, accountId: string): Promise<void> {
    // Implementation for removing key
  }

  async clear(): Promise<void> {
    // Implementation for clearing all keys
  }

  async getAccounts(networkId: string): Promise<string[]> {
    return [this.accountId];
  }

  async getNetworks(): Promise<string[]> {
    return [BLOCKCHAIN_NET];
  }
}

// Initialize NEAR connection with private key
export const initializeNearWithPrivateKey = async (
  privateKey: string,
  accountId: string
) => {
  try {
    const keyStore = new PrivateKeyStore(privateKey, accountId);

    // Route RPC via local proxy to avoid CSP
    const urls = getNetworkUrls(BLOCKCHAIN_NET);
    const proxiedRpc = `/api/wallet?action=near-rpc&network=${encodeURIComponent(
      BLOCKCHAIN_NET
    )}`;
    const near = await connect({
      networkId: BLOCKCHAIN_NET,
      keyStore,
      nodeUrl: proxiedRpc as any,
      walletUrl: urls.walletUrl,
      helperUrl: urls.helperUrl,
    } as any);

    const account = new Account(near.connection, accountId);

    return {
      near,
      account,
      accountId,
    };
  } catch (error) {
    throw error;
  }
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
      methodName: "ft_transfer_call",
      args: actions,
      gas: BigInt(gas),
      attachedDeposit: BigInt(deposit),
    });

    return result;
  } catch (error) {
    throw error;
  }
};

// Check if token is registered for the account
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
    return null;
  }
};

// Register token for the account
export const registerToken = async (
  account: Account,
  tokenId: string,
  accountId: string
) => {
  try {
    const result = await account.functionCall({
      contractId: tokenId,
      methodName: "storage_deposit",
      args: { account_id: accountId, registration_only: true },
      gas: BigInt("300000000000000"),
      attachedDeposit: BigInt("1250000000000000000000"),
    });

    return result;
  } catch (error) {
    throw error;
  }
};

// Verify if a NEAR account exists
export const verifyAccountExists = async (
  accountId: string
): Promise<boolean> => {
  try {
    const response = await fetch("/api/wallet?action=near-rpc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "verify-account",
        method: "query",
        params: {
          request_type: "view_account",
          finality: "final",
          account_id: accountId,
        },
      }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();

    // If the account exists, we'll get account info
    // If it doesn't exist, we'll get an error
    return !data.error && data.result;
  } catch (error) {
    console.error("Error verifying account:", error);
    return false;
  }
};
