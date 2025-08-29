"use client";

import { useState } from "react";
import { useWalletCheck } from "@/app/hooks/useWalletCheck";
import { WalletCheckResponse, WalletInfo } from "@/lib/crypto";

export default function WalletChecker() {
  const [telegramUserId, setTelegramUserId] = useState<string>("");
  const [walletInfo, setWalletInfo] = useState<WalletCheckResponse | null>(
    null
  );
  const { checkWallet, isLoading, error, clearError } = useWalletCheck();

  const handleCheckWallet = async () => {
    const userId = parseInt(telegramUserId);
    if (isNaN(userId) || userId <= 0) {
      alert("Please enter a valid Telegram user ID (positive number)");
      return;
    }

    const result = await checkWallet(userId);
    setWalletInfo(result);
  };

  const handleClear = () => {
    setTelegramUserId("");
    setWalletInfo(null);
    clearError();
  };

  const renderWalletDetails = (info: WalletInfo) => {
    return (
      <div className="mt-3 space-y-2 text-sm">
        <div>
          <span className="font-medium text-gray-700">Account ID:</span>
          <span className="ml-2 font-mono text-gray-600 break-all">
            {info.account_id}
          </span>
        </div>
        <div>
          <span className="font-medium text-gray-700">Public Key:</span>
          <span className="ml-2 font-mono text-gray-600 break-all">
            {info.public_key}
          </span>
        </div>
        <div>
          <span className="font-medium text-gray-700">Network:</span>
          <span className="ml-2 text-gray-600">{info.network}</span>
        </div>
        <div>
          <span className="font-medium text-gray-700">Demo:</span>
          <span className="ml-2 text-gray-600">
            {info.is_demo ? "Yes" : "No"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Wallet Checker</h2>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="telegramUserId"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Telegram User ID
          </label>
          <input
            id="telegramUserId"
            type="number"
            value={telegramUserId}
            onChange={(e) => setTelegramUserId(e.target.value)}
            placeholder="Enter Telegram User ID (e.g., 1447332196)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleCheckWallet}
            disabled={isLoading || !telegramUserId}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Checking..." : "Check Wallet"}
          </button>

          <button
            onClick={handleClear}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Clear
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {walletInfo && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <h3 className="font-semibold text-green-800 mb-2">
              Wallet Information
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-700">Has Wallet:</span>
                <span className="ml-2 text-green-600">
                  {walletInfo.has_wallet ? "Yes" : "No"}
                </span>
              </div>

              {walletInfo.wallet_info &&
                renderWalletDetails(walletInfo.wallet_info)}

              {walletInfo.message && (
                <div>
                  <span className="font-medium text-gray-700">Message:</span>
                  <span className="ml-2 text-gray-600">
                    {walletInfo.message}
                  </span>
                </div>
              )}

              {walletInfo.error && (
                <div>
                  <span className="font-medium text-gray-700">Error:</span>
                  <span className="ml-2 text-red-600">{walletInfo.error}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
