import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string; // Custom key generator
}

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
    const now = new Date();
    const windowStart = new Date(now.getTime() - finalConfig.windowMs);

    try {
      // Clean up old records
      await prisma.rateLimit.deleteMany({
        where: {
          key,
          createdAt: {
            lt: windowStart,
          },
        },
      });

      // Count recent requests
      const requestCount = await prisma.rateLimit.count({
        where: {
          key,
          createdAt: {
            gte: windowStart,
          },
        },
      });

      const remaining = Math.max(0, finalConfig.maxRequests - requestCount);
      const allowed = remaining > 0;

      if (allowed) {
        // Record this request
        await prisma.rateLimit.create({
          data: {
            key,
            ipAddress: this.getClientIP(request),
            userAgent: request.headers.get('user-agent') || 'unknown',
            createdAt: now,
          },
        });
      }

      const resetTime = new Date(now.getTime() + finalConfig.windowMs);

      return {
        allowed,
        remaining,
        resetTime,
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: 1,
        resetTime: new Date(now.getTime() + finalConfig.windowMs),
      };
    }
  }

  private static generateKey(request: NextRequest, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(request);
    }

    const ip = this.getClientIP(request);
    const path = request.nextUrl.pathname;
    return `${ip}:${path}`;
  }

  private static getClientIP(request: NextRequest): string {
    // Check for forwarded headers first (for proxy setups)
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIP = request.headers.get('x-real-ip');
    if (realIP) {
      return realIP;
    }

    // Fallback to connection remote address
    return request.ip || 'unknown';
  }

  static async cleanup(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    try {
      await prisma.rateLimit.deleteMany({
        where: {
          createdAt: {
            lt: oneHourAgo,
          },
        },
      });
    } catch (error) {
      console.error('Rate limit cleanup failed:', error);
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