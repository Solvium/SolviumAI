"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import axios from "axios";
import WebApp from "@twa-dev/sdk";
import { jwtDecode } from "jwt-decode";
import { useSimpleWallet } from "@/app/contexts/SimpleWalletContext";
import { WalletCheckResponse } from "@/lib/crypto";

// Types
export type AuthProvider = "telegram" | "google" | "email" | "wallet";

export interface User {
  id: string;
  username: string;
  email?: string;
  telegramId?: string;
  googleId?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  totalPoints: number;
  multiplier: number;
  level: number;
  difficulty: number;
  puzzleCount: number;
  referralCount: number;
  spinCount: number;
  dailySpinCount: number;
  claimCount: number;
  isOfficial: boolean;
  isMining: boolean;
  isPremium: boolean;
  weeklyPoints: number;
  createdAt: Date;
  lastLoginAt: Date;
  lastSpinClaim?: Date;
  lastClaim?: Date;
  chatId?: string;
  wallet?: any; // Changed from string to any to handle parsed wallet data
  solviumWallet?: WalletCheckResponse; // New field for SolviumAI wallet data
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  // Core auth methods
  loginWithTelegram: (initData: any) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<User>;
  logout: () => Promise<void>;

  // Extensibility methods
  registerAuthProvider: (
    provider: AuthProvider,
    config: AuthProviderConfig
  ) => void;
  loginWithProvider: (provider: AuthProvider, data: any) => Promise<User>;

  // Utility methods
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  refreshToken: () => Promise<void>;

  // Wallet methods
  getWalletData: (
    telegramUserId: number
  ) => Promise<WalletCheckResponse | null>;
  refreshWalletData: () => Promise<void>;
}

export interface AuthProviderConfig {
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  loginHandler: (data: any) => Promise<User>;
}

// Default providers
const defaultProviders: Record<AuthProvider, AuthProviderConfig> = {
  telegram: {
    name: "Telegram",
    icon: "📱",
    color: "#0088cc",
    enabled: true,
    loginHandler: async (data: any) => {
      const response = await axios.post("/api/auth/telegram", data);
      return response.data.user;
    },
  },
  google: {
    name: "Google",
    icon: "📧",
    color: "#4285f4",
    enabled: true,
    loginHandler: async (credential: string) => {
      const response = await axios.post("/api/auth/google", { credential });
      return response.data.user;
    },
  },
  email: {
    name: "Email",
    icon: "✉️",
    color: "#34a853",
    enabled: false,
    loginHandler: async (data: any) => {
      const response = await axios.post("/api/auth/email", data);
      return response.data.user;
    },
  },
  wallet: {
    name: "Wallet",
    icon: "💼",
    color: "#f7931e",
    enabled: false,
    loginHandler: async (data: any) => {
      const response = await axios.post("/api/auth/wallet", data);
      return response.data.user;
    },
  },
};

// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const [providers, setProviders] =
    useState<Record<AuthProvider, AuthProviderConfig>>(defaultProviders);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Set up automatic token refresh
  useEffect(() => {
    if (state.isAuthenticated) {
      const refreshInterval = setInterval(() => {
        refreshToken();
      }, 14 * 60 * 1000); // Refresh every 14 minutes (before 15-minute expiry)

      return () => clearInterval(refreshInterval);
    }
  }, [state.isAuthenticated]);

  const getWalletData = useCallback(
    async (
      telegramUserId: number,
      forceRefresh: boolean = false
    ): Promise<WalletCheckResponse | null> => {
      try {
        const response = await axios.post("/api/wallet/check", {
          telegram_user_id: telegramUserId,
          force_refresh: forceRefresh,
        });

        if (response.data.has_wallet || response.data.message) {
          return response.data;
        } else {
          console.warn("Wallet check failed:", response.data.error);
          return null;
        }
      } catch (error) {
        console.error("Failed to get wallet data:", error);
        return null;
      }
    },
    []
  );

  const checkAuthStatus = async () => {
    const tgUserId = "724141849"; //WebApp?.initDataUnsafe?.user?.id?.toString();

    try {
      const response = await axios.get("/api/auth/me");
      console.log("response", response);
      if (response.data.authenticated) {
        const user = response.data.user;

        // Try to fetch wallet data if we have a Telegram ID
        let solviumWallet = null;
        if (tgUserId) {
          try {
            const telegramUserId = parseInt(tgUserId);
            if (!isNaN(telegramUserId)) {
              solviumWallet = await getWalletData(telegramUserId);
              console.log(
                "[Auth] Fetched SolviumAI wallet data:",
                solviumWallet
              );
            }
          } catch (error) {
            console.warn("[Auth] Failed to fetch wallet data:", error);
          }
        }

        setState((prev) => ({
          ...prev,
          user: {
            ...user,
            solviumWallet,
          },
          isAuthenticated: true,
          isLoading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isAuthenticated: false,
          isLoading: false,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        error: "Failed to check authentication status",
      }));
    }
  };

  const refreshToken = useCallback(async () => {
    try {
      await axios.post("/api/auth/refresh");
      // Token refreshed successfully, no need to update state
    } catch (error) {
      console.error("Token refresh failed:", error);
      // If refresh fails, logout the user
      await logout();
    }
  }, []);

  const loginWithTelegram = useCallback(
    async (initData: any): Promise<User> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await axios.post("/api/auth/telegram", {
          initData: initData,
          user: initData.user,
        });

        const user = response.data.user;
        setState((prev) => ({
          ...prev,
          user,
          isAuthenticated: true,
          isLoading: false,
        }));

        return user;
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message || "Telegram login failed";
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
        throw new Error(errorMessage);
      }
    },
    []
  );

  const loginWithGoogle = useCallback(
    async (credential: string): Promise<User> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      console.log("credential", credential);
      try {
        const response = await axios.post("/api/auth/google", { credential });

        const user = response.data.user;
        setState((prev) => ({
          ...prev,
          user,
          isAuthenticated: true,
          isLoading: false,
        }));

        return user;
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message || "Google login failed";
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
        throw new Error(errorMessage);
      }
    },
    []
  );

  const loginWithProvider = useCallback(
    async (provider: AuthProvider, data: any): Promise<User> => {
      const providerConfig = providers[provider];
      if (!providerConfig || !providerConfig.enabled) {
        throw new Error(`Provider ${provider} is not available`);
      }

      return await providerConfig.loginHandler(data);
    },
    [providers]
  );

  const logout = useCallback(async () => {
    try {
      await axios.post("/api/auth/logout");
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Logout error:", error);
      // Even if logout fails, clear local state
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  const registerAuthProvider = useCallback(
    (provider: AuthProvider, config: AuthProviderConfig) => {
      setProviders((prev) => ({
        ...prev,
        [provider]: config,
      }));
    },
    []
  );

  const refreshUser = useCallback(async () => {
    try {
      const response = await axios.get("/api/auth/me");
      if (response.data.authenticated) {
        const user = response.data.user;

        // Try to fetch wallet data if we have a Telegram ID
        let solviumWallet = null;
        if (user.telegramId) {
          try {
            const telegramUserId = parseInt(user.telegramId);
            if (!isNaN(telegramUserId)) {
              solviumWallet = await getWalletData(telegramUserId);
              console.log(
                "[Auth] Refreshed SolviumAI wallet data:",
                solviumWallet
              );
            }
          } catch (error) {
            console.warn("[Auth] Failed to refresh wallet data:", error);
          }
        }

        setState((prev) => ({
          ...prev,
          user: {
            ...user,
            solviumWallet,
          },
        }));
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }, [getWalletData]);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    try {
      const response = await axios.patch("/api/auth/user", updates);
      setState((prev) => ({
        ...prev,
        user: response.data.user,
      }));
    } catch (error) {
      console.error("Failed to update user:", error);
    }
  }, []);

  const refreshWalletData = useCallback(async () => {
    if (!state.user?.telegramId) {
      console.warn("No Telegram ID available for wallet refresh");
      return;
    }

    try {
      const telegramUserId = parseInt(state.user.telegramId);
      if (isNaN(telegramUserId)) {
        console.warn("Invalid Telegram ID for wallet refresh");
        return;
      }

      const walletData = await getWalletData(telegramUserId);
      if (walletData) {
        setState((prev) => ({
          ...prev,
          user: prev.user
            ? {
                ...prev.user,
                solviumWallet: walletData,
              }
            : null,
        }));
      }
    } catch (error) {
      console.error("Failed to refresh wallet data:", error);
    }
  }, [state.user?.telegramId, getWalletData]);

  const value: AuthContextType = {
    ...state,
    loginWithTelegram,
    loginWithGoogle,
    logout,
    registerAuthProvider,
    loginWithProvider,
    refreshUser,
    updateUser,
    refreshToken,
    getWalletData,
    refreshWalletData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Hook to get available auth providers
export const useAuthProviders = () => {
  const { registerAuthProvider } = useAuth();
  return { registerAuthProvider };
};
