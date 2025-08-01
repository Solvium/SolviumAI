// src/hooks/useMultiLogin.ts
import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { useRouter } from "next/navigation";
import WebApp from "@twa-dev/sdk";

export type LoginMethod = "Telegram" | "Google" | "Wallet";

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

      console.log(response);
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

  // console.log(userData);
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

        console.log(response);

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
    []
  );

  // Login with Wallet (any chain)
  const loginWithWallet = useCallback(
    async (
      chain: string,
      address: string,
      signature: string,
      message: string,
      options?: LoginOptions
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        // Verify signature and login
        const response = await axios.post("/api/auth/wallet", {
          chain,
          address,
          signature,
          message,
        });

        if (response.data.success) {
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
          throw new Error(response.data.message || "Wallet login failed");
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

  // Generate signature message for wallet-based login
  const generateWalletSignMessage = useCallback(
    async (address: string, chain: string) => {
      try {
        const response = await axios.post("/api/auth/nonce", {
          address,
          chain,
        });
        return response.data.message;
      } catch (err) {
        console.error("Failed to generate nonce:", err);
        throw err;
      }
    },
    []
  );

  // Helper: Sign message with Ethereum wallet
  const signWithEthWallet = useCallback(async (message: string) => {
    ///@ts-ignore
    if (!window.ethereum) {
      throw new Error("Ethereum provider not found");
    }

    try {
      ///@ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const signature = await signer.signMessage(message);

      return { signature, address };
    } catch (err) {
      console.error("Signing error:", err);
      throw err;
    }
  }, []);

  // Link additional accounts
  const linkAccount = useCallback(
    async (method: LoginMethod, data: any) => {
      if (!isAuthenticated) {
        throw new Error("You must be logged in to link accounts");
      }

      try {
        const response = await axios.post("/api/auth/link", {
          method,
          data,
        });

        if (response.data.success) {
          setUserData(response.data.user);
          return response.data.user;
        } else {
          throw new Error(response.data.message || "Failed to link account");
        }
      } catch (err) {
        console.error("Account linking error:", err);
        throw err;
      }
    },
    [isAuthenticated]
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
  }, [router]);

  return {
    isAuthenticated,
    userData,
    isLoading,
    error,
    loginWithTelegram,
    loginWithGoogle,
    checkAuthStatus,
    loginWithWallet,
    generateWalletSignMessage,
    signWithEthWallet,
    linkAccount,
    logout,
  };
};
