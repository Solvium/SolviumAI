import crypto from "crypto";

const FILE_NAME = "crypto.ts";

// Global type declarations
declare global {
  let walletCache: Map<string, SecureWalletData> | undefined;
}

// Types for the SolviumAI API
export interface WalletCheckRequest {
  telegram_user_id: number;
}

export interface WalletInfo {
  account_id: string;
  public_key: string;
  private_key: string;
  is_demo: boolean;
  network: string;
}

export interface WalletCheckResponse {
  has_wallet: boolean;
  message: string;
  wallet_info?: WalletInfo;
  error?: string;
}

export interface SecureWalletData {
  telegramUserId: number;
  walletInfo: WalletInfo;
  encryptedPrivateKey: string;
  encryptionIv: string;
  encryptionTag: string;
  lastUpdated: Date;
  expiresAt: Date;
}

export class SolviumAPIError extends Error {
  public status?: number;
  public code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "SolviumAPIError";
    this.status = status;
    this.code = code;
  }
}

// API configuration
const SOLVIUM_API_BASE_URL =
  process.env.SOLVIUM_API_BASE_URL || "https://solviumaiq.onrender.com";

// Wallet cache configuration
const WALLET_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const WALLET_CACHE_KEY_PREFIX = "solvium_wallet_";

// Secure wallet storage and caching
export class SecureWalletStorage {
  private encryptionKey: Buffer;

  constructor() {
    console.log(
      `[${FILE_NAME}:constructor] SecureWalletStorage constructor called`
    );

    const key = process.env.WALLET_ENCRYPTION_KEY;
    if (!key) {
      console.error(
        `[${FILE_NAME}:constructor] WALLET_ENCRYPTION_KEY environment variable is required`
      );
      throw new Error("WALLET_ENCRYPTION_KEY environment variable is required");
    }

    console.log(
      `[${FILE_NAME}:constructor] WALLET_ENCRYPTION_KEY found, length:`,
      key.length
    );

    const parsedKey = parseEncryptionKey(key);
    if (!parsedKey) {
      console.error(
        `[${FILE_NAME}:constructor] Failed to parse encryption key`
      );
      throw new Error("Failed to parse encryption key");
    }

    this.encryptionKey = parsedKey;
    console.log(
      `[${FILE_NAME}:constructor] Encryption key initialized, length:`,
      this.encryptionKey.length
    );
  }

