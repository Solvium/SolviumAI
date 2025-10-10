import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface TaskProgress {
  dailyLoginStreak: number;
  maxStreak: number;
  lastLoginDate: string | null;
  firstGameCompleted: boolean;
  weeklyRank: number | null;
  weeklyScore: number;
}

export const useTaskProgress = () => {
  const { user, refreshUser } = useAuth();
  const [taskProgress, setTaskProgress] = useState<TaskProgress>({
    dailyLoginStreak: 0,
    maxStreak: 7,
    lastLoginDate: null,
    firstGameCompleted: false,
    weeklyRank: null,
    weeklyScore: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Calculate daily login streak using claimCount and lastClaim
  const calculateLoginStreak = useCallback(() => {
    if (!user?.lastClaim) return 0;

    const lastLogin = new Date(user.lastClaim);
    const today = new Date();
    const diffTime = today.getTime() - lastLogin.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // If last login was today, maintain streak
    if (diffDays === 0) {
      return user.claimCount || 0;
    }
    // If last login was yesterday, increment streak
    else if (diffDays === 1) {
      return (user.claimCount || 0) + 1;
    }
    // If more than 1 day, reset streak
    else {
      return 1; // Start new streak
    }
  }, [user]);

  // Check if first game is completed using known counters
  const checkFirstGameCompleted = useCallback(() => {
    const totalGames = (user?.puzzleCount || 0) + (user?.spinCount || 0);
    return totalGames > 0;
  }, [user]);

  // Get weekly rank and score using weeklyPoints
  const getWeeklyStats = useCallback(() => {
    return {
      rank: null, // TODO: Implement weekly ranking system
      score: user?.weeklyPoints || 0,
    };
  }, [user]);

  // Update task progress
  const updateTaskProgress = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const loginStreak = calculateLoginStreak();
      const firstGameCompleted = checkFirstGameCompleted();
      const weeklyStats = getWeeklyStats();

      setTaskProgress({
        dailyLoginStreak: loginStreak,
        maxStreak: 7,
        lastLoginDate: user.lastClaim
          ? new Date(user.lastClaim).toISOString()
          : null,
        firstGameCompleted,
        weeklyRank: weeklyStats.rank,
        weeklyScore: weeklyStats.score,
      });
    } catch (error) {
      console.error("Error updating task progress:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, calculateLoginStreak, checkFirstGameCompleted, getWeeklyStats]);

  // Complete daily login task via API
  const completeDailyLogin = useCallback(async (): Promise<
    | { status: "new"; streak: number }
    | {
        status: "already";
        nextResetAt: string;
        timeLeft: string;
        streak: number;
      }
    | { status: "error" }
  > => {
    if (!user) {
      console.log("No user found, cannot complete daily login");
      return { status: "error" };
    }

    try {
      console.log("[daily-login] Posting to /api/auth/login-track...", {
        userId: user.id,
        currentLastClaim: user.lastClaim || null,
        currentClaimCount: user.claimCount || 0,
      });
      // First, track the login
      const loginResponse = await fetch("/api/auth/login-track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const loginResult = await loginResponse.json();
      console.log("[daily-login] login-track response:", {
        status: loginResponse.status,
        streak: loginResult?.streak,
        isNewDay: loginResult?.isNewDay,
        lastLogin: loginResult?.lastLogin,
        newLogin: loginResult?.newLogin,
        nextClaimAt: loginResult?.nextClaimAt,
        timeLeftMs: loginResult?.timeLeftMs,
      });

      if (!loginResponse.ok || !loginResult.success) {
        console.error("Failed to track login:", loginResult.error);
        return { status: "error" };
      }

      // If it's a new day, award SOLV points
      if (loginResult.isNewDay) {
        console.log(
          "[daily-login] New day detected. Posting to /api/tasks for reward..."
        );
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: user.username,
            type: "daily_login",
            data: {
              streak: loginResult.streak,
              userId: user.id,
            },
            userMultipler: user.multiplier || 1,
          }),
        });

        const result = await response.json();
        console.log("[daily-login] /api/tasks result:", {
          status: response.status,
          streak: result?.streak,
          solvEarned: result?.solvEarned,
          lastLogin: result?.lastLogin,
          newLogin: result?.newLogin,
          nextClaimAt: result?.nextClaimAt,
          timeLeftMs: result?.timeLeftMs,
        });

        if (response.ok && result.success) {
          // Optimistically update streak immediately using server result
          if (typeof result.streak === "number") {
            setTaskProgress((prev) => ({
              ...prev,
              dailyLoginStreak: result.streak,
              lastLoginDate: result.newLogin || new Date().toISOString(),
            }));
          }

          // Ensure the latest profile is loaded (totalSOLV, claimCount, lastClaim)
          try {
            await refreshUser();
          } catch {}
          await updateTaskProgress();
          return { status: "new", streak: result.streak ?? loginResult.streak };
        }
        return { status: "error" };
      } else {
        // Already logged in today, compute next reset and inform caller
        await updateTaskProgress();
        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 0, 0);
        const ms = nextMidnight.getTime() - now.getTime();
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const timeLeft = `${hours}h ${minutes}m`;
        return {
          status: "already",
          nextResetAt: nextMidnight.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          timeLeft,
          streak: loginResult.streak,
        };
      }
    } catch (error) {
      console.error("Error completing daily login:", error);
      return { status: "error" };
    }
  }, [user, updateTaskProgress]);

  // Complete first game task via API
  const completeFirstGame = useCallback(async () => {
    if (!user) {
      console.log("No user found, cannot complete first game");
      return false;
    }

    // Allow claiming the reward even if game was already played
    // The API will handle duplicate prevention
    console.log("Attempting to complete first game task...");

    try {
      console.log(
        "[first-game] Posting to /api/tasks (first_game_completed)..."
      );
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: user.username,
          type: "first_game_completed",
          data: {
            userId: user.id,
          },
          userMultipler: user.multiplier || 1,
        }),
      });

      const result = await response.json();
      console.log("[first-game] /api/tasks response:", response.status, result);

      if (response.ok && result.success) {
        if (result.alreadyClaimed) {
          console.log("[first-game] Reward already claimed, no SOLV awarded.");
        } else {
          console.log(
            "[first-game] Reward granted:",
            result.solvEarned,
            "SOLV"
          );
        }
        await updateTaskProgress();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error completing first game:", error);
      return false;
    }
  }, [user, taskProgress.firstGameCompleted, updateTaskProgress]);

  // Check if first game is completed (this is automatically updated when games are played)
  const checkFirstGameStatus = useCallback(() => {
    const totalGames = (user?.puzzleCount || 0) + (user?.spinCount || 0);
    const isCompleted = totalGames > 0;
    console.log(
      `First game status: ${
        isCompleted ? "Completed" : "Not completed"
      } (puzzleCount: ${user?.puzzleCount || 0}, spinCount: ${
        user?.spinCount || 0
      })`
    );
    return isCompleted;
  }, [user]);

  // Update progress when user changes
  useEffect(() => {
    updateTaskProgress();
  }, [updateTaskProgress]);

  return {
    taskProgress,
    isLoading,
    updateTaskProgress,
    completeDailyLogin,
    completeFirstGame,
    checkFirstGameStatus,
  };
};
