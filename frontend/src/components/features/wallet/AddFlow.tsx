"use client";

import { ChevronLeft, Info, Copy, Share, Check, Search } from "lucide-react";
import QRCode from "qrcode.react";
import { useEffect, useState } from "react";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";

interface AddFlowProps {
  onClose: () => void;
  accountId?: string | null;
}

const AddFlow = ({ onClose, accountId }: AddFlowProps) => {
  const { accountId: walletAccountId } = usePrivateKeyWallet();
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Use the wallet account ID from context, fallback to prop, then fallback to placeholder
  const address = walletAccountId || accountId || "ajemark0.testnet";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const text = `My NEAR wallet: ${address}`;
      const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(
        address
      )}&text=${encodeURIComponent(text)}`;
      window.open(tgUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to open Telegram share:", error);
      try {
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0a0b2e] z-50 flex flex-col">
      {/* Fixed Header */}
      <div className="sticky top-0 z-50 bg-[#0a0b2e] border-b border-white/5">
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white flex items-center gap-1 text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Back</span>
            </button>
            <h1
              className="text-lg font-bold text-white tracking-[0.2em]"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                textShadow: "0 0 15px rgba(99, 102, 241, 0.5)",
              }}
            >
              ADD
            </h1>
            <div className="w-12" />
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-20">

          <div className="space-y-4">
            {/* Info Box */}
            <div className="bg-[#1a1d3f]/50 rounded-xl p-3 flex items-start gap-2.5 border border-white/10">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-white/60 text-xs leading-relaxed">
                Scan this code to receive tokens to your Solvium wallet address.
              </p>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center py-5">
              <div className="bg-white p-5 rounded-2xl shadow-2xl">
                {(() => {
                  try {
                    return (
                      <QRCode
                        value={address}
                        size={170}
                        level="H"
                        includeMargin={true}
                        renderAs="svg"
                      />
                    );
                  } catch (error) {
                    console.error("QR code rendering error:", error);
                    return (
                      <div className="w-[170px] h-[170px] flex items-center justify-center text-red-500 text-xs">
                        QR Error
                      </div>
                    );
                  }
                })()}
              </div>
            </div>

            {/* Address Input */}
            <div className="relative">
              <input
                type="text"
                value={address}
                readOnly
                className="w-full bg-[#1a1d3f] text-white/80 rounded-xl px-3.5 py-2.5 pr-11 outline-none text-xs border border-white/10"
              />
              <button
                onClick={handleCopy}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-blue-400 transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="flex-1 py-3 border-2 border-white/20 text-white rounded-xl text-sm font-semibold hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSharing ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                    <span>Sharing...</span>
                  </>
                ) : (
                  <span>Share</span>
                )}
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddFlow;
