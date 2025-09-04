import { connect, keyStores, KeyPair, Account } from "near-api-js";

const FILE_NAME = "nearWallet.ts";

// Use testnet as default
const BLOCKCHAIN_NET = "testnet";

// Custom key store for private key usage
export class PrivateKeyStore extends keyStores.KeyStore {
  private privateKey: string;
  private accountId: string;

  constructor(privateKey: string, accountId: string) {
    super();
    console.log(
      `[${FILE_NAME}:constructor] PrivateKeyStore constructor called:`,
      {
        accountId,
        privateKeyLength: privateKey.length,
      }
    );
    this.privateKey = privateKey;
    this.accountId = accountId;
  }

  async setKey(
    networkId: string,
    accountId: string,
    keyPair: KeyPair
  ): Promise<void> {
    console.log(`[${FILE_NAME}:setKey] setKey called:`, {
      networkId,
      accountId,
      keyPairType: keyPair.constructor.name,
    });
    // Implementation for setting key
  }

  async getKey(networkId: string, accountId: string): Promise<KeyPair> {
    console.log(`[${FILE_NAME}:getKey] getKey called:`, {
      networkId,
      accountId,
      requestedAccountId: accountId,
      storedAccountId: this.accountId,
    });

    if (accountId === this.accountId) {
      console.log(
        `[${FILE_NAME}:getKey] Creating KeyPair from stored private key`
      );
      try {
        const keyPair = KeyPair.fromString(this.privateKey as any);
        console.log(`[${FILE_NAME}:getKey] KeyPair created successfully:`, {
          publicKey: keyPair.getPublicKey().toString(),
          keyType: keyPair.constructor.name,
        });
        return keyPair;
      } catch (error) {
        console.error(`[${FILE_NAME}:getKey] Failed to create KeyPair:`, error);
        throw new Error(`Failed to create KeyPair: ${error}`);
      }
    }

    console.log(`[${FILE_NAME}:getKey] Account ID mismatch, throwing error`);
    throw new Error(`Key not found for account ${accountId}`);
  }

  async removeKey(networkId: string, accountId: string): Promise<void> {
    console.log(`[${FILE_NAME}:removeKey] removeKey called:`, {
      networkId,
      accountId,
    });
    // Implementation for removing key
  }

  async clear(): Promise<void> {
    console.log(`[${FILE_NAME}:clear] clear called`);
    // Implementation for clearing all keys
  }

  async getAccounts(networkId: string): Promise<string[]> {
    console.log(`[${FILE_NAME}:getAccounts] getAccounts called:`, {
      networkId,
      storedAccountId: this.accountId,
    });
    return [this.accountId];
  }

  async getNetworks(): Promise<string[]> {
    console.log(`[${FILE_NAME}:getNetworks] getNetworks called`);
    return [BLOCKCHAIN_NET];
  }
}

// Initialize NEAR connection with private key
export const initializeNearWithPrivateKey = async (
  privateKey: string,
  accountId: string
) => {
  console.log(
    `[${FILE_NAME}:initializeNearWithPrivateKey] initializeNearWithPrivateKey called:`,
    {
      accountId,
      privateKeyLength: privateKey.length,
      blockchainNet: BLOCKCHAIN_NET,
    }
  );

  try {
    console.log(
      `[${FILE_NAME}:initializeNearWithPrivateKey] Creating PrivateKeyStore...`
    );
    const keyStore = new PrivateKeyStore(privateKey, accountId);

    console.log(
      `[${FILE_NAME}:initializeNearWithPrivateKey] Connecting to NEAR network...`
    );
    const near = await connect({
      networkId: BLOCKCHAIN_NET,
      keyStore,
      nodeUrl: "https://rpc.testnet.near.org",
      walletUrl: "https://wallet.testnet.near.org",
      helperUrl: "https://helper.testnet.near.org",
    } as any);

    console.log(
      `[${FILE_NAME}:initializeNearWithPrivateKey] NEAR connection established successfully`
    );

    console.log(
      `[${FILE_NAME}:initializeNearWithPrivateKey] Creating Account instance...`
    );
    const account = new Account(near.connection, accountId);

    console.log(
      `[${FILE_NAME}:initializeNearWithPrivateKey] Account instance created:`,
      {
        accountId: account.accountId,
        connectionExists: !!account.connection,
      }
    );

    return {
      near,
      account,
      accountId,
    };
  } catch (error) {
    console.error(
      `[${FILE_NAME}:initializeNearWithPrivateKey] Failed to initialize NEAR:`,
      {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      }
    );
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
  console.log(
    `[${FILE_NAME}:signAndSendTransaction] signAndSendTransaction called:`,
    {
      receiverId,
      actionsCount: actions.length,
      gas,
      deposit,
      accountId: account.accountId,
    }
  );

  try {
    console.log(
      `[${FILE_NAME}:signAndSendTransaction] Executing transaction...`
    );
    const result = await account.functionCall({
      contractId: receiverId,
      methodName: "ft_transfer_call",
      args: actions,
      gas: BigInt(gas),
      attachedDeposit: BigInt(deposit),
    });

    console.log(
      `[${FILE_NAME}:signAndSendTransaction] Transaction successful:`,
      {
        transactionHash: result.transaction.hash,
        blockHash: "transaction completed",
      }
    );

    return result;
  } catch (error) {
    console.error(`[${FILE_NAME}:signAndSendTransaction] Transaction failed:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

// Check if token is registered for the account
export const checkTokenRegistration = async (
  account: Account,
  tokenAddress: string,
  accountId: string
) => {
  console.log(
    `[${FILE_NAME}:checkTokenRegistration] checkTokenRegistration called:`,
    {
      tokenAddress,
      accountId,
    }
  );

  try {
    console.log(
      `[${FILE_NAME}:checkTokenRegistration] Checking token registration...`
    );
    const result = await account.viewFunction({
      contractId: tokenAddress,
      methodName: "storage_balance_of",
      args: { account_id: accountId },
    });

    console.log(
      `[${FILE_NAME}:checkTokenRegistration] Token registration check result:`,
      result
    );
    return result;
  } catch (error) {
    console.log(
      `[${FILE_NAME}:checkTokenRegistration] Token not registered or error occurred:`,
      {
        error: error instanceof Error ? error.message : error,
      }
    );
    return null;
  }
};

// Register token for the account
export const registerToken = async (
  account: Account,
  tokenId: string,
  accountId: string
) => {
  console.log(`[${FILE_NAME}:registerToken] registerToken called:`, {
    tokenId,
    accountId,
  });

  try {
    console.log(`[${FILE_NAME}:registerToken] Registering token...`);
    const result = await account.functionCall({
      contractId: tokenId,
      methodName: "storage_deposit",
      args: { account_id: accountId, registration_only: true },
      gas: BigInt("300000000000000"),
      attachedDeposit: BigInt("1250000000000000000000"),
    });

    console.log(`[${FILE_NAME}:registerToken] Token registration successful:`, {
      transactionHash: result.transaction.hash,
    });

    return result;
  } catch (error) {
    console.error(`[${FILE_NAME}:registerToken] Token registration failed:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};
