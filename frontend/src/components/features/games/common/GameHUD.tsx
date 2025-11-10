"use client";

import { Coins, Zap, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface GameHUDProps {
  score?: number;
  pointsEarned?: number;
  multiplier?: number;
  currentBalance?: number;
  showMultiplier?: boolean;
  totalSolv?: number;
  levelLabel?: string; // e.g., "L7"
  difficultyLabel?: string; // e.g., "Hard"
}

export default function GameHUD({
  score = 0,
  pointsEarned = 0,
  multiplier = 1,
  currentBalance,
  showMultiplier = true,
  totalSolv,
  levelLabel,
  difficultyLabel,
}: GameHUDProps) {
  const { user } = useAuth();
  const balance = currentBalance ?? user?.totalSOLV ?? 0;
  const total = totalSolv ?? user?.totalSOLV ?? 0;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
      <div className="bg-black/60 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Score */}
          {score > 0 && (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-yellow-400" />
              <span className="text-white text-sm font-semibold">Score: {score}</span>
            </div>
          )}

          {/* Points Earned (if any) */}
          {pointsEarned > 0 && (
            <div className="flex items-center gap-1.5 animate-pulse">
              <Coins className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm font-bold">
                +{pointsEarned}
              </span>
            </div>
          )}

          {/* Multiplier */}
          {showMultiplier && multiplier > 1 && (
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-2 py-1 rounded-lg border border-purple-400/30">
              <Zap className="w-3.5 h-3.5 text-yellow-300" />
              <span className="text-yellow-300 text-xs font-bold">
                {multiplier.toFixed(1)}x
              </span>
            </div>
          )}

          {/* Total SOLV */}
          <div className="hidden sm:flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-white text-sm font-semibold">
              {total.toLocaleString()}
            </span>
          </div>

          {/* Current Balance (session) */}
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-yellow-400 opacity-70" />
            <span className="text-white/80 text-xs sm:text-sm font-semibold">
              {balance.toLocaleString()}
            </span>
          </div>

          {/* Level / Difficulty */}
          {(levelLabel || difficultyLabel) && (
            <div className="flex items-center gap-2 text-xs">
              {levelLabel && (
                <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-white/90 font-medium">
                  {levelLabel}
                </span>
              )}
              {difficultyLabel && (
                <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-white/70">
                  {difficultyLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

