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
import { useSimpleWallet } from "@/contexts/SimpleWalletContext";

// Configure axios to send cookies
axios.defaults.withCredentials = true;

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
  avatar_url?: string; // New field for profile avatar
  totalPoints: number;
  totalSOLV?: number; // SOLV balance
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
  // New fields for enhanced profile system
  experience_points?: number;
  contests_participated?: number;
  tasks_completed?: number;
  level_progress?: {
    current_level: number;
    next_level_points: number;
    progress_percentage: number;
    points_to_next: number;
    level_title: string;
  };
  recent_activities?: UserActivity[];
}

export interface UserActivity {
  id: string;
  activity_type: string;
  points_earned: number;
  metadata: any;
  createdAt: string;
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
  loginWithGoogleAccessToken?: (accessToken: string) => Promise<User>;
  logout: () => Promise<void>;

  // Extensibility methods
  registerAuthProvider: (
    provider: AuthProvider,
    config: AuthProviderConfig
  ) => void;
  loginWithProvider: (provider: AuthProvider, data: any) => Promise<User>;

  // Utility methods
  refreshUser: () => Promise<void>;
  trackLogin: () => Promise<boolean>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  refreshToken: () => Promise<void>;

  // New profile enhancement methods
  fetchUserProfile: () => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
  logActivity: (activity: {
    activity_type: string;
    points_earned: number;
    metadata?: any;
  }) => Promise<void>;
  claimPoints: (type: string, callback?: () => void) => Promise<void>;
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

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get("/api/auth/me");
      if (response.data.authenticated) {
        const user = response.data.user;

        setState((prev) => ({
          ...prev,
          user,
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

  const loginWithGoogleAccessToken = useCallback(
    async (accessToken: string): Promise<User> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await axios.post("/api/auth/google/access", {
          access_token: accessToken,
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
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Google login failed";
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
      // Force fresh fetch by adding cache-busting timestamp
      const response = await axios.get(`/api/auth/me?t=${Date.now()}`, {
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      if (response.data.authenticated) {
        const user = response.data.user;

        setState((prev) => ({
          ...prev,
          user,
        }));
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }, []);

  const trackLogin = useCallback(async (): Promise<boolean> => {
    try {
      const response = await axios.post("/api/auth/login-track");
      if (response.data.success) {
        console.log("Login tracked:", response.data);
        // Refresh user data to get updated streak
        await refreshUser();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to track login:", error);
      return false;
    }
  }, [refreshUser]);

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

  // New profile enhancement methods
  const fetchUserProfile = useCallback(async () => {
    try {
      // Force fresh fetch by adding cache-busting timestamp
      const response = await axios.get(`/api/auth/me?t=${Date.now()}`, {
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      const userData = response.data.user;

      setState((prev) => ({
        ...prev,
        user: userData, // Update existing user state
      }));
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    }
  }, []);

  const updateUserProfile = useCallback(async (updates: Partial<User>) => {
    try {
      const response = await axios.patch("/api/user/profile", updates);
      const userData = response.data.user;

      setState((prev) => ({
        ...prev,
        user: userData, // Update existing user state
      }));
    } catch (error) {
      console.error("Failed to update user profile:", error);
      throw error;
    }
  }, []);

  const logActivity = useCallback(
    async (activity: {
      activity_type: string;
      points_earned: number;
      metadata?: any;
    }) => {
      try {
        const response = await axios.post("/api/user/activities", activity);

        // Refresh user data to show updated stats
        await fetchUserProfile();

        return response.data;
      } catch (error) {
        console.error("Failed to log activity:", error);
        throw error;
      }
    },
    [fetchUserProfile]
  );

  const claimPoints = useCallback(
    async (type: string, callback?: () => void) => {
      if (!state.user?.username) {
        console.error("No user found for claiming points");
        return;
      }

      try {
        await axios.post("/api/claim", {
          username: state.user.username,
          type: type,
          data: {},
          userMultipler: 1,
          solWallet: null,
        });

        // Refresh user data to get updated points
        await fetchUserProfile();

        // Call callback if provided
        if (callback) {
          callback();
        }
      } catch (error) {
        console.error("Failed to claim points:", error);
        throw error;
      }
    },
    [state.user?.username, fetchUserProfile]
  );

  const value: AuthContextType = {
    ...state,
    loginWithTelegram,
    loginWithGoogle,
    loginWithGoogleAccessToken,
    logout,
    registerAuthProvider,
    loginWithProvider,
    refreshUser,
    trackLogin,
    updateUser,
    refreshToken,
    fetchUserProfile,
    updateUserProfile,
    logActivity,
    claimPoints,
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
