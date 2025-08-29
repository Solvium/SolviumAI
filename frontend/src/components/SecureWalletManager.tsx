"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { WalletCheckResponse, WalletInfo } from "@/lib/crypto";

export default function SecureWalletManager() {
  const { user, getWalletData, refreshWalletData } = useAuth();
  const [walletData, setWalletData] = useState<WalletCheckResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  const handleGetWallet = async (forceRefresh: boolean = false) => {
    if (!user?.telegramId) {
      alert("No Telegram ID available");
      return;
    }

    setIsLoading(true);
    try {
      const telegramUserId = parseInt(user.telegramId);
      if (forceRefresh) {
        await refreshWalletData();
      }
      const data = await getWalletData(telegramUserId);
      setWalletData(data);
    } catch (error) {
      console.error("Failed to get wallet data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshWallet = async () => {
    await refreshWalletData();
    // Re-fetch wallet data after refresh
    await handleGetWallet(true);
  };

  const formatWalletInfo = (walletInfo: WalletInfo) => {
    return {
      accountId: walletInfo.account_id,
      publicKey: walletInfo.public_key,
      privateKey: showPrivateKey ? walletInfo.private_key : "••••••••••••••••",
      isDemo: walletInfo.is_demo,
      network: walletInfo.network,
    };
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Secure Wallet Manager
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => handleGetWallet(false)}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Get Wallet (Cached)"}
          </button>
          <button
            onClick={() => handleGetWallet(true)}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Force Refresh"}
          </button>
        </div>
      </div>

      {/* User Info */}
      <div className="mb-6 p-4 bg-gray-50 rounded-md">
        <h3 className="font-semibold text-gray-700 mb-2">User Information</h3>
        <div className="space-y-1 text-sm">
          <div>
            <span className="font-medium">Username:</span>
            <span className="ml-2 text-gray-600">
              {user?.username || "Not available"}
            </span>
          </div>
          <div>
            <span className="font-medium">Telegram ID:</span>
            <span className="ml-2 text-gray-600">
              {user?.telegramId || "Not available"}
            </span>
          </div>
        </div>
      </div>

      {/* Wallet Data */}
      {walletData && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-green-800">
                Wallet Information
              </h3>
              <button
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
              >
                {showPrivateKey ? "Hide" : "Show"} Private Key
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <span className="ml-2 text-green-600">
                  {walletData.has_wallet ? "Active" : "Inactive"}
                </span>
              </div>

              {walletData.message && (
                <div>
                  <span className="font-medium text-gray-700">Message:</span>
                  <span className="ml-2 text-gray-600">
                    {walletData.message}
                  </span>
                </div>
              )}
            </div>
          </div>

          {walletData.wallet_info && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h3 className="font-semibold text-blue-800 mb-3">
                Wallet Details
              </h3>
              <div className="space-y-3">
                {Object.entries(formatWalletInfo(walletData.wallet_info)).map(
                  ([key, value]) => (
                    <div key={key}>
                      <span className="font-medium text-gray-700 capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}:
                      </span>
                      <div className="mt-1">
                        {key === "privateKey" ? (
                          <code className="text-xs bg-gray-100 p-2 rounded block break-all font-mono">
                            {value}
                          </code>
                        ) : (
                          <span className="text-gray-600 break-all">
                            {value}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cache Information */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <h3 className="font-semibold text-yellow-800 mb-2">
          Cache Information
        </h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium text-gray-700">Cache Status:</span>
            <span className="ml-2 text-gray-600">
              {walletData ? "Data available (may be cached)" : "No cached data"}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Cache Duration:</span>
            <span className="ml-2 text-gray-600">30 minutes</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Security:</span>
            <span className="ml-2 text-gray-600">
              Private keys are encrypted with AES-256-GCM
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex space-x-2">
        <button
          onClick={handleRefreshWallet}
          disabled={isLoading}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
        >
          Refresh via Auth Context
        </button>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <h3 className="font-semibold text-gray-700 mb-2">How it works:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>
            • <strong>Get Wallet (Cached):</strong> Retrieves wallet data from
            cache if available, otherwise fetches from API
          </li>
          <li>
            • <strong>Force Refresh:</strong> Always fetches fresh data from the
            SolviumAI API
          </li>
          <li>
            • <strong>Private Key:</strong> Stored encrypted in database,
            decrypted only when needed
          </li>
          <li>
            • <strong>Cache:</strong> Automatically expires after 30 minutes for
            security
          </li>
        </ul>
      </div>
    </div>
  );
}
