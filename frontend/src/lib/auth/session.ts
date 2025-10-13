import { NextRequest, NextResponse } from "next/server";
import { JWTService } from "./jwt";
import crypto from "crypto";

export interface SessionData {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  sessionId: string;
}

export class SessionManager {
  private static readonly ACCESS_TOKEN_COOKIE = "access_token";
  private static readonly REFRESH_TOKEN_COOKIE = "refresh_token";
  private static readonly SESSION_ID_COOKIE = "session_id";

  static async createSession(userId: string): Promise<SessionData> {
    const sessionId = crypto.randomUUID();

    const accessToken = JWTService.generateAccessToken({ id: userId } as any);
    const refreshToken = JWTService.generateRefreshToken(userId, sessionId);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    return {
      userId,
      accessToken,
      refreshToken,
      expiresAt,
      sessionId,
    };
  }

  static async validateSession(
    request: NextRequest
  ): Promise<{ isValid: boolean; userId?: string; sessionId?: string }> {
    try {
      const accessToken = request.cookies.get(this.ACCESS_TOKEN_COOKIE)?.value;
      const refreshToken = request.cookies.get(
        this.REFRESH_TOKEN_COOKIE
      )?.value;

      if (!accessToken && !refreshToken) {
        return { isValid: false };
      }

      // Verify access token first
      if (accessToken) {
        try {
          const payload = JWTService.verifyAccessToken(accessToken);
          return { isValid: true, userId: payload.userId } as any;
        } catch {}
      }

      // Fallback to refresh token
      if (refreshToken) {
        try {
          const payload = JWTService.verifyRefreshToken(refreshToken);
          return { isValid: true, userId: payload.userId } as any;
        } catch {}
      }

      return { isValid: false };
    } catch {
      return { isValid: false };
    }
  }

  static async refreshSession(
    refreshToken: string
  ): Promise<{ isValid: boolean; userId?: string; sessionId?: string }> {
    try {
      const payload = JWTService.verifyRefreshToken(refreshToken);
      return { isValid: true, userId: payload.userId } as any;
    } catch {
      return { isValid: false };
    }
  }

  static async invalidateSession(_sessionId: string): Promise<void> {
    // No-op for stateless JWT sessions. Implement blacklist if required.
    return;
  }

  static async invalidateAllUserSessions(_userId: string): Promise<void> {
    // No-op for stateless JWT sessions.
    return;
  }

  static setSessionCookies(
    response: NextResponse,
    sessionData: SessionData
  ): NextResponse {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };

    response.cookies.set(this.ACCESS_TOKEN_COOKIE, sessionData.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60, // 15 minutes
    });

    response.cookies.set(this.REFRESH_TOKEN_COOKIE, sessionData.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    response.cookies.set(this.SESSION_ID_COOKIE, sessionData.sessionId, {
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

  static async getActiveSessions(_userId: string): Promise<any[]> {
    // Stateless JWT has no active session list without a backing store
    return [];
  }
}
