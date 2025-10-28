// Simple in-memory rate limiter for Nearblocks API
// 6 calls per minute = 1 call per 10 seconds

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 6, windowMs: number = 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const entry = this.requests.get(key);

    if (!entry || now > entry.resetTime) {
      // Reset or create new entry
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (entry.count < this.maxRequests) {
      entry.count++;
      return true;
    }

    return false;
  }

  getTimeUntilReset(key: string): number {
    const entry = this.requests.get(key);
    if (!entry) return 0;

    const now = Date.now();
    return Math.max(0, entry.resetTime - now);
  }

  getRemainingRequests(key: string): number {
    const entry = this.requests.get(key);
    if (!entry) return this.maxRequests;

    return Math.max(0, this.maxRequests - entry.count);
  }
}

// Global rate limiter instances
export const nearblocksRateLimiter = new RateLimiter(10, 60 * 1000); // 10 calls per minute (increased from 6)
export const rpcRateLimiter = new RateLimiter(3, 60 * 1000); // 3 calls per minute (more conservative)

// Helper function to check if we can make a Nearblocks request - DISABLED
export function canMakeNearblocksRequest(): boolean {
  return true; // Always allow
}

// Helper function to get time until next request is allowed - DISABLED
export function getTimeUntilNextNearblocksRequest(): number {
  return 0; // No wait time
}

// Helper function to get remaining requests in current window - DISABLED
export function getRemainingNearblocksRequests(): number {
  return 999; // Always show as available
}

// RPC Rate Limiting Functions - DISABLED
export function canMakeRpcRequest(): boolean {
  return true; // Always allow
}

export function getTimeUntilNextRpcRequest(): number {
  return 0; // No wait time
}

export function getRemainingRpcRequests(): number {
  return 999; // Always show as available
}
