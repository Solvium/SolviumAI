"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

// Game types
export type GameType = "wordle" | "puzzle" | "quiz" | "wheel";

// Game state interface
export interface GameState {
  currentGame: GameType | null;
  isPlaying: boolean;
  gameStartTime: number | null;
  hintsUsed: number;
  userBalance: number;
  isLoading: boolean;
  error: string | null;
}

// Game actions interface
export interface GameActions {
  startGame: (gameType: GameType) => void;
  endGame: () => void;
  useHint: (
    gameType: GameType,
    hintCost: number,
    hintData?: any
  ) => Promise<boolean>;
  completeGame: (gameData: GameCompletionData) => Promise<GameCompletionResult>;
  fetchUserBalance: () => Promise<void>;
  resetGameState: () => void;
}

// Game completion data interface
export interface GameCompletionData {
  gameType: GameType;
  gameId: string;
  level: number;
  difficulty: string;
  won: boolean;
  score: number;
  completionTime: number;
  hintUsed: boolean;
  hintCost?: number;
  rewards: number;
  metadata?: any;
}

// Game completion result interface
export interface GameCompletionResult {
  success: boolean;
  message: string;
  gameResult?: {
    id: number;
    gameType: string;
  };
  userUpdate?: {
    levelUp: boolean;
    newLevel: number;
    totalGamesWon: number;
    rewardsEarned: number;
    newBalance: number;
  };
  error?: string;
}

// Game context type
export interface GameContextType extends GameState, GameActions {}

// Create context
const GameContext = createContext<GameContextType | undefined>(undefined);

// Game context provider
export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // State
  const [currentGame, setCurrentGame] = useState<GameType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [userBalance, setUserBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user balance
  const fetchUserBalance = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/games/stats?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setUserBalance(data.user.totalSOLV);
      }
    } catch (error) {
      console.error("Error fetching user balance:", error);
    }
  }, [user?.id]);

  // Start game
  const startGame = useCallback((gameType: GameType) => {
    setCurrentGame(gameType);
    setIsPlaying(true);
    setGameStartTime(Date.now());
    setHintsUsed(0);
    setError(null);
    console.log(`🎮 Starting ${gameType} game`);
  }, []);

  // End game
  const endGame = useCallback(() => {
    setCurrentGame(null);
    setIsPlaying(false);
    setGameStartTime(null);
    setHintsUsed(0);
    setError(null);
    console.log("🎮 Game ended");
  }, []);

  // Use hint
  const useHint = useCallback(
    async (
      gameType: GameType,
      hintCost: number,
      hintData?: any
    ): Promise<boolean> => {
      if (!user?.id) {
        toast.error("Please log in to use hints");
        return false;
      }

      if (userBalance < hintCost) {
        toast.error("Insufficient SOLV balance for hint");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/games/hints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            gameType,
            hintCost,
            hintData,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setHintsUsed((prev) => prev + 1);
          setUserBalance(result.newBalance);
          toast.success(`Hint used! -${hintCost} SOLV`);
          console.log(`💡 Hint used for ${gameType}:`, result);
          return true;
        } else {
          setError(result.error || "Failed to use hint");
          toast.error(result.error || "Failed to use hint");
          return false;
        }
      } catch (error) {
        const errorMessage = "Network error while using hint";
        setError(errorMessage);
        toast.error(errorMessage);
        console.error("Hint error:", error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, userBalance]
  );

  // Complete game
  const completeGame = useCallback(
    async (gameData: GameCompletionData): Promise<GameCompletionResult> => {
      if (!user?.id) {
        return {
          success: false,
          message: "User not logged in",
          error: "Authentication required",
        };
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/games/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            ...gameData,
            // Pass multiplier from context for optimization (server will validate it)
            clientMultiplier: user.multiplier,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Update user balance if rewards were earned
          if (result.userUpdate?.newBalance !== undefined) {
            setUserBalance(result.userUpdate.newBalance);
          }

          // Show success message
          if (gameData.won) {
            toast.success(
              `Game won! +${result.userUpdate?.rewardsEarned || 0} SOLV! 🎉`
            );
          } else {
            toast.info("Game completed");
          }

          // Show level up message
          if (result.userUpdate?.levelUp) {
            toast.success(
              `Level up! You're now level ${result.userUpdate.newLevel}! 🚀`
            );
          }

          console.log(`🎮 Game completed:`, result);
          return result;
        } else {
          setError(result.error || "Failed to complete game");
          toast.error(result.error || "Failed to complete game");
          return {
            success: false,
            message: result.error || "Failed to complete game",
            error: result.error,
          };
        }
      } catch (error) {
        const errorMessage = "Network error while completing game";
        setError(errorMessage);
        toast.error(errorMessage);
        console.error("Game completion error:", error);
        return {
          success: false,
          message: errorMessage,
          error: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id]
  );

  // Reset game state
  const resetGameState = useCallback(() => {
    setCurrentGame(null);
    setIsPlaying(false);
    setGameStartTime(null);
    setHintsUsed(0);
    setError(null);
  }, []);

  // Fetch user balance on mount and when user changes
  useEffect(() => {
    fetchUserBalance();
  }, [fetchUserBalance]);

  // Context value
  const contextValue: GameContextType = {
    // State
    currentGame,
    isPlaying,
    gameStartTime,
    hintsUsed,
    userBalance,
    isLoading,
    error,

    // Actions
    startGame,
    endGame,
    useHint,
    completeGame,
    fetchUserBalance,
    resetGameState,
  };

  return (
    <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>
  );
}

// Hook to use game context
export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}

// Hook for specific game types
export function useGameType(gameType: GameType) {
  const game = useGame();

  return {
    ...game,
    isCurrentGame: game.currentGame === gameType,
    startThisGame: () => game.startGame(gameType),
    useHintForThisGame: (hintCost: number, hintData?: any) =>
      game.useHint(gameType, hintCost, hintData),
  };
}

