// Simplified crypto library - only keeping what's needed for the working wallet check route

// Import existing types from miniAppApi
import type {
  MiniAppGetOrCreateRequest,
  MiniAppGetOrCreateResponse,
} from "./miniAppApi";
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

// Import mini app API types and functions
export type {
  MiniAppUser,
  MiniAppWallet,
  MiniAppGetOrCreateResponse,
  MiniAppGetOrCreateRequest,
} from "./miniAppApi";

import { getOrCreateUserFromMiniApp } from "./miniAppApi";

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

// Resolve external API base URL from env (must be absolute http(s) URL)
function resolveExternalApiBaseUrl(): string {
  const raw =
    process.env.SOLVIUM_API_BASE_URL ||
    process.env.NEXT_PUBLIC_SOLVIUM_API_BASE_URL ||
    "";
  if (!raw) {
    throw new Error(
      "Missing SOLVIUM_API_BASE_URL (or NEXT_PUBLIC_SOLVIUM_API_BASE_URL) in environment"
    );
  }
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error(
      "SOLVIUM_API_BASE_URL must be an absolute http(s) URL (e.g., https://api.example.com)"
    );
  }
  return raw.replace(/\/$/, "");
}

// Simple API client for SolviumAI wallet operations
export class SolviumWalletAPI {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = (baseUrl || resolveExternalApiBaseUrl()).replace(/\/$/, "");
    this.apiKey = apiKey || process.env.SOLVIUM_API_KEY;
  }

  /**
   * Check wallet information for a Telegram user
   * @param telegramUserId - The Telegram user ID
   * @returns Promise<WalletCheckResponse>
   */
  async checkWallet(telegramUserId: number): Promise<WalletCheckResponse> {
    try {
      const requestBody: WalletCheckRequest = {
        telegram_user_id: telegramUserId,
      };

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
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `API request failed: ${response.status} ${response.statusText} - ${errorText}`;
        throw new Error(errorMsg);
      }

      const data = await response.json();

      // Validate response structure
      if (typeof data !== "object" || data === null) {
        throw new Error("Invalid response format from API");
      }

      return data as WalletCheckResponse;
    } catch (error) {
      console.error("Error checking wallet:", error);

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
   * Get or create user from mini app API
   * @param request - The mini app request data
   * @returns Promise<MiniAppGetOrCreateResponse>
   */
  async getOrCreateUserFromMiniApp(
    request: MiniAppGetOrCreateRequest
  ): Promise<MiniAppGetOrCreateResponse> {
    try {
      const response = await getOrCreateUserFromMiniApp(request);
      if (!response) {
        throw new SolviumAPIError("Failed to get or create user from mini app");
      }
      return response;
    } catch (error) {
      if (error instanceof SolviumAPIError) {
        throw error;
      }
      throw new SolviumAPIError(
        "Unknown error occurred while calling mini app API"
      );
    }
  }

  /**
   * Get API health status
   * @returns Promise<boolean>
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/wallet/check`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Solvium-Frontend/1.0.0",
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.status === "healthy";
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  }
}

// Export a default instance
export const solviumWalletAPI = new SolviumWalletAPI(
  process.env.SOLVIUM_API_BASE_URL,
  process.env.SOLVIUM_API_KEY
);

/**
 * Utility function to safely check wallet information
 * @param telegramUserId - The Telegram user ID
 * @returns Promise<WalletCheckResponse | null> - Returns null if wallet not found or error occurs
 */
export async function getWalletInfo(
  telegramUserId: number
): Promise<WalletCheckResponse | null> {
  try {
    const walletInfo = await solviumWalletAPI.checkWallet(telegramUserId);
    return walletInfo;
  } catch (error) {
    console.error("Failed to get wallet info:", error);
    return null;
  }
}
