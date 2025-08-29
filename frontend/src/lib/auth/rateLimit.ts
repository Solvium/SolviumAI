import { NextRequest } from "next/server";

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string; // Custom key generator
}

// In-memory store: request timestamps per key
const requestStore: Map<string, number[]> = new Map();

export class RateLimiter {
  private static readonly DEFAULT_CONFIG: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  };

  static async checkRateLimit(
    request: NextRequest,
    config: Partial<RateLimitConfig> = {}
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const key = this.generateKey(request, finalConfig);
    const now = Date.now();
    const windowStart = now - finalConfig.windowMs;

    // Read existing timestamps and prune old ones
    const timestamps = requestStore.get(key) || [];
    const recent = timestamps.filter((t) => t >= windowStart);

    const remaining = Math.max(0, finalConfig.maxRequests - recent.length);
    const allowed = remaining > 0;

    if (allowed) {
      recent.push(now);
      requestStore.set(key, recent);
    }

    // Compute resetTime as when the oldest recent request falls out of window
    const oldest = recent[0];
    const resetTime = oldest
      ? new Date(oldest + finalConfig.windowMs)
      : new Date(now + finalConfig.windowMs);

    return { allowed, remaining, resetTime };
  }

  private static generateKey(
    request: NextRequest,
    config: RateLimitConfig
  ): string {
    if (config.keyGenerator) {
      return config.keyGenerator(request);
    }

    const ip = this.getClientIP(request);
    const path = request.nextUrl.pathname;
    return `${ip}:${path}`;
  }

  private static getClientIP(request: NextRequest): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();

    const realIP = request.headers.get("x-real-ip");
    if (realIP) return realIP;

    // Fallback to connection remote address
    const anyReq = request as unknown as { ip?: string };
    return anyReq.ip || "unknown";
  }

  static async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, timestamps] of requestStore.entries()) {
      const pruned = timestamps.filter((t) => t > now - 60 * 60 * 1000);
      if (pruned.length === 0) requestStore.delete(key);
      else requestStore.set(key, pruned);
    }
  }
}

// Rate limit configurations for different endpoints
export const RATE_LIMIT_CONFIGS = {
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 login attempts per 15 minutes
  },
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 registration attempts per hour
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 password reset attempts per hour
  },
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 API requests per minute
  },
} as const;
