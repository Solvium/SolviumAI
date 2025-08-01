import React, { useState, useCallback, useEffect } from "react";
import { useMultiChain, ChainType } from "@/app/hooks/useMultiChain";
import { LoginMethod } from "@/app/hooks/useMultiLogin";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID } from "@/app/config/google";
import { jwtDecode } from "jwt-decode";
import { ArrowLeft, Wallet, Mail } from "lucide-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useMultiLoginContext } from "@/app/contexts/MultiLoginContext";

import { cn } from "@/lib/utils";
import { AlertTriangle, X } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { FaTelegram } from "react-icons/fa6";

const chainConfig = {
  EVM: {
    rpcUrl: process.env.NEXT_PUBLIC_EVM_RPC_URL || "https://ethereum-rpc.com",
    chainId: 1, // Ethereum Mainnet
  },
  Solana: {
    rpcUrl:
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      "https://api.mainnet-beta.solana.com",
    network: "mainnet-beta" as const,
  },
  NEAR: {
    networkId: "mainnet",
    nodeUrl:
      process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.mainnet.near.org",
  },
  TON: {
    endpoint:
      process.env.NEXT_PUBLIC_TON_ENDPOINT ||
      "https://toncenter.com/api/v2/jsonRPC",
  },
};

export const MultiChainLoginModule = () => {
  const [selectedLoginMethod, setSelectedLoginMethod] =
    useState<LoginMethod | null>(null);
  const [tgError, setTgError] = useState("");

  const {
    activeChain,
    walletInfo,
    isConnecting,
    error: chainError,
    getSupportedWallets,
    connectWallet,
    switchChain,
  } = useMultiChain(chainConfig);

  const {
    isAuthenticated,
    userData,
    error: loginError,
    loginWithTelegram,
    loginWithGoogle,
    loginWithWallet,
    generateWalletSignMessage,
    signWithEthWallet,
    logout,
  } = useMultiLoginContext();

  // Handle wallet login flow
  const handleWalletLogin = useCallback(
    async (walletType: string) => {
      try {
        // First connect the wallet
        await connectWallet(walletType);

        if (activeChain === "EVM") {
          // For Ethereum, generate a message and sign it
          const message = await generateWalletSignMessage(
            walletInfo.address,
            activeChain
          );
          const { signature } = await signWithEthWallet(message);

          // Complete the login
          await loginWithWallet(
            activeChain,
            walletInfo.address,
            signature,
            message,
            {
              redirectAfterLogin: "/dashboard",
            }
          );
        } else if (activeChain === "Solana") {
          // Simplified - would need specific Solana signing logic
          const message = await generateWalletSignMessage(
            walletInfo.address,
            activeChain
          );
          const encodedMessage = new TextEncoder().encode(message);
          ///@ts-ignore
          const signature = await window.solana.signMessage(
            encodedMessage,
            "utf8"
          );

          await loginWithWallet(
            activeChain,
            walletInfo.address,
            signature,
            message,
            {
              redirectAfterLogin: "/dashboard",
            }
          );
        }
        // Add similar flows for other chains
      } catch (err) {
        console.error("Wallet login error:", err);
      }
    },
    [
      activeChain,
      walletInfo,
      connectWallet,
      generateWalletSignMessage,
      signWithEthWallet,
      loginWithWallet,
    ]
  );

  // Handle Telegram login (for Mini App context)
  const handleTelegramLogin = useCallback(async () => {
    const data = window.Telegram?.WebApp.initDataUnsafe.user?.username;
    if (data) {
      const initData = window.Telegram.WebApp.initDataUnsafe;
      console.log(initData);
      await loginWithTelegram(initData);
    } else {
      console.log("Not in Telegram Mini App context");
      setTgError("Not in Telegram Mini App context!");
    }
  }, [loginWithTelegram]);

  const handleLogin = async (resp: any) => {
    let decoded: any = jwtDecode(resp?.credential);
    const ref = location.search?.split("?ref=")[1]?.split("&")[0] ?? "null";
    loginWithGoogle({ ...decoded, ref });
  };

  const handleLoginError = () => {
    throw "Login Failed";
  };

  useEffect(() => {
    if (tgError != "") {
      setTimeout(() => {
        setTgError("");
      }, 5000);
    }
  }, [tgError]);

  // UI Rendering
  return (
    <div className="max-w-md w-full mx-auto bg-background bg-opacity-50 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-border/50">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Welcome</h1>
        <p className="text-muted-foreground">
          Sign in to your account to continue
        </p>
      </div>

      {/* Error notification */}
      {(chainError || loginError || tgError) && (
        <div className="mb-6">
          <ErrorNotification
            message={tgError || chainError || loginError || ""}
            onDismiss={() => setTgError("")}
          />
        </div>
      )}

      {/* Login Method Selection */}
      {!isAuthenticated && !selectedLoginMethod && (
        <div className="space-y-6">
          <div className="space-y-4">
            <LoginMethodButton
              icon={<FaTelegram className="h-5 w-5" />}
              label="Continue with Telegram"
              onClick={handleTelegramLogin}
              className="bg-[#0088cc] text-white hover:bg-[#0088cc]/90"
            />

            <div className="flex items-center justify-center rounded-xl overflow-hidden">
              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <GoogleLogin
                  width="100%"
                  size="large"
                  theme="outline"
                  logo_alignment="center"
                  type="standard"
                  text="signin_with"
                  onSuccess={(e) => handleLogin(e)}
                  onError={() => handleLoginError()}
                />
              </GoogleOAuthProvider>
            </div>

            {/* <LoginMethodButton
              icon={<Wallet className="h-5 w-5" />}
              label="Connect Wallet"
              onClick={() => setSelectedLoginMethod("Wallet")}
            /> */}
          </div>

          {/* <div className="flex items-center justify-center">
            <div className="h-px bg-gray-200 flex-1"></div>
            <p className="px-4 text-sm text-muted-foreground">OR</p>
            <div className="h-px bg-gray-200 flex-1"></div>
          </div>

          <LoginMethodButton
            icon={<Mail className="h-5 w-5" />}
            label="Continue with Email"
            onClick={() => {}}
            className="bg-secondary text-secondary-foreground"
          /> */}
        </div>
      )}

      {/* Wallet Selection (if wallet login chosen) */}
      {!isAuthenticated && selectedLoginMethod === "Wallet" && (
        <div>
          <div className="flex items-center mb-6">
            <button
              onClick={() => setSelectedLoginMethod(null)}
              className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to login methods
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-3">Select Blockchain</h2>
              <div className="grid grid-cols-2 gap-2">
                {(["EVM", "Solana", "NEAR", "TON"] as ChainType[]).map(
                  (chain) => (
                    <ChainButton
                      key={chain}
                      chain={chain}
                      active={activeChain === chain}
                      onClick={() => switchChain(chain)}
                    />
                  )
                )}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Select Wallet</h2>
              {activeChain === "Solana" && (
                <div className="mb-4 flex justify-center">
                  <WalletMultiButton />
                </div>
              )}
              <div className="space-y-2">
                {getSupportedWallets().map((wallet) => (
                  <WalletButton
                    key={wallet}
                    name={wallet}
                    onClick={() => handleWalletLogin(wallet)}
                    isConnecting={isConnecting}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User is authenticated */}
      {isAuthenticated && userData && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold">Login Successful</h2>
          <p className="text-muted-foreground">
            You have successfully signed in.
          </p>
          <button
            onClick={logout}
            className="mt-4 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default MultiChainLoginModule;

interface ChainButtonProps {
  chain: ChainType;
  active: boolean;
  onClick: () => void;
}

const ChainButton = ({ chain, active, onClick }: ChainButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium transition-all",
        active
          ? "bg-primary text-white shadow-sm"
          : "bg-secondary hover:bg-secondary/80 text-foreground"
      )}
    >
      {chain}
    </button>
  );
};

interface ErrorNotificationProps {
  message: string;
  onDismiss?: () => void;
  autoClose?: boolean;
  duration?: number;
}

const ErrorNotification = ({
  message,
  onDismiss,
  autoClose = true,
  duration = 5000,
}: ErrorNotificationProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoClose && message) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onDismiss) onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, autoClose, duration, onDismiss]);

  if (!message || !visible) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg shadow-md",
        "bg-destructive/10 border border-destructive/20 text-destructive",
        "animate-in fade-in slide-in-from-top-2 duration-300",
        "w-full"
      )}
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm flex-1">{message}</p>
      {onDismiss && (
        <button
          onClick={() => {
            setVisible(false);
            onDismiss();
          }}
          className="p-1 rounded-full hover:bg-destructive/10"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

interface LoginMethodButtonProps {
  icon: any;
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

const LoginMethodButton = ({
  icon: Icon,
  label,
  onClick,
  className,
  disabled = false,
}: LoginMethodButtonProps) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center gap-3 w-full p-2 rounded-xl transition-all",
        "bg-white border border-gray-200 hover:border-primary/50 hover:shadow-md",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      {Icon}
      <span className="font-medium">{label}</span>
    </button>
  );
};

interface WalletButtonProps {
  name: string;
  onClick: () => void;
  isConnecting: boolean;
}

const WalletButton = ({ name, onClick, isConnecting }: WalletButtonProps) => {
  return (
    <button
      onClick={onClick}
      disabled={isConnecting}
      className={cn(
        "flex items-center justify-between w-full p-4 rounded-xl transition-all",
        "bg-white border border-gray-200 hover:border-primary/50 hover:shadow-md",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    >
      <span className="font-medium">{name}</span>
      {isConnecting ? (
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      )}
    </button>
  );
};
