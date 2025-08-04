import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { JWTService } from './jwt';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export interface SessionData {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export class SessionManager {
  private static readonly ACCESS_TOKEN_COOKIE = 'access_token';
  private static readonly REFRESH_TOKEN_COOKIE = 'refresh_token';
  private static readonly SESSION_ID_COOKIE = 'session_id';

  static async createSession(userId: string): Promise<SessionData> {
    // Generate unique session ID
    const sessionId = crypto.randomUUID();
    
    // Generate tokens
    const accessToken = JWTService.generateAccessToken({ id: userId } as any);
    const refreshToken = JWTService.generateRefreshToken(userId, sessionId);
    
    // Calculate expiry
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // Store session in database
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: parseInt(userId),
        refreshToken: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        userAgent: 'web', // You can extract this from request headers
        ipAddress: '127.0.0.1', // You can extract this from request
        isActive: true,
      },
    });

    return {
      userId,
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  static async validateSession(request: NextRequest): Promise<{ isValid: boolean; userId?: string; sessionId?: string }> {
    try {
      const accessToken = request.cookies.get(this.ACCESS_TOKEN_COOKIE)?.value;
      const refreshToken = request.cookies.get(this.REFRESH_TOKEN_COOKIE)?.value;
      const sessionId = request.cookies.get(this.SESSION_ID_COOKIE)?.value;

      if (!accessToken || !refreshToken || !sessionId) {
        return { isValid: false };
      }

      // Verify access token
      try {
        const payload = JWTService.verifyAccessToken(accessToken);
        return { isValid: true, userId: payload.userId, sessionId };
      } catch (error) {
        // Access token expired, try refresh token
        return await this.refreshSession(refreshToken, sessionId);
      }
    } catch (error) {
      return { isValid: false };
    }
  }

  static async refreshSession(refreshToken: string, sessionId: string): Promise<{ isValid: boolean; userId?: string; sessionId?: string }> {
    try {
      // Verify refresh token
      const payload = JWTService.verifyRefreshToken(refreshToken);
      
      // Check if session exists and is active
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId: parseInt(payload.userId),
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!session) {
        return { isValid: false };
      }

      return { isValid: true, userId: payload.userId, sessionId };
    } catch (error) {
      return { isValid: false };
    }
  }

  static async invalidateSession(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
  }

  static async invalidateAllUserSessions(userId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { 
        userId: parseInt(userId),
        isActive: true,
      },
      data: { isActive: false },
    });
  }

  static setSessionCookies(response: NextResponse, sessionData: SessionData): NextResponse {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    // Set access token (short-lived)
    response.cookies.set(this.ACCESS_TOKEN_COOKIE, sessionData.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60, // 15 minutes
    });

    // Set refresh token (long-lived)
    response.cookies.set(this.REFRESH_TOKEN_COOKIE, sessionData.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Set session ID
    response.cookies.set(this.SESSION_ID_COOKIE, sessionData.userId, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  }

  static clearSessionCookies(response: NextResponse): NextResponse {
    response.cookies.delete(this.ACCESS_TOKEN_COOKIE);
    response.cookies.delete(this.REFRESH_TOKEN_COOKIE);
    response.cookies.delete(this.SESSION_ID_COOKIE);
    return response;
  }

  static async getActiveSessions(userId: string): Promise<any[]> {
    return await prisma.session.findMany({
      where: {
        userId: parseInt(userId),
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
} 