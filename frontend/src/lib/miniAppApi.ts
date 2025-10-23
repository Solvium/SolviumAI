// Mini App API client for SolviumAI integration
// Handles communication with the quiz.solviumgame.xyz API

export interface MiniAppUser {
  telegram_user_id: number;
  username: string;
  first_name: string;
  last_name?: string | null;
}

export interface MiniAppWallet {
  account_id: string;
  public_key: string;
  network: string;
  created_at: string | null;
}

export interface MiniAppGetOrCreateResponse {
  success: boolean;
  user_exists: boolean;
  user: MiniAppUser;
  wallet: MiniAppWallet;
  message: string;
}

export interface MiniAppGetOrCreateRequest {
  telegram_user_id: number;
  username: string;
  first_name: string;
}

export class MiniAppAPIError extends Error {
  public status?: number;
  public code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "MiniAppAPIError";
    this.status = status;
    this.code = code;
  }
}

export class MiniAppAPIClient {
  private baseUrl: string;
  private apiSecret: string;

  constructor() {
    this.baseUrl = "https://quiz.solviumgame.xyz";
    this.apiSecret = process.env.MINI_APP_API_SECRET || "";

    if (!this.apiSecret) {
      throw new Error("MINI_APP_API_SECRET environment variable is required");
    }
  }

  /**
   * Get or create user and wallet from mini app API
   * @param request - The request data
   * @returns Promise<MiniAppGetOrCreateResponse>
   */
  async getOrCreateUser(
    request: MiniAppGetOrCreateRequest
  ): Promise<MiniAppGetOrCreateResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/wallet/get-or-create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Secret": this.apiSecret,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage += ` - ${errorText}`;
        }

        throw new MiniAppAPIError(errorMessage, response.status);
      }

      const data = await response.json();

      // Validate response structure
      if (typeof data !== "object" || data === null) {
        throw new MiniAppAPIError("Invalid response format from mini app API");
      }

      // Validate required fields
      if (typeof data.success !== "boolean") {
        throw new MiniAppAPIError("Invalid response: missing success field");
      }

      if (!data.user || !data.wallet) {
        throw new MiniAppAPIError(
          "Invalid response: missing user or wallet data"
        );
      }

      return data as MiniAppGetOrCreateResponse;
    } catch (error) {
      console.error("Error calling mini app API:", error);

      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new MiniAppAPIError(
          "Network error: Unable to connect to mini app API"
        );
      }

      if (error instanceof MiniAppAPIError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new MiniAppAPIError(error.message);
      }

      throw new MiniAppAPIError(
        "Unknown error occurred while calling mini app API"
      );
    }
  }

  /**
   * Check if the mini app API is healthy
   * @returns Promise<boolean>
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Try a simple request to check if the API is accessible
      const response = await fetch(`${this.baseUrl}/wallet/get-or-create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Secret": this.apiSecret,
        },
        body: JSON.stringify({
          telegram_user_id: 0, // Invalid ID to test connectivity
          username: "test",
          first_name: "test",
        }),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      // Even if it returns an error, if we get a response, the API is accessible
      return response.status !== 0;
    } catch (error) {
      console.error("Mini app API health check failed:", error);
      return false;
    }
  }
}

// Export a default instance
export const miniAppAPI = new MiniAppAPIClient();

/**
 * Utility function to safely get or create user from mini app API
 * @param request - The request data
 * @returns Promise<MiniAppGetOrCreateResponse | null> - Returns null if error occurs
 */
export async function getOrCreateUserFromMiniApp(
  request: MiniAppGetOrCreateRequest
): Promise<MiniAppGetOrCreateResponse | null> {
  try {
    const response = await miniAppAPI.getOrCreateUser(request);
    return response;
  } catch (error) {
    console.error("Failed to get or create user from mini app:", error);
    return null;
  }
}
