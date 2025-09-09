// src/hooks/useMultiLogin.ts
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import WebApp from "@twa-dev/sdk";

export type LoginMethod = "Telegram" | "Google";

interface LoginOptions {
  redirectAfterLogin?: string;
  onLoginSuccess?: (userData: UserData) => void;
  onLoginError?: (error: Error) => void;
}

export const useMultiLogin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Initialize: Check if user is already logged in
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get("/api/user?type=getme");
      if (response.data.authenticated) {
        setIsAuthenticated(true);
        setUserData(response.data.user);
      } else {
        setIsAuthenticated(false);
        setUserData(null);
      }
    } catch (err) {
      setIsAuthenticated(false);
      setUserData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Login with Telegram (Mini App)
  const loginWithTelegram = useCallback(
    async (
      telegramInitData: typeof WebApp.initDataUnsafe,
      options?: LoginOptions
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await axios("/api/user", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          data: JSON.stringify({
            type: "loginWithTg",
            username: telegramInitData.user?.username,
          }),
        });

        if (response.status == 200) {
          setIsAuthenticated(true);
          setUserData(response.data.user);

          if (options?.onLoginSuccess) {
            options.onLoginSuccess(response.data.user);
          }

          if (options?.redirectAfterLogin) {
            router.push(options.redirectAfterLogin);
          }

          return response.data.user;
        } else {
          throw new Error(response.data.message || "Telegram login failed");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Login failed";
        setError(errorMessage);

        if (options?.onLoginError && err instanceof Error) {
          options.onLoginError(err);
        }

        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  // Login with Google
  const loginWithGoogle = useCallback(
    async (
      data: { email: string; name: any; ref: any },
      options?: LoginOptions
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await axios("/api/user", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          data: JSON.stringify({
            type: "loginWithGoogle",
            username: data.email.split("@gmail.com")[0],
            email: data.email,
            name: data.name,
            ref: data.ref,
          }),
        });
        if (response.status == 200) {
          setIsAuthenticated(true);
          setUserData(response.data.user);

          if (options?.onLoginSuccess) {
            options.onLoginSuccess(response.data.user);
          }

          if (options?.redirectAfterLogin) {
            router.push(options.redirectAfterLogin);
          }

          return response.data.user;
        } else {
          throw new Error(response.data.message || "Google login failed");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Login failed";
        setError(errorMessage);

        if (options?.onLoginError && err instanceof Error) {
          options.onLoginError(err);
        }

        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  // Logout
  const logout = useCallback(async () => {
    try {
      await axios("/api/user", {
        method: "POST",
        data: JSON.stringify({
          type: "logout",
        }),
      });

      setIsAuthenticated(false);
      setUserData(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  }, []);

  return {
    isAuthenticated,
    userData,
    isLoading,
    error,
    loginWithTelegram,
    loginWithGoogle,
    checkAuthStatus,
    logout,
  };
};
