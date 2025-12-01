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
  isFixed?: boolean;
  className?: string;
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
  isFixed = true,
  className = "",
}: GameHUDProps) {
  const { user } = useAuth();
  const balance = currentBalance ?? user?.totalSOLV ?? 0;
  const total = totalSolv ?? user?.totalSOLV ?? 0;

  return (
    <div
      className={`z-50 pointer-events-none ${isFixed
        ? "fixed top-4 left-1/2 transform -translate-x-1/2"
        : "relative flex-shrink mx-2"
        } ${className}`}
    >
      <div className="bg-transparent backdrop-blur-md rounded-2xl px-2 sm:px-4 py-1.5 shadow-2xl overflow-hidden max-w-full">
        <div className="flex items-center gap-2 sm:gap-4 whitespace-nowrap overflow-x-auto no-scrollbar">
          {/* Score */}
          {score > 0 && (
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
              <span className="text-white text-xs sm:text-sm font-semibold">Score: {score}</span>
            </div>
          )}

          {/* Points Earned (if any) */}
          {pointsEarned > 0 && (
            <div className="flex items-center gap-1 animate-pulse">
              <Coins className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              <span className="text-green-400 text-xs sm:text-sm font-bold">
                +{pointsEarned}
              </span>
            </div>
          )}

          {/* Multiplier */}
          {showMultiplier && multiplier > 1 && (
            <div className="flex items-center gap-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-1.5 py-0.5 rounded-lg border border-purple-400/30">
              <Zap className="w-3 h-3 text-yellow-300 flex-shrink-0" />
              <span className="text-yellow-300 text-[10px] sm:text-xs font-bold">
                {multiplier.toFixed(1)}x
              </span>
            </div>
          )}

          {/* Total SOLV - Hidden on mobile to save space */}
          <div className="hidden md:flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <span className="text-white text-sm font-semibold">
              {total.toLocaleString()}
            </span>
          </div>

          {/* Current Balance (session) */}
          <div className="flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-yellow-400 opacity-70 flex-shrink-0" />
            <span className="text-white/80 text-xs sm:text-sm font-semibold">
              {balance.toLocaleString()}
            </span>
          </div>

          {/* Level / Difficulty */}
          {(levelLabel || difficultyLabel) && (
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs">
              {levelLabel && (
                <span className="px-1.5 py-0.5 rounded-md bg-white/10 border border-white/10 text-white/90 font-medium">
                  {levelLabel}
                </span>
              )}
              {difficultyLabel && (
                <span className="px-1.5 py-0.5 rounded-md bg-white/10 border border-white/10 text-white/70 hidden sm:inline-block">
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

