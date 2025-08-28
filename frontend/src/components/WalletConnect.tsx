"use client";
import { useState } from "react";
import { usePrivateKeyWallet } from "../app/contexts/PrivateKeyWalletContext";

const WalletConnect = () => {
  const {
    isConnected,
    accountId,
    isLoading,
    error,
    connectWithPrivateKey,
    disconnect,
    autoConnect,
  } = usePrivateKeyWallet();

  const [privateKey, setPrivateKey] = useState("");
  const [accountIdInput, setAccountIdInput] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privateKey.trim() || !accountIdInput.trim()) {
      return;
    }

    try {
      await connectWithPrivateKey(privateKey.trim(), accountIdInput.trim());
      setShowForm(false);
    } catch (err) {
      console.error("Connection failed:", err);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setPrivateKey("");
    setAccountIdInput("");
  };

  const handleRetryAutoConnect = async () => {
    try {
      await autoConnect();
    } catch (err) {
      console.error("Auto-connect retry failed:", err);
    }
  };

  if (isConnected) {
    return (
      <div className="bg-[#1A1A2F] rounded-xl p-4 border border-[#2A2A45] mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#6C5CE7] mb-1">Connected Wallet</p>
            <p className="text-white font-mono text-sm truncate">{accountId}</p>
            <p className="text-xs text-green-400 mt-1">
              ✓ Auto-connected from database
            </p>
          </div>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-[#1A1A2F] rounded-xl p-4 border border-[#2A2A45] mb-4">
        <div className="flex items-center justify-center">
          <div className="w-4 h-4 border-t-2 border-[#4C6FFF] animate-spin rounded-full mr-3"></div>
          <span className="text-white">Connecting wallet...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1A1A2F] rounded-xl p-4 border border-[#2A2A45] mb-4">
        <div className="text-red-400 text-sm mb-3">
          <p className="font-semibold mb-1">Wallet Connection Error:</p>
          <p>{error}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRetryAutoConnect}
            className="flex-1 py-2 bg-[#4C6FFF] hover:bg-[#3B5BEF] text-white rounded-lg text-sm transition-colors"
          >
            Retry Auto-Connect
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
          >
            Manual Connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1A2F] rounded-xl p-4 border border-[#2A2A45] mb-4">
      {!showForm ? (
        <div className="text-center">
          <p className="text-white mb-3">Wallet not connected</p>
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 bg-gradient-to-r from-[#4C6FFF] to-[#6C5CE7] text-white font-bold rounded-xl
                     hover:opacity-90 transition-all duration-300"
          >
            Connect NEAR Wallet
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-sm text-[#6C5CE7] mb-2">
              NEAR Account ID
            </label>
            <input
              type="text"
              value={accountIdInput}
              onChange={(e) => setAccountIdInput(e.target.value)}
              placeholder="your-account.near"
              className="w-full px-4 py-3 bg-[#0B0B14] border border-[#2A2A45] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#4C6FFF]"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[#6C5CE7] mb-2">
              Private Key
            </label>
            <input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="ed25519:..."
              className="w-full px-4 py-3 bg-[#0B0B14] border border-[#2A2A45] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#4C6FFF]"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Your private key is stored locally and never sent to our servers
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 bg-gradient-to-r from-[#4C6FFF] to-[#6C5CE7] text-white font-bold rounded-xl
                       hover:opacity-90 transition-all duration-300 disabled:opacity-50"
            >
              {isLoading ? "Connecting..." : "Connect"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default WalletConnect;
