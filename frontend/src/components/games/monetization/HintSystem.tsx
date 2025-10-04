"use client";

import type React from "react";
import { useState } from "react";
import { Lightbulb, X, Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface HintSystemProps {
  hintCost: number;
  hint: string;
  userCoins: number;
  onUseHint: () => void;
}

const HintSystem: React.FC<HintSystemProps> = ({
  hintCost,
  hint,
  userCoins,
  onUseHint,
}) => {
  const [hintRevealed, setHintRevealed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleUseHint = () => {
    if (userCoins < hintCost) {
      toast.error("Not enough SOLV!", {
        description: "Purchase more SOLV to use hints.",
      });
      return;
    }

    setHintRevealed(true);
    onUseHint();
    toast.success("Hint unlocked!", {
      description: `${hintCost} SOLV have been deducted.`,
    });
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1 bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-400/50 text-yellow-300 hover:text-yellow-200"
        onClick={openModal}
      >
        <Lightbulb className="h-4 w-4" />
        Hint
      </Button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-600/50 w-80 max-h-[90vh] flex flex-col overflow-y-auto">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
            >
              <X className="h-4 w-4 text-slate-300" />
            </button>

            <div className="flex flex-col items-center pt-8 pb-6">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
                <Lightbulb className="h-8 w-8 text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Need a Hint?</h3>
            </div>

            <div className="flex-1 px-6 pb-6 flex flex-col justify-between">
              {hintRevealed ? (
                <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-xl p-4 text-center">
                  <p className="text-yellow-200 font-medium leading-relaxed">
                    {hint}
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Stuck on this puzzle? Get a helpful hint to guide you in the
                    right direction!
                  </p>

                  <div className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-center gap-2">
                    <Coins className="h-4 w-4 text-yellow-400" />
                    <span className="text-white font-medium">
                      {userCoins} SOLV
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-3 mt-6">
                {!hintRevealed && (
                  <Button
                    onClick={handleUseHint}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 rounded-xl transition-all duration-200 transform hover:scale-105"
                    disabled={userCoins < hintCost}
                  >
                    Use {hintCost} SOLV for Hint
                  </Button>
                )}

                <Button
                  onClick={closeModal}
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700/50 py-3 rounded-xl bg-transparent"
                >
                  {hintRevealed ? "Continue Playing" : "Maybe Later"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HintSystem;
