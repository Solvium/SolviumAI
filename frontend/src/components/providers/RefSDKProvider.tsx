"use client";

import { useEffect, useState, ReactNode } from "react";
import { initializeRefSDK, isRefSDKInitialized } from "@/lib/refInit";

interface RefSDKInitializerProps {
  children: ReactNode;
}

export function RefSDKInitializer({ children }: RefSDKInitializerProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initRefSDK = async () => {
      try {
        // Check if already initialized
        if (isRefSDKInitialized()) {
          setIsInitialized(true);
          return;
        }

        console.log("[RefSDKProvider] Initializing Ref Finance SDK...");
        await initializeRefSDK();
        setIsInitialized(true);
        console.log(
          "[RefSDKProvider] Ref Finance SDK initialized successfully"
        );
      } catch (err) {
        console.error(
          "[RefSDKProvider] Failed to initialize Ref Finance SDK:",
          err
        );
        setError(
          err instanceof Error ? err.message : "Failed to initialize Ref SDK"
        );
        // Don't block the app if Ref SDK fails to initialize
        setIsInitialized(true);
      }
    };

    initRefSDK();
  }, []);

  // Show loading state only briefly, then render children regardless
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing Ref Finance SDK...</p>
        </div>
      </div>
    );
  }

  // If there was an error, log it but don't block the app
  if (error) {
    console.warn(
      "[RefSDKProvider] Ref SDK initialization failed, continuing without it:",
      error
    );
  }

  return <>{children}</>;
}
