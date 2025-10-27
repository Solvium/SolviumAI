"use client";

import { useEffect, useState } from "react";
import { initTelegramWebApp, getTelegramWebApp } from "@/lib/telegramRouting";

interface TelegramProviderProps {
  children: React.ReactNode;
}

export default function TelegramProvider({ children }: TelegramProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize Telegram WebApp
    const tg = initTelegramWebApp();

    if (tg) {
      console.log("Telegram WebApp initialized:", {
        version: tg.version,
        platform: tg.platform,
        user: tg.initDataUnsafe.user,
        theme: tg.colorScheme,
      });

      // Set up theme
      if (tg.colorScheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }

      // Handle theme changes
      const handleThemeChange = () => {
        if (tg.colorScheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      };

      // Listen for theme changes (if supported)
      if ("on" in tg && typeof tg.on === "function") {
        (tg as any).on("themeChanged", handleThemeChange);
      }

      setIsInitialized(true);
    } else {
      // Not in Telegram environment, still initialize
      console.log("Not in Telegram environment, using fallback");
      setIsInitialized(true);
    }
  }, []);

  if (!isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-[#0a0520] via-[#1a0f3e] to-[#0a0520]">
        <div className="text-white text-xl">Initializing...</div>
      </div>
    );
  }

  return <>{children}</>;
}
