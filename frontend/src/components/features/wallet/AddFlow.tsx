"use client";

import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode.react";
import { useEffect } from "react";

interface AddFlowProps {
  onClose: () => void;
  accountId?: string | null;
}

const AddFlow = ({ onClose, accountId }: AddFlowProps) => {
  useEffect(() => {
    console.log("[v0] AddFlow mounted");
    console.log("[v0] accountId:", accountId);
    console.log("[v0] accountId type:", typeof accountId);
  }, [accountId]);

  const address = accountId || "0xjdhyg6w...0w9dwdw";

  console.log("[v0] Using address:", address);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] z-50 overflow-y-auto">
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
                Lorem ipsum dolor sit amet, consectetur adipiscing elit aliquam,
                sit amet luctus
              </p>
            </div>

            <div className="flex items-center justify-center py-8">
              <div className="bg-white p-8 rounded-3xl">
                {(() => {
                  try {
                    console.log(
                      "[v0] Attempting to render QR code for:",
                      address
                    );
                    return <QRCode value={address} size={200} level="H" />;
                  } catch (error) {
                    console.error("[v0] QR code rendering error:", error);
                    return (
                      <div className="w-[200px] h-[200px] flex items-center justify-center text-red-500">
                        QR Error
                      </div>
                    );
                  }
                })()}
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                value={address}
                readOnly
                className="w-full bg-[#1a1f3a] text-white rounded-xl px-4 py-3 pr-12 outline-none"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>

            <div className="flex gap-4 mt-12">
              <button className="flex-1 py-4 border-2 border-white/20 text-white rounded-full text-lg font-medium hover:bg-white/5 transition-colors">
                Share
              </button>
              <button className="flex-1 py-4 bg-cyan-500 text-white rounded-full text-lg font-medium hover:bg-cyan-600 transition-colors">
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
