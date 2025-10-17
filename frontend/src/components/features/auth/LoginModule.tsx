"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID } from "@/config/google";
import { FaTelegram, FaSpinner } from "react-icons/fa";
import { toast } from "react-toastify";
import Image from "next/image";
import { useGoogleLogin } from "@react-oauth/google";
import TelegramButtonSvg from "@/components/assets/userProfile/Button.svg";
import LoginIcon from "@/components/assets/icons/login/loginIcon.png";
import googleLogin from "@/components/assets/icons/login/google.png";
import Bg from "@/components/assets/icons/login/bg.png";
import LoginText from "@/components/assets/icons/login/loginText.svg";
import LoginText2 from "@/components/assets/icons/login/logintext2.svg";

interface LoginModuleProps {
  onLoginSuccess?: () => void;
  onLoginError?: (error: Error) => void;
}

export const LoginModule: React.FC<LoginModuleProps> = ({
  onLoginSuccess,
  onLoginError,
}) => {
  const { loginWithTelegram, loginWithGoogle, isLoading, error } = useAuth();
  const [isTelegramAvailable, setIsTelegramAvailable] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [hasTriedLogin, setHasTriedLogin] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check if Telegram Web App is available
  useEffect(() => {
    if (!isClient) return;

    const checkTelegramAvailability = async () => {
      try {
        // Dynamically import WebApp to avoid SSR issues
        const { default: WebApp } = await import("@twa-dev/sdk");

        // Check multiple ways to detect Telegram WebApp
        const tg = (window as any)?.Telegram?.WebApp;
        const webApp = WebApp;

        // Check if we're in Telegram WebApp context
        if (webApp && webApp.platform !== "unknown") {
          setIsTelegramAvailable(true);
          return;
        }

        // Fallback check for window.Telegram
        if (tg && tg.platform !== "unknown") {
          setIsTelegramAvailable(true);
          return;
        }

        // Additional check for user data
        if (webApp?.initDataUnsafe?.user || tg?.initDataUnsafe?.user) {
          setIsTelegramAvailable(true);
          return;
        }
        setIsTelegramAvailable(false);
      } catch (error) {
        console.error("Error checking Telegram availability:", error);
        setIsTelegramAvailable(false);
      }
    };

    // Check immediately
    checkTelegramAvailability();

    // Check periodically for the first 5 seconds
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      checkTelegramAvailability();

      if (attempts >= 5) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isClient]);

  const handleTelegramLogin = async () => {
    if (!isTelegramAvailable || !isClient) {
      toast.error("Telegram Web App is not available");
      return;
    }

    setHasTriedLogin(true);
    setIsProcessing(true);
    try {
      // Dynamically import WebApp to avoid SSR issues
      const { default: WebApp } = await import("@twa-dev/sdk");

      // Try to get user data from WebApp SDK
      const webApp = WebApp;
      let userData = null;

      if (webApp?.initDataUnsafe?.user) {
        userData = webApp.initDataUnsafe.user;
      } else if ((window as any)?.Telegram?.WebApp?.initDataUnsafe?.user) {
        userData = (window as any).Telegram.WebApp.initDataUnsafe.user;
      }

      if (!userData) {
        throw new Error("Telegram user data not available");
      }
      await loginWithTelegram({ telegramData: userData });
      toast.success("Successfully logged in with Telegram!");
      onLoginSuccess?.();
    } catch (error: any) {
      const message = error.message || "Telegram login failed";
      toast.error(message);
      onLoginError?.(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleLogin = async (credential: string) => {
    setHasTriedLogin(true);
    setIsProcessing(true);
    try {
      await loginWithGoogle(credential);
      toast.success("Successfully logged in with Google!");
      onLoginSuccess?.();
    } catch (error: any) {
      const message = error.message || "Google login failed";
      toast.error(message);
      onLoginError?.(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const GoogleCustomButton: React.FC = () => {
    const { loginWithGoogleAccessToken } = useAuth();
    const startGoogle = useGoogleLogin({
      flow: "implicit",
      onSuccess: async (tokenResponse) => {
        try {
          setHasTriedLogin(true);
          setIsProcessing(true);
          if (!tokenResponse.access_token)
            throw new Error("Missing access token");
          if (loginWithGoogleAccessToken) {
            await loginWithGoogleAccessToken(tokenResponse.access_token);
          } else {
            throw new Error("Access token login not available");
          }
          toast.success("Successfully logged in with Google!");
          onLoginSuccess?.();
        } catch (error: any) {
          toast.error(error?.message || "Google login failed");
          onLoginError?.(error);
        } finally {
          setIsProcessing(false);
        }
      },
      onError: () => {
        setHasTriedLogin(true);
        toast.error("Google login failed. Please try again.");
      },
    });

    return (
      <button
        type="button"
        onClick={() => startGoogle()}
        disabled={isProcessing || isLoading}
        className="w-full flex items-center justify-center bg-transparent disabled:opacity-60 transition-transform duration-200 transform hover:scale-105"
      >
        <img
          src={googleLogin.src} // replace with your image path
          alt="Continue with Google"
          className="h-12"
        />
      </button>
    );
  };

  // Don't render until we're on the client side
  if (!isClient) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={Bg.src}
          className="w-full md:h-full object-cover"
          width={800}
          height={800}
          alt=""
        />
      </div>

      {/* Content positioned in lower portion */}
      <div className="relative z-10 h-screen flex flex-col justify-end pb-10">
        {/* Main Logo Section - moved to bottom */}
        <div className="flex w-full h-screen flex-col my-2 justify-center space-y-3 items-center">
  <LoginText />
  <div className="relative w-full h-[40%] md:h-[80%]">
    <Image
      src={LoginIcon.src}
      alt=""
      fill
      className="object-contain"
      aria-disabled
    />
  </div>
  <LoginText2 />
</div>



        <div className="flex flex-col items-center justify-center px-8 text-center">
          {/* Login Buttons */}
          <div className="space-y-4 w-full max-w-sm">
            <button
              onClick={handleTelegramLogin}
              disabled={isProcessing || isLoading}
              className="w-full flex items-center justify-center bg-transparent disabled:opacity-60 transition-transform duration-200 transform hover:scale-105"
            >
              {isProcessing ? (
                <FaSpinner className="animate-spin text-lg text-blue-500" />
              ) : (
                <img
                  src="/assets/buttons/telegram-login.png" // replace with your image path
                  alt="Continue with Telegram"
                  className="h-12"
                />
              )}
            </button>
            {/* )} */}

            {/* Google Login - Custom Button via useGoogleLogin */}
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <div className="w-full pl-[5%] pr-[5%]">
                <GoogleCustomButton />
              </div>
            </GoogleOAuthProvider>
          </div>
        </div>

        {/* Bottom Branding */}
        <div className="pt-6 text-center">
          <div className="flex items-center justify-center gap-4 text-white/80">
            {/* <span className="text-sm font-bold tracking-wider drop-shadow-lg">SOLVIUM</span> */}
            <div className="w-1 h-1 bg-white/60 rounded-full"></div>
            {/* <span className="text-sm font-medium drop-shadow-lg">v1.0</span> */}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {hasTriedLogin && error && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-500 text-white px-6 py-3 rounded-full shadow-xl border-2 border-red-200">
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-md p-8 rounded-full flex items-center gap-4 shadow-2xl border border-gray-200">
            <FaSpinner className="animate-spin text-blue-500 text-2xl" />
            <span className="text-gray-900 font-semibold text-lg">
              Loading...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginModule;
