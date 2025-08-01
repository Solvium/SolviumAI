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

// Types
export type AuthProvider = "telegram" | "google" | "email" | "wallet";

export interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  telegramId?: string;
  googleId?: string;
  walletAddresses?: string[];
  totalPoints: number;
  multiplier: number;
  createdAt: Date;
  lastLoginAt: Date;
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

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get("/api/auth/me");
      if (response.data.authenticated) {
        setState((prev) => ({
          ...prev,
          user: response.data.user,
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
        setState((prev) => ({
          ...prev,
          user: response.data.user,
        }));
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }, []);

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

  const value: AuthContextType = {
    ...state,
    loginWithTelegram,
    loginWithGoogle,
    logout,
    registerAuthProvider,
    loginWithProvider,
    refreshUser,
    updateUser,
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
