import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGame } from "./useGame";

interface Quiz {
  id: string;
  question: string;
  options: string[];
  difficulty: number;
  category: string;
  points: number;
  correctAnswer?: string; // Optional since API doesn't return it
}

interface QuizState {
  currentQuiz: Quiz | null;
  selectedAnswer: string | null;
  timeRemaining: number;
  isAnswered: boolean;
  showResult: boolean;
  isCorrect: boolean;
  dailyQuizzesCompleted: number;
  dailyLimit: number;
  selectedCategory: string;
  selectedDifficulty: string;
}

interface QuizActions {
  fetchQuiz: (difficulty?: string, category?: string) => Promise<boolean>;
  selectAnswer: (answer: string) => void;
  submitAnswer: () => Promise<boolean>;
  nextQuiz: () => Promise<boolean>;
  checkDailyLimit: () => Promise<boolean>;
}

export const useQuiz = () => {
  const { user } = useAuth();
  const { gameState, actions: gameActions } = useGame("quiz");

  const [quizState, setQuizState] = useState<QuizState>({
    currentQuiz: null,
    selectedAnswer: null,
    timeRemaining: 60000, // 1 minute in milliseconds
    isAnswered: false,
    showResult: false,
    isCorrect: false,
    dailyQuizzesCompleted: 0,
    dailyLimit: 50,
    selectedCategory: "all",
    selectedDifficulty: "easy",
  });

  const setTimeRemaining = useCallback((time: number) => {
    setQuizState((prev) => ({ ...prev, timeRemaining: time }));
  }, []);

  const fetchQuiz = useCallback(
    async (difficulty?: string, category?: string): Promise<boolean> => {
      if (!user?.id) {
        return false;
      }

      try {
        // Check daily limit using current state (already fetched by checkDailyLimit)
        // Only make API call if we haven't checked recently or state is stale
        if (quizState.dailyQuizzesCompleted >= quizState.dailyLimit) {
          gameActions.setError(
            "Daily quiz limit reached (50 per day). Please come back tomorrow."
          );
          return false;
        }

        // First, check if we need to trigger daily quiz generation
        const fetchResponse = await fetch("/api/quiz/fetch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: user.id }),
        });

        if (!fetchResponse.ok) {
          console.error("Failed to check quiz availability");
        }

        // Get next quiz
        const params = new URLSearchParams({
          userId: user.id.toString(),
          ...(difficulty && { difficulty }),
          ...(category && { category }),
        });

        const response = await fetch(`/api/quiz/next?${params}`);

        if (!response.ok) {
          if (response.status === 404) {
            const errorData = await response.json();
            if (errorData.generating) {
              throw new Error(
                "Quiz generation in progress. Please try again in a moment."
              );
            }
            throw new Error(
              "No available quizzes found. Please try again later."
            );
          } else if (response.status === 403) {
            const limitError = await response.json().catch(() => ({}));
            setQuizState((prev) => ({
              ...prev,
              dailyQuizzesCompleted:
                limitError?.completedToday ?? prev.dailyQuizzesCompleted,
              dailyLimit: limitError?.limit ?? prev.dailyLimit,
            }));
            throw new Error(
              limitError?.error ||
                "Daily quiz limit reached (50 per day). Please come back tomorrow."
            );
          }
          throw new Error("Failed to fetch quiz");
        }

        const data = await response.json();

        if (!data.success || !data.quiz) {
          throw new Error("Invalid quiz data received");
        }

        setQuizState((prev) => ({
          ...prev,
          currentQuiz: data.quiz,
          selectedAnswer: null,
          timeRemaining: 60000, // Reset timer
          isAnswered: false,
          showResult: false,
          isCorrect: false,
          selectedCategory: category || "all",
          selectedDifficulty: difficulty || "easy",
        }));

        return true;
      } catch (error) {
        console.error("Error fetching quiz:", error);
        gameActions.setError(
          error instanceof Error ? error.message : "Failed to fetch quiz"
        );
        return false;
      }
    },
    [
      user?.id,
      gameActions,
      quizState.dailyQuizzesCompleted,
      quizState.dailyLimit,
    ]
  );

  const selectAnswer = useCallback(
    (answer: string) => {
      if (quizState.isAnswered) return;

      setQuizState((prev) => ({
        ...prev,
        selectedAnswer: answer,
      }));
    },
    [quizState.isAnswered]
  );

  const submitAnswer = useCallback(async (): Promise<{
    success: boolean;
    isCorrect?: boolean;
    points?: number;
  }> => {
    if (
      !quizState.currentQuiz ||
      !quizState.selectedAnswer ||
      quizState.isAnswered
    ) {
      return { success: false };
    }

    try {
      // Validate answer with backend
      const response = await fetch("/api/quiz/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId: quizState.currentQuiz.id,
          selectedAnswer: quizState.selectedAnswer,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to validate answer");
      }

      const result = await response.json();
      const isCorrect = result.isCorrect;
      const timeTaken = 60000 - quizState.timeRemaining; // Time used in milliseconds

      setQuizState((prev) => ({
        ...prev,
        isAnswered: true,
        showResult: true,
        isCorrect,
      }));

      // Complete the game
      // For quiz games, rewards come from the validation result (result.points)
      // This is the base points before multiplier
      const baseRewards = result.points || 0;

      const gameCompleted = await gameActions.completeGame({
        gameId: quizState.currentQuiz.id,
        isCorrect,
        won: isCorrect, // Add won field
        score: result.points,
        rewards: baseRewards, // Pass the base rewards from validation
        timeTaken,
        selectedAnswer: quizState.selectedAnswer,
        correctAnswer: result.correctAnswer,
        question: quizState.currentQuiz.question,
        category: quizState.currentQuiz.category,
        difficulty: quizState.currentQuiz.difficulty,
      });

      if (gameCompleted) {
        setQuizState((prev) => ({
          ...prev,
          dailyQuizzesCompleted: prev.dailyQuizzesCompleted + 1,
        }));
      }

      return {
        success: gameCompleted,
        isCorrect: result.isCorrect,
        points: result.points,
      };
    } catch (error) {
      console.error("Answer validation failed:", error);
      return { success: false };
    }
  }, [quizState, gameActions]);

  const nextQuiz = useCallback(async (): Promise<boolean> => {
    if (quizState.dailyQuizzesCompleted >= quizState.dailyLimit) {
      gameActions.setError("Daily quiz limit reached");
      return false;
    }

    return await fetchQuiz(
      quizState.selectedDifficulty,
      quizState.selectedCategory
    );
  }, [
    quizState.dailyQuizzesCompleted,
    quizState.dailyLimit,
    quizState.selectedDifficulty,
    quizState.selectedCategory,
    fetchQuiz,
    gameActions,
  ]);

  const checkDailyLimit = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const response = await fetch(`/api/quiz/daily-limit?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();

        setQuizState((prev) => ({
          ...prev,
          dailyLimit: data?.limit ?? prev.dailyLimit,
          dailyQuizzesCompleted: data?.completedToday ?? 0,
        }));

        return Boolean(data?.hasRemaining);
      } else if (response.status === 403) {
        const limitError = await response.json().catch(() => ({}));
        setQuizState((prev) => ({
          ...prev,
          dailyLimit: limitError?.limit ?? prev.dailyLimit,
          dailyQuizzesCompleted:
            limitError?.completedToday ?? prev.dailyQuizzesCompleted,
        }));
        return false;
      }
      return true; // Assume limit not reached if API fails
    } catch (error) {
      console.error("Error checking daily limit:", error);
      return true; // Assume limit not reached if API fails
    }
  }, [user?.id]);

  // Memoize actions object to prevent unnecessary re-renders
  const actions = useMemo(
    () => ({
      ...gameActions,
      fetchQuiz,
      selectAnswer,
      submitAnswer,
      nextQuiz,
      checkDailyLimit,
      setTimeRemaining,
    }),
    [
      gameActions,
      fetchQuiz,
      selectAnswer,
      submitAnswer,
      nextQuiz,
      checkDailyLimit,
      setTimeRemaining,
    ]
  );

  return {
    gameState,
    quizState,
    actions,
  };
};
