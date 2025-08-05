import React, { useState, useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID } from "@/app/config/google";
import WebApp from "@twa-dev/sdk";
import { FaTelegram, FaGoogle, FaSpinner } from "react-icons/fa";
import { toast } from "react-toastify";

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

  // Check if Telegram Web App is available
  useEffect(() => {
    const checkTelegramAvailability = () => {
      try {
        // Check multiple ways to detect Telegram WebApp
        const tg = window?.Telegram?.WebApp;
        const webApp = WebApp;

        console.log("Telegram detection:", {
          windowTelegram: !!window?.Telegram,
          webAppAvailable: !!webApp,
          initDataUnsafe: webApp?.initDataUnsafe,
          user: webApp?.initDataUnsafe?.user,
          platform: webApp?.platform,
          isExpanded: webApp?.isExpanded,
        });

        // Check if we're in Telegram WebApp context
        if (webApp && webApp.platform !== "unknown") {
          setIsTelegramAvailable(true);
          console.log("Telegram WebApp detected");
          return;
        }

        // Fallback check for window.Telegram
        if (tg && tg.platform !== "unknown") {
          setIsTelegramAvailable(true);
          console.log("Telegram WebApp detected via window.Telegram");
          return;
        }

        // Additional check for user data
        if (webApp?.initDataUnsafe?.user || tg?.initDataUnsafe?.user) {
          setIsTelegramAvailable(true);
          console.log("Telegram user data detected");
          return;
        }

        console.log("Telegram WebApp not detected");
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
  }, []);

  const handleTelegramLogin = async () => {
    if (!isTelegramAvailable) {
      toast.error("Telegram Web App is not available");
      return;
    }

    setIsProcessing(true);
    try {
      // Try to get user data from WebApp SDK
      const webApp = WebApp;
      let userData = null;

      if (webApp?.initDataUnsafe?.user) {
        userData = webApp.initDataUnsafe.user;
      } else if (window?.Telegram?.WebApp?.initDataUnsafe?.user) {
        userData = window.Telegram.WebApp.initDataUnsafe.user;
      }

      if (!userData) {
        throw new Error("Telegram user data not available");
      }

      console.log("Telegram user data:", userData);

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

  const handleGoogleError = () => {
    toast.error("Google login failed. Please try again.");
  };

  return (
    <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome to Solvium
          </h1>
          <p className="text-[#8E8EA8] text-sm">
            Choose your preferred login method
          </p>
        </div>

        {/* Login Options */}
        <div className="space-y-4">
          {/* Telegram Login */}
          {isTelegramAvailable && (
            <button
              onClick={handleTelegramLogin}
              disabled={isProcessing || isLoading}
              className="w-full flex items-center justify-center gap-3 bg-[#0088cc] hover:bg-[#0077b3] disabled:bg-[#0088cc]/50 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none"
            >
              {isProcessing ? (
                <FaSpinner className="animate-spin text-xl" />
              ) : (
                <FaTelegram className="text-xl" />
              )}
              <span>
                {isProcessing ? "Logging in..." : "Continue with Telegram"}
              </span>
            </button>
          )}

          {/* Debug info - remove in production */}
          {process.env.NODE_ENV === "development" && (
            <div className="text-xs text-gray-400 p-2 bg-gray-800 rounded">
              Telegram Available: {isTelegramAvailable ? "Yes" : "No"}
            </div>
          )}

          {/* Google Login */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2A2A45]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#0B0B14] text-[#8E8EA8]">
                {isTelegramAvailable ? "or" : "Login with"}
              </span>
            </div>
          </div>

          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <GoogleLogin
              onSuccess={(credentialResponse) => {
                if (credentialResponse.credential) {
                  handleGoogleLogin(credentialResponse.credential);
                }
              }}
              onError={handleGoogleError}
              useOneTap={false}
              theme="filled_blue"
              size="large"
              text="continue_with"
              shape="rectangular"
              locale="en"
            />
          </GoogleOAuthProvider>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[#8E8EA8] text-xs">
            By continuing, you agree to our{" "}
            <a href="/terms" className="text-[#4C6FFF] hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-[#4C6FFF] hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#151524] p-6 rounded-xl flex items-center gap-3">
              <FaSpinner className="animate-spin text-[#4C6FFF] text-xl" />
              <span className="text-white">Loading...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginModule;
