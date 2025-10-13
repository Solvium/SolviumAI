"use client";

import { ArrowLeft, Info, Copy, Share, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="fixed inset-0 bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] z-50 overflow-y-auto pb-20">
      <div className="max-w-md mx-auto min-h-screen pb-6">
        <div className="px-4 pt-6">
          <div className="flex items-center justify-between mb-8">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10 p-2"
              onClick={onClose}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
            <h1
              className="text-3xl font-bold text-white tracking-wider"
              style={{
                fontFamily: "monospace",
                letterSpacing: "0.2em",
                textShadow: "0 0 10px rgba(255,255,255,0.5)",
              }}
            >
              ADD
            </h1>
            <div className="w-20" />
          </div>

          <div className="space-y-6">
            <div className="bg-[#1a1f3a] rounded-xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
              <p className="text-white/70 text-sm">
                Share your wallet address or QR code to receive NEAR tokens.
                Make sure to double-check the address before sending.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center py-8">
              <div className="bg-white p-8 rounded-3xl shadow-2xl">
                {(() => {
                  try {
                    // Encode just the wallet address in the QR code
                    return (
                      <QRCode
                        value={address}
                        size={200}
                        level="H"
                        includeMargin={true}
                        renderAs="svg"
                      />
                    );
                  } catch (error) {
                    console.error("QR code rendering error:", error);
                    return (
                      <div className="w-[200px] h-[200px] flex items-center justify-center text-red-500">
                        QR Error
                      </div>
                    );
                  }
                })()}
              </div>
              <p className="text-white/50 text-sm mt-4 text-center">
                Scan to send NEAR to this wallet
              </p>
            </div>

            <div className="relative">
              <input
                type="text"
                value={address}
                readOnly
                className="w-full bg-[#1a1f3a] text-white rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                onClick={handleCopy}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-cyan-500 transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
            {copied && (
              <p className="text-green-500 text-sm text-center">
                Address copied to clipboard!
              </p>
            )}

            <div className="flex gap-4 mt-12">
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="flex-1 py-4 border-2 border-white/20 text-white rounded-full text-lg font-medium hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSharing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <Share className="w-5 h-5" />
                    Share
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-4 bg-cyan-500 text-white rounded-full text-lg font-medium hover:bg-cyan-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddFlow;