  /**
   * Encrypt sensitive wallet data
   */
  private encryptWalletData(data: string): {
    encrypted: string;
    iv: string;
    tag: string;
  } {
    console.log(
      `[${FILE_NAME}:encryptWalletData] encryptWalletData called, data length:`,
      data.length
    );

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.encryptionKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(data, "utf8"),
      cipher.final(),
    ]);

    const result = {
      encrypted: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
    };

    console.log(`[${FILE_NAME}:encryptWalletData] Encryption completed:`, {
      encryptedLength: result.encrypted.length,
      ivLength: result.iv.length,
      tagLength: result.tag.length,
    });

    return result;
  }

  /**
   * Decrypt sensitive wallet data
   */
  private decryptWalletData(
    encrypted: string,
    iv: string,
    tag: string
  ): string {
    console.log(`[${FILE_NAME}:decryptWalletData] decryptWalletData called:`, {
      encryptedLength: encrypted.length,
      ivLength: iv.length,
      tagLength: tag.length,
    });

    try {
      const encryptedBuffer = Buffer.from(encrypted, "base64");
      const ivBuffer = Buffer.from(iv, "base64");
      const tagBuffer = Buffer.from(tag, "base64");

      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        ivBuffer
      );
      decipher.setAuthTag(tagBuffer);

      const decrypted = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final(),
      ]);

      const result = decrypted.toString("utf8");
      console.log(
        `[${FILE_NAME}:decryptWalletData] Decryption completed, result length:`,
        result.length
      );

      return result;
    } catch (error) {
      console.error(
        `[${FILE_NAME}:decryptWalletData] Decryption failed:`,
        error
      );
      throw error;
    }
  }

  /**
   * Store wallet data securely in database
   */
  async storeWalletData(
    telegramUserId: number,
    walletInfo: WalletInfo
  ): Promise<void> {
    console.log(
      `[${FILE_NAME}:storeWalletData] storeWalletData called for user:`,
      telegramUserId
    );

    try {
      // Encrypt the private key
      console.log(`[${FILE_NAME}:storeWalletData] Encrypting private key...`);
      const { encrypted, iv, tag } = this.encryptWalletData(
        walletInfo.private_key
      );

      const secureData: SecureWalletData = {
        telegramUserId,
        walletInfo: {
          ...walletInfo,
          private_key: "[ENCRYPTED]", // Don't store plain text private key
        },
        encryptedPrivateKey: encrypted,
        encryptionIv: iv,
        encryptionTag: tag,
        lastUpdated: new Date(),
        expiresAt: new Date(Date.now() + WALLET_CACHE_DURATION),
      };

      // Store in database (you'll need to implement this based on your database)
      await this.saveToDatabase(secureData);

      console.log(
        `[${FILE_NAME}:storeWalletData] Stored wallet data for user ${telegramUserId}`
      );
    } catch (error) {
      console.error(
        `[${FILE_NAME}:storeWalletData] Failed to store wallet data:`,
        error
      );
      throw error;
    }
  }

  /**
   * Retrieve wallet data from database
   */
  async getWalletData(telegramUserId: number): Promise<WalletInfo | null> {
    console.log(
      `[${FILE_NAME}:getWalletData] getWalletData called for user:`,
      telegramUserId
    );

    try {
      const secureData = await this.getFromDatabase(telegramUserId);

      if (!secureData) {
        console.log(
          `[${FILE_NAME}:getWalletData] No secure data found for user:`,
          telegramUserId
        );
        return null;
      }

      // Check if data is expired
      if (new Date() > secureData.expiresAt) {
        console.log(
          `[${FILE_NAME}:getWalletData] Wallet data expired for user ${telegramUserId}`
        );
        await this.deleteFromDatabase(telegramUserId);
        return null;
      }

      // Decrypt the private key
      console.log(`[${FILE_NAME}:getWalletData] Decrypting private key...`);
      const decryptedPrivateKey = this.decryptWalletData(
        secureData.encryptedPrivateKey,
        secureData.encryptionIv,
        secureData.encryptionTag
      );

      const result = {
        ...secureData.walletInfo,
        private_key: decryptedPrivateKey,
      };

      console.log(
        `[${FILE_NAME}:getWalletData] Wallet data retrieved successfully for user:`,
        telegramUserId
      );
      return result;
    } catch (error) {
      console.error(
        `[${FILE_NAME}:getWalletData] Failed to retrieve wallet data:`,
        error
      );
      return null;
    }
  }

  /**
   * Clear wallet data from database
   */
  async clearWalletData(telegramUserId: number): Promise<void> {
    console.log(
      `[${FILE_NAME}:clearWalletData] clearWalletData called for user:`,
      telegramUserId
    );

    try {
      await this.deleteFromDatabase(telegramUserId);
      console.log(
        `[${FILE_NAME}:clearWalletData] Cleared wallet data for user ${telegramUserId}`
      );
    } catch (error) {
      console.error(
        `[${FILE_NAME}:clearWalletData] Failed to clear wallet data:`,
        error
      );
    }
  }

  /**
   * Save wallet data to database
   */
  private async saveToDatabase(data: SecureWalletData): Promise<void> {
    console.log(
      `[${FILE_NAME}:saveToDatabase] saveToDatabase called for user:`,
      data.telegramUserId
    );

    try {
      const { prisma } = await import("@/lib/prisma");

      await prisma.walletCache.upsert({
        where: { telegramUserId: data.telegramUserId },
        update: {
          accountId: data.walletInfo.account_id,
          publicKey: data.walletInfo.public_key,
          encryptedPrivateKey: data.encryptedPrivateKey,
          encryptionIv: data.encryptionIv,
          encryptionTag: data.encryptionTag,
          isDemo: data.walletInfo.is_demo,
          network: data.walletInfo.network,
          lastUpdated: data.lastUpdated,
          expiresAt: data.expiresAt,
        },
        create: {
          telegramUserId: data.telegramUserId,
          accountId: data.walletInfo.account_id,
          publicKey: data.walletInfo.public_key,
          encryptedPrivateKey: data.encryptedPrivateKey,
          encryptionIv: data.encryptionIv,
          encryptionTag: data.encryptionTag,
          isDemo: data.walletInfo.is_demo,
          network: data.walletInfo.network,
          lastUpdated: data.lastUpdated,
          expiresAt: data.expiresAt,
        },
      });

      console.log(
        `[${FILE_NAME}:saveToDatabase] Database save successful for user:`,
        data.telegramUserId
      );
    } catch (error) {
      console.error(
        `[${FILE_NAME}:saveToDatabase] Database save error:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get wallet data from database
   */
  private async getFromDatabase(
    telegramUserId: number
  ): Promise<SecureWalletData | null> {
    console.log(
      `[${FILE_NAME}:getFromDatabase] getFromDatabase called for user:`,
      telegramUserId
    );

    try {
      const { prisma } = await import("@/lib/prisma");

      const cachedData = await prisma.walletCache.findUnique({
        where: { telegramUserId },
      });

      if (!cachedData) {
        console.log(
          `[${FILE_NAME}:getFromDatabase] No cached data found for user:`,
          telegramUserId
        );
        return null;
      }

      console.log(
        `[${FILE_NAME}:getFromDatabase] Cached data found for user:`,
        telegramUserId
      );
      return {
        telegramUserId: cachedData.telegramUserId,
        walletInfo: {
          account_id: cachedData.accountId,
          public_key: cachedData.publicKey,
          private_key: "[ENCRYPTED]", // Will be decrypted when needed
          is_demo: cachedData.isDemo,
          network: cachedData.network,
        },
        encryptedPrivateKey: cachedData.encryptedPrivateKey,
        encryptionIv: cachedData.encryptionIv,
        encryptionTag: cachedData.encryptionTag,
        lastUpdated: cachedData.lastUpdated,
        expiresAt: cachedData.expiresAt,
      };
    } catch (error) {
      console.error(
        `[${FILE_NAME}:getFromDatabase] Database retrieval error:`,
        error
      );
      return null;
    }
  }

  /**
   * Delete wallet data from database
   */
  private async deleteFromDatabase(telegramUserId: number): Promise<void> {
    console.log(
      `[${FILE_NAME}:deleteFromDatabase] deleteFromDatabase called for user:`,
      telegramUserId
    );

    try {
      const { prisma } = await import("@/lib/prisma");

      await prisma.walletCache.delete({
        where: { telegramUserId },
      });

      console.log(
        `[${FILE_NAME}:deleteFromDatabase] Database deletion successful for user:`,
        telegramUserId
      );
    } catch (error) {
      console.error(
        `[${FILE_NAME}:deleteFromDatabase] Database deletion error:`,
        error
      );
      throw error;
    }
  }
}

// Secure API client for SolviumAI wallet operations
export class SolviumWalletAPI {
  private baseUrl: string;
  private apiKey?: string;
  private secureStorage: SecureWalletStorage;

  constructor(baseUrl?: string, apiKey?: string) {
    console.log(
      `[${FILE_NAME}:constructor] SolviumWalletAPI constructor called:`,
      {
        baseUrl: baseUrl || SOLVIUM_API_BASE_URL,
        hasApiKey: !!apiKey,
      }
    );

    this.baseUrl = baseUrl || SOLVIUM_API_BASE_URL;
    this.apiKey = apiKey || process.env.SOLVIUM_API_KEY;
    this.secureStorage = new SecureWalletStorage();
  }

  /**
   * Check wallet information for a Telegram user with caching
   * @param telegramUserId - The Telegram user ID
   * @param forceRefresh - Force refresh from API (bypass cache)
   * @returns Promise<WalletCheckResponse>
   */
  async checkWallet(
    telegramUserId: number,
    forceRefresh: boolean = false
  ): Promise<WalletCheckResponse> {
    console.log(`[${FILE_NAME}:checkWallet] checkWallet called:`, {
      telegramUserId,
      forceRefresh,
    });

    try {
      // First, try to get from cache if not forcing refresh
      if (!forceRefresh) {
        console.log(
          `[${FILE_NAME}:checkWallet] Checking cache for user:`,
          telegramUserId
        );
        const cachedWallet = await this.secureStorage.getWalletData(
          telegramUserId
        );
        if (cachedWallet) {
          console.log(
            `[${FILE_NAME}:checkWallet] Using cached wallet data for user ${telegramUserId}`
          );
          return {
            has_wallet: true,
            message: "Wallet data retrieved from cache",
            wallet_info: cachedWallet,
          };
        }
      }

      // If not in cache or force refresh, fetch from API
      const requestBody: WalletCheckRequest = {
        telegram_user_id: telegramUserId,
      };

      console.log(
        `[${FILE_NAME}:checkWallet] Fetching wallet data from API for user`,
        telegramUserId
      );

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Solvium-Frontend/1.0.0",
      };

      // Add API key if available
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.baseUrl}/wallet/check`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        // Security: Set reasonable timeouts
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `API request failed: ${response.status} ${response.statusText} - ${errorText}`;
        console.error(`[${FILE_NAME}:checkWallet] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const data = await response.json();

      // Validate response structure
      if (typeof data !== "object" || data === null) {
        const errorMsg = "Invalid response format from API";
        console.error(`[${FILE_NAME}:checkWallet] ${errorMsg}:`, data);
        throw new Error(errorMsg);
      }

      const walletResponse = data as WalletCheckResponse;

      // If wallet was found, store it securely
      if (walletResponse.has_wallet && walletResponse.wallet_info) {
        try {
          console.log(
            `[${FILE_NAME}:checkWallet] Storing wallet data in cache for user:`,
            telegramUserId
          );
          await this.secureStorage.storeWalletData(
            telegramUserId,
            walletResponse.wallet_info
          );
          console.log(
            `[${FILE_NAME}:checkWallet] Stored wallet data for user ${telegramUserId}`
          );
        } catch (storageError) {
          console.warn(
            `[${FILE_NAME}:checkWallet] Failed to store wallet data:`,
            storageError
          );
          // Don't fail the request if storage fails
        }
      }

      return walletResponse;
    } catch (error) {
      console.error(`[${FILE_NAME}:checkWallet] Error checking wallet:`, error);

      // Handle different types of errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new SolviumAPIError(
          "Network error: Unable to connect to SolviumAI API"
        );
      }

      if (error instanceof Error) {
        throw new SolviumAPIError(error.message);
      }

      throw new SolviumAPIError("Unknown error occurred while checking wallet");
    }
  }

  /**
   * Get API health status
   * @returns Promise<boolean>
   */
  async checkHealth(): Promise<boolean> {
    console.log(`[${FILE_NAME}:checkHealth] checkHealth called`);

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Solvium-Frontend/1.0.0",
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        console.log(
          `[${FILE_NAME}:checkHealth] Health check failed, status:`,
          response.status
        );
        return false;
      }

      const data = await response.json();
      const isHealthy = data.status === "healthy";

      console.log(`[${FILE_NAME}:checkHealth] Health check result:`, isHealthy);
      return isHealthy;
    } catch (error) {
      console.error(`[${FILE_NAME}:checkHealth] Health check failed:`, error);
      return false;
    }
  }

  /**
   * Securely store wallet information after successful check
   * @param telegramUserId - The Telegram user ID
   * @param walletInfo - The wallet information to store
   */
  async storeWalletInfo(
    telegramUserId: number,
    walletInfo: WalletInfo
  ): Promise<void> {
    console.log(
      `[${FILE_NAME}:storeWalletInfo] storeWalletInfo called for user:`,
      telegramUserId
    );
    await this.secureStorage.storeWalletData(telegramUserId, walletInfo);
  }

  /**
   * Retrieve securely stored wallet information
   * @param telegramUserId - The Telegram user ID
   * @returns Promise<WalletInfo | null>
   */
  async getWalletInfo(telegramUserId: number): Promise<WalletInfo | null> {
    console.log(
      `[${FILE_NAME}:getWalletInfo] getWalletInfo called for user:`,
      telegramUserId
    );
    return this.secureStorage.getWalletData(telegramUserId);
  }

  /**
   * Clear securely stored wallet information
   * @param telegramUserId - The Telegram user ID
   */
  async clearWalletInfo(telegramUserId: number): Promise<void> {
    console.log(
      `[${FILE_NAME}:clearWalletInfo] clearWalletInfo called for user:`,
      telegramUserId
    );
    await this.secureStorage.clearWalletData(telegramUserId);
  }
}

// Export a default instance
export const solviumWalletAPI = new SolviumWalletAPI();

/**
 * Utility function to safely check wallet information with caching
 * @param telegramUserId - The Telegram user ID
 * @param forceRefresh - Force refresh from API (bypass cache)
 * @returns Promise<WalletCheckResponse | null> - Returns null if wallet not found or error occurs
 */
export async function getWalletInfo(
  telegramUserId: number,
  forceRefresh: boolean = false
): Promise<WalletCheckResponse | null> {
  console.log(`[${FILE_NAME}:getWalletInfo] getWalletInfo called:`, {
    telegramUserId,
    forceRefresh,
  });

  try {
    // First check if the API is healthy (only if not using cache)
    if (forceRefresh) {
      console.log(`[${FILE_NAME}:getWalletInfo] Checking API health...`);
      const isHealthy = await solviumWalletAPI.checkHealth();
      if (!isHealthy) {
        console.warn(
          `[${FILE_NAME}:getWalletInfo] SolviumAI API is not healthy`
        );
        return null;
      }
    }

    // Check wallet information (with caching)
    const walletInfo = await solviumWalletAPI.checkWallet(
      telegramUserId,
      forceRefresh
    );

    console.log(
      `[${FILE_NAME}:getWalletInfo] getWalletInfo completed for user:`,
      telegramUserId
    );
    return walletInfo;
  } catch (error) {
    console.error(
      `[${FILE_NAME}:getWalletInfo] Failed to get wallet info:`,
      error
    );
    return null;
  }
}

export function parseEncryptionKey(keyInput?: string): Buffer | null {
  console.log(`[${FILE_NAME}:parseEncryptionKey] parseEncryptionKey called:`, {
    hasKeyInput: !!keyInput,
    keyInputLength: keyInput?.length || 0,
  });

  if (!keyInput) {
    console.log(`[${FILE_NAME}:parseEncryptionKey] No key input provided`);
    return null;
  }

  // Accept base64 or hex; try base64 first then hex
  try {
    const b64 = Buffer.from(keyInput, "base64");
    if (b64.length === 32) {
      console.log(
        `[${FILE_NAME}:parseEncryptionKey] Successfully parsed base64 key, length:`,
        b64.length
      );
      return b64;
    }
  } catch (e) {
    console.log(`[${FILE_NAME}:parseEncryptionKey] Base64 parsing failed:`, e);
  }

  try {
    const hex = Buffer.from(keyInput, "hex");
    if (hex.length === 32) {
      console.log(
        `[${FILE_NAME}:parseEncryptionKey] Successfully parsed hex key, length:`,
        hex.length
      );
      return hex;
    }
  } catch (e) {
    console.log(`[${FILE_NAME}:parseEncryptionKey] Hex parsing failed:`, e);
  }

  console.log(
    `[${FILE_NAME}:parseEncryptionKey] Failed to parse key in any format`
  );
  return null;
}

export function decryptAes256Gcm(
  encryptedPrivateKey: string,
  iv: string,
  tag: string,
  keyBytes: Buffer
): string {
  console.log(`[${FILE_NAME}:decryptAes256Gcm] decryptAes256Gcm called:`, {
    encryptedLength: encryptedPrivateKey.length,
    ivLength: iv.length,
    tagLength: tag.length,
    keyLength: keyBytes.length,
  });

  try {
    // Decode base64 strings to bytes (matching Python's base64.b64decode)
    const encryptedBytes = Buffer.from(encryptedPrivateKey, "base64");
    const ivBytes = Buffer.from(iv, "base64");
    const tagBytes = Buffer.from(tag, "base64");

    console.log(`[${FILE_NAME}:decryptAes256Gcm] Decoded base64 data:`, {
      encryptedBytesLength: encryptedBytes.length,
      ivBytesLength: ivBytes.length,
      tagBytesLength: tagBytes.length,
    });

    // Decrypt data using AES-256-GCM (matching Python's Cipher/decryptor)
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes, ivBytes);
    decipher.setAuthTag(tagBytes);

    const plaintext = Buffer.concat([
      decipher.update(encryptedBytes),
      decipher.final(),
    ]);

    const result = plaintext.toString("utf8");
    console.log(
      `[${FILE_NAME}:decryptAes256Gcm] Decryption successful, result length:`,
      result.length
    );

    // Return as UTF-8 string (matching Python's plaintext.decode())
    return result;
  } catch (error) {
    console.error(
      `[${FILE_NAME}:decryptAes256Gcm] Error decrypting private key:`,
      error
    );
    throw error;
  }
}
