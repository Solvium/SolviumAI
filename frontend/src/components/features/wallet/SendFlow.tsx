"use client";

import { useState } from "react";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { ArrowLeft, QrCode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SendFlowProps {
  onClose: () => void;
  onSuccess: () => void;
}

type SendStep = "amount" | "recipient" | "confirm";

const SendFlow = ({ onClose, onSuccess }: SendFlowProps) => {
  const [step, setStep] = useState<SendStep>("amount");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sendNearNative } = usePrivateKeyWallet();

  // TODO: Implement contact management system
  // This could fetch recent transaction recipients from the database
  // or allow users to save/manage their contacts
  const contacts: Array<{ name: string; address: string; avatar?: string }> =
    [];

  const handleNumberClick = (num: string) => {
    if (num === "." && amount.includes(".")) return;
    setAmount((prev) => prev + num);
  };

  const handleBackspace = () => {
    setAmount((prev) => prev.slice(0, -1));
  };

  const handleConfirm = async () => {
    if (step === "amount") {
      setStep("recipient");
    } else if (step === "recipient") {
      // Execute native NEAR transfer
      setError(null);
      if (!amount || !recipient) return;
      // Convert human NEAR string to yoctoNEAR precisely
      const normalized = amount.trim();
      if (!/^\d*(?:\.\d+)?$/.test(normalized)) {
        setError("Invalid amount");
        return;
      }
      const [w = "0", f = ""] = normalized.split(".");
      const frac24 = (f + "0".repeat(24)).slice(0, 24);
      const yocto = (
        BigInt(w) * BigInt(10) ** BigInt(24) +
        BigInt(frac24)
      ).toString();
      try {
        setSubmitting(true);
        await sendNearNative(recipient.trim(), yocto);
        onSuccess();
      } catch (e: any) {
        setError(e?.message || "Failed to send NEAR");
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (step === "amount") {
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
                SEND
              </h1>
              <div className="w-20" />
            </div>

            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="text-white/50 text-sm">Enter Amount</div>
                <div className="flex items-center justify-center gap-2">
                  <div className="text-white text-4xl font-light min-w-[200px] text-center">
                    {amount || "|"}
                  </div>
                </div>
                <button className="px-6 py-2 bg-[#0075EA] text-white rounded-full text-sm font-medium hover:bg-cyan-600 transition-colors">
                  Max
                </button>
              </div>

              <div className="mt-8">
                <div className="text-white/70 text-sm mb-3">
                  Available Balance
                </div>
                <div className="bg-[#1a1f3a] rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">₿</span>
                    </div>
                    <div>
                      <div className="text-white font-medium">BTC</div>
                      <div className="text-white/50 text-xs">Bitcoin</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <svg className="w-16 h-8" viewBox="0 0 60 30">
                      <polyline
                        points="0,20 10,15 20,18 30,10 40,12 50,8 60,5"
                        fill="none"
                        stroke="#00d4ff"
                        strokeWidth="2"
                      />
                    </svg>
                    <div className="text-right">
                      <div className="text-white font-bold">3.00912</div>
                      <div className="text-white/50 text-xs">($3000)</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-12">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleNumberClick(num.toString())}
                    className="h-16 text-white text-2xl font-light hover:bg-white/10 rounded-xl transition-colors"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => handleNumberClick(".")}
                  className="h-16 text-white text-2xl font-light hover:bg-white/10 rounded-xl transition-colors"
                >
                  .
                </button>
                <button
                  onClick={() => handleNumberClick("0")}
                  className="h-16 text-white text-2xl font-light hover:bg-white/10 rounded-xl transition-colors"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  className="h-16 text-white hover:bg-white/10 rounded-xl transition-colors flex items-center justify-center"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </button>
              </div>

              <button
                onClick={handleConfirm}
                disabled={!amount}
                className="w-full py-4 bg-[#0075EA] text-white rounded-full text-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-8"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "recipient") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] z-50 overflow-y-auto">
        <div className="max-w-md mx-auto min-h-screen pb-6">
          <div className="px-4 pt-6">
            <div className="flex items-center justify-between mb-8">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10 p-2"
                onClick={() => setStep("amount")}
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
                SEND
              </h1>
              <div className="w-20" />
            </div>

            <div className="space-y-6">
              <div>
                <div className="text-[#0075EA] text-sm mb-3">Send To</div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter recipient address"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full bg-[#1a1f3a] text-white/50 rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0075EA]">
                    <QrCode className="w-5 h-5" />
                  </button>
                </div>
                <button className="text-[#0075EA] text-sm mt-2 flex items-center gap-1">
                  <span className="text-lg">+</span> Add this to your address
                  book
                </button>
              </div>

              <div>
                <div className="text-white text-sm mb-3">Address Book</div>
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search recipient"
                    className="w-full bg-[#1a1f3a] text-white/50 rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 w-5 h-5" />
                </div>

                <div className="space-y-3">
                  {contacts.length > 0 ? (
                    contacts.map((contact, idx) => (
                      <button
                        key={idx}
                        onClick={() => setRecipient(contact.address)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex-shrink-0" />
                        <div className="text-left">
                          <div className="text-white font-medium">
                            {contact.name}
                          </div>
                          <div className="text-white/50 text-sm">
                            {contact.address}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-white/50 text-sm mb-2">
                        No saved contacts
                      </div>
                      <div className="text-white/30 text-xs">
                        Enter a wallet address manually or save contacts for
                        quick access
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm mt-2">{error}</div>
              )}
              <button
                onClick={handleConfirm}
                disabled={!recipient || submitting}
                className="w-full py-4 bg-[#0075EA] text-white rounded-full text-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-8"
              >
                {submitting ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SendFlow;
