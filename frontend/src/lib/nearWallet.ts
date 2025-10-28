import { connect, keyStores, KeyPair, Account } from "near-api-js";

const FILE_NAME = "nearWallet.ts";

// Network selection: default to mainnet, override via env
const BLOCKCHAIN_NET =
  (process.env.NEXT_PUBLIC_NEAR_NETWORK_ID as string) || "mainnet";

// Intea RPC API Key
const INTEA_API_KEY =
  process.env.INTEA_API_KEY ||
  "TEMP648WSeY9y1XDyiAHL2KMbZxxnn3Tq4Dxggdd3eGniSy2";

function getNetworkUrls(networkId: string) {
  if (networkId === "testnet") {
    return {
      nodeUrl: "https://rpc.intea.rs",
      walletUrl: "https://wallet.testnet.near.org",
      helperUrl: "https://helper.testnet.near.org",
    };
  }
  return {
    nodeUrl: "https://rpc.intea.rs",
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
    console.log(
      `[NEAR Wallet] Initializing connection for account: ${accountId}`
    );
    console.log(`[NEAR Wallet] Using network: ${BLOCKCHAIN_NET}`);
    console.log(
      `[NEAR Wallet] Intea API Key configured: ${INTEA_API_KEY ? "Yes" : "No"}`
    );

    const keyStore = new PrivateKeyStore(privateKey, accountId);

    // Route RPC via local proxy to avoid CSP
    const urls = getNetworkUrls(BLOCKCHAIN_NET);
    const proxiedRpc = `/api/wallet?action=near-rpc&network=${encodeURIComponent(
      BLOCKCHAIN_NET
    )}`;

    console.log(`[NEAR Wallet] RPC Proxy URL: ${proxiedRpc}`);
    console.log(`[NEAR Wallet] Direct RPC URL: ${urls.nodeUrl}`);

    const near = await connect({
      networkId: BLOCKCHAIN_NET,
      keyStore,
      nodeUrl: proxiedRpc as any,
      walletUrl: urls.walletUrl,
      helperUrl: urls.helperUrl,
    } as any);

    const account = new Account(near.connection, accountId);

    console.log(
      `[NEAR Wallet] Successfully connected to account: ${accountId}`
    );

    return {
      near,
      account,
      accountId,
    };
  } catch (error) {
    console.error(`[NEAR Wallet] Failed to initialize connection:`, error);
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
    console.log(
      `[Account Verification] Checking if account exists: ${accountId}`
    );
    console.log(`[Account Verification] Using Intea RPC via proxy`);

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

    console.log(`[Account Verification] Response status: ${response.status}`);

    if (!response.ok) {
      console.log(
        `[Account Verification] Account ${accountId} does not exist (HTTP ${response.status})`
      );
      return false;
    }

    const data = await response.json();

    // If the account exists, we'll get account info
    // If it doesn't exist, we'll get an error
    const exists = !data.error && data.result;
    console.log(
      `[Account Verification] Account ${accountId} exists: ${exists}`
    );
    return exists;
  } catch (error) {
    console.error(
      `[Account Verification] Error verifying account ${accountId}:`,
      error
    );
    return false;
  }
};
