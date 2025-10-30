"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  GameConfig,
  DEFAULT_GAME_CONFIG,
  WordleConfig,
  DailyProgress,
} from "@/types/gameConfig";

interface GameConfigContextType {
  config: GameConfig;
  dailyProgress: DailyProgress | null;
  updateWordleConfig: (updates: Partial<WordleConfig>) => void;
  updateDailyProgress: (updates: Partial<DailyProgress>) => void;
  resetConfig: () => void;
  // Future: updatePuzzleConfig, updateWheelConfig, etc.
}

const GameConfigContext = createContext<GameConfigContextType | undefined>(
  undefined
);

const CONFIG_STORAGE_KEY = "solvium-game-config";
const PROGRESS_STORAGE_KEY = "solvium-daily-progress";

export function GameConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<GameConfig>(DEFAULT_GAME_CONFIG);
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(
    null
  );

  // Load config and progress from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        const parsedConfig = JSON.parse(stored);
        // Merge with defaults to handle new config properties
        setConfig({
          ...DEFAULT_GAME_CONFIG,
          ...parsedConfig,
          wordle: {
            ...DEFAULT_GAME_CONFIG.wordle,
            ...parsedConfig.wordle,
          },
        });
      }

      // Load daily progress
      const storedProgress = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (storedProgress) {
        const parsedProgress = JSON.parse(storedProgress);
        const today = new Date().toISOString().split("T")[0];

        // Check if progress is for today, if not reset
        if (parsedProgress.date === today) {
          setDailyProgress(parsedProgress);
        } else {
          // Reset for new day
          const newProgress: DailyProgress = {
            date: today,
            hintsUsed: { Easy: 0, Medium: 0, Hard: 0 },
            gamesPlayed: 0,
            gamesWon: 0,
            currentStreak:
              parsedProgress.gamesWon > 0
                ? parsedProgress.currentStreak + 1
                : 0,
            bestStreak: Math.max(
              parsedProgress.bestStreak,
              parsedProgress.currentStreak
            ),
            totalSOLVEarned: 0,
          };
          setDailyProgress(newProgress);
          localStorage.setItem(
            PROGRESS_STORAGE_KEY,
            JSON.stringify(newProgress)
          );
        }
      } else {
        // First time user
        const today = new Date().toISOString().split("T")[0];
        const newProgress: DailyProgress = {
          date: today,
          hintsUsed: { Easy: 0, Medium: 0, Hard: 0 },
          gamesPlayed: 0,
          gamesWon: 0,
          currentStreak: 0,
          bestStreak: 0,
          totalSOLVEarned: 0,
        };
        setDailyProgress(newProgress);
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(newProgress));
      }
    } catch (error) {
      console.warn("Failed to load game data from localStorage:", error);
    }
  }, []);

  // Save config to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.warn("Failed to save game config to localStorage:", error);
    }
  }, [config]);

  // Save progress to localStorage whenever it changes
  useEffect(() => {
    if (dailyProgress) {
      try {
        localStorage.setItem(
          PROGRESS_STORAGE_KEY,
          JSON.stringify(dailyProgress)
        );
      } catch (error) {
        console.warn("Failed to save daily progress to localStorage:", error);
      }
    }
  }, [dailyProgress]);

  const updateWordleConfig = (updates: Partial<WordleConfig>) => {
    setConfig((prev) => ({
      ...prev,
      wordle: {
        ...prev.wordle,
        ...updates,
      },
    }));
  };

  const updateDailyProgress = (updates: Partial<DailyProgress>) => {
    if (dailyProgress) {
      setDailyProgress((prev) => ({
        ...prev!,
        ...updates,
      }));
    }
  };

  const resetConfig = () => {
    setConfig(DEFAULT_GAME_CONFIG);
  };

  return (
    <GameConfigContext.Provider
      value={{
        config,
        dailyProgress,
        updateWordleConfig,
        updateDailyProgress,
        resetConfig,
      }}
    >
      {children}
    </GameConfigContext.Provider>
  );
}

export function useGameConfig() {
  const context = useContext(GameConfigContext);
  if (context === undefined) {
    throw new Error("useGameConfig must be used within a GameConfigProvider");
  }
  return context;
}
