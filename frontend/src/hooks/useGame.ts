import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGameConfig } from "@/contexts/GameConfigContext";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { toast } from "sonner";

interface GameState {
  isLoading: boolean;
  gameStarted: boolean;
  gameOver: boolean;
  gameWon: boolean;
  score: number;
  completionTime: number;
  startTime: number;
  error: string | null;
}

interface GameActions {
  startGame: (gameType: string, gameData?: any) => Promise<boolean>;
  completeGame: (gameData: any) => Promise<boolean>;
  resetGame: () => void;
  setError: (error: string | null) => void;
}

export const useGame = (gameType: string) => {
  const { user, fetchUserProfile } = useAuth();
  const { config } = useGameConfig();
  const { accountId: nearAccountId } = usePrivateKeyWallet();

  const [gameState, setGameState] = useState<GameState>({
    isLoading: false,
    gameStarted: false,
    gameOver: false,
    gameWon: false,
    score: 0,
    completionTime: 0,
    startTime: 0,
    error: null,
  });

  const startGame = useCallback(
    async (gameType: string, gameData?: any): Promise<boolean> => {
      if (!user?.id) {
        setGameState((prev) => ({ ...prev, error: "Please log in to play" }));
        return false;
      }

      setGameState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        gameStarted: false,
        gameOver: false,
        gameWon: false,
        score: 0,
        completionTime: 0,
      }));

      try {
        // Game-specific start logic
        if (gameType === "wordle") {
          // Wordle-specific start logic would go here
          setGameState((prev) => ({
            ...prev,
            isLoading: false,
            gameStarted: true,
            startTime: Date.now(),
          }));
          return true;
        } else if (gameType === "quiz") {
          // Quiz-specific start logic
          const response = await fetch(
            `/api/quiz/next?userId=${user.id}&difficulty=${
              gameData?.difficulty || "easy"
            }`
          );
          if (!response.ok) {
            throw new Error("Failed to fetch quiz");
          }
          const data = await response.json();

          setGameState((prev) => ({
            ...prev,
            isLoading: false,
            gameStarted: true,
            startTime: Date.now(),
          }));
          return true;
        }

        return false;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to start game";
        setGameState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        return false;
      }
    },
    [user?.id]
  );

  const completeGame = useCallback(
    async (gameData: any): Promise<boolean> => {
      if (!user?.id || !gameState.gameStarted) {
        return false;
      }

      const completionTime = Date.now() - gameState.startTime;
      const isCorrect = gameData.isCorrect || gameData.won || false;
      const score = gameData.score || (isCorrect ? 1 : 0);

      setGameState((prev) => ({
        ...prev,
        gameOver: true,
        gameWon: isCorrect,
        score,
        completionTime,
      }));

      try {
        // Calculate rewards based on game config
        const gameConfig = config[gameType as keyof typeof config];
        if (!gameConfig) {
          throw new Error(`No config found for game type: ${gameType}`);
        }

        const baseReward = gameConfig.baseWinSOLV || 20;
        const difficultyMultiplier =
          gameConfig.difficultyMultiplier?.[
            gameData.difficulty as keyof typeof gameConfig.difficultyMultiplier
          ] || 1;
        const levelMultiplier =
          1 + gameData.level * (gameConfig.levelMultiplier || 0.1);

        // Calculate time bonus
        let timeBonus = 0;
        if (completionTime < 30000) {
          // Under 30 seconds
          timeBonus = gameConfig.fastCompletionBonus?.under30s || 0;
        } else if (completionTime < 60000) {
          // Under 1 minute
          timeBonus = gameConfig.fastCompletionBonus?.under60s || 0;
        } else if (completionTime < 120000) {
          // Under 2 minutes
          timeBonus = gameConfig.fastCompletionBonus?.under120s || 0;
        }

        const totalRewards = Math.round(
          (baseReward + timeBonus) * difficultyMultiplier * levelMultiplier
        );

        // Submit game completion
        const response = await fetch("/api/games/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
            gameType,
            gameId: gameData.gameId || `daily_${Date.now()}`,
            level: gameData.level || 1,
            difficulty: gameData.difficulty || "easy",
            won: isCorrect,
            score,
            completionTime: Math.round(completionTime / 1000), // Convert to seconds
            hintUsed: gameData.hintUsed || false,
            rewards: totalRewards,
            nearAccountId:
              nearAccountId ||
              (typeof window !== "undefined"
                ? localStorage.getItem("near_account_id") || undefined
                : undefined),
            metadata: {
              ...gameData,
              completionTimeMs: completionTime,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to complete game");
        }

        const result = await response.json();

        // Display total points and boost (from server-calculated pointCalculation)
        try {
          const pc = result?.pointCalculation;
          const finalRewards = Number(
            pc?.totalPoints ?? result?.userUpdate?.rewardsEarned ?? 0
          );
          const baseRewards = Number(pc?.basePoints ?? totalRewards);
          const boost = Number(pc?.boostAmount ?? finalRewards - baseRewards);
          if (Number.isFinite(finalRewards) && finalRewards > 0) {
            const boostLabel = boost > 0 ? ` (+${boost} boost)` : "";
            toast.success(`+${finalRewards} points${boostLabel}`);
          }
        } catch {}

        // Refresh user profile to get updated stats
        await fetchUserProfile();

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to complete game";
        setGameState((prev) => ({
          ...prev,
          error: errorMessage,
        }));
        return false;
      }
    },
    [
      user?.id,
      gameState.gameStarted,
      gameState.startTime,
      config,
      fetchUserProfile,
      nearAccountId,
    ]
  );

  const resetGame = useCallback(() => {
    setGameState({
      isLoading: false,
      gameStarted: false,
      gameOver: false,
      gameWon: false,
      score: 0,
      completionTime: 0,
      startTime: 0,
      error: null,
    });
  }, []);

  const setError = useCallback((error: string | null) => {
    setGameState((prev) => ({ ...prev, error }));
  }, []);

  return {
    gameState,
    actions: {
      startGame,
      completeGame,
      resetGame,
      setError,
    },
  };
};
