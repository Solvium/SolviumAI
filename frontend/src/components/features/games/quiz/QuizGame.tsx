"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuiz } from "@/hooks/useQuiz";
import { useAuth } from "@/contexts/AuthContext";
import { useDepositMultiplier } from "@/hooks/useDepositMultiplier";
import { useSolviumContract } from "@/hooks/useSolviumContract";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import GameHUD from "../common/GameHUD";

interface QuizGameProps {
  onEarnCoins?: (amount: number) => void;
  onClose?: () => void;
}

const QuizGame: React.FC<QuizGameProps> = ({
  onEarnCoins = () => { },
  onClose,
}) => {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { gameState, quizState, actions } = useQuiz();
  const { currentMultiplier, fetchCurrentMultiplier } = useDepositMultiplier();
  const { getUserDepositSummary } = useSolviumContract();
  const { accountId, isConnected } = usePrivateKeyWallet();

  // State for effective user multiplier (totalNear * contractMul)
  const [effectiveUserMultiplier, setEffectiveUserMultiplier] =
    useState<number>(1);

  // Local state for UI
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [userCoins, setUserCoins] = useState(150);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [timer, setTimer] = useState(5);
  const [difficulty, setDifficulty] = useState("easy");
  const [category, setCategory] = useState("all");
  const [showResult, setShowResult] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [validationResult, setValidationResult] = useState<{
    isCorrect: boolean;
    points: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  // Don't auto-start the game - let user choose settings first

  // Check daily limit on mount only
  useEffect(() => {
    if (user?.id) {
      actions.checkDailyLimit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user?.id, not actions (which changes on every render)

  // Fetch effective user multiplier (totalNear * contractMul) on component mount
  useEffect(() => {
    const fetchEffectiveMultiplier = async () => {
      try {
        // Fetch contract multiplier (for tracking)
        await fetchCurrentMultiplier();

        // Fetch effective user multiplier from deposit summary (totalNear * contractMul)
        if (isConnected && accountId) {
          const depositSummary = await getUserDepositSummary(accountId);
          if (depositSummary.success && depositSummary.data?.multiplierFactor) {
            // multiplierFactor is the effective multiplier = totalNear * contractMul
            const effective = Number(depositSummary.data.multiplierFactor) || 1;
            setEffectiveUserMultiplier(effective);
            console.log(
              "✅ Effective user multiplier (from deposit summary):",
              effective
            );
          } else {
            // Fallback to contract multiplier if no deposits
            setEffectiveUserMultiplier(currentMultiplier || 1);
          }
        } else {
          // If not connected, use contract multiplier or 1
          setEffectiveUserMultiplier(currentMultiplier || 1);
        }

        // Also refresh user data to ensure we have the latest multiplier
        await refreshUser();
      } catch (error) {
        console.error("Failed to fetch effective multiplier:", error);
        // Fallback to contract multiplier
        setEffectiveUserMultiplier(currentMultiplier || 1);
      }
    };

    fetchEffectiveMultiplier();
  }, [
    fetchCurrentMultiplier,
    refreshUser,
    getUserDepositSummary,
    accountId,
    isConnected,
    currentMultiplier,
  ]);

  // Timer effect - count down locally
  useEffect(() => {
    if (gameState.gameStarted && !quizState.isAnswered && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState.gameStarted, quizState.isAnswered, timer]);

  // Auto-submit when time runs out (failed)
  useEffect(() => {
    if (
      timer === 0 &&
      !quizState.isAnswered &&
      quizState.currentQuiz &&
      !showResult
    ) {
      // Time ran out - mark as failed and submit
      setSelectedAnswer("TIME_UP");
      setValidationResult({
        isCorrect: false,
        points: 0,
      });
      setPointsEarned(0);
      setShowResult(true);

      // Also complete the game as failed
      actions.completeGame({
        gameId: quizState.currentQuiz.id,
        isCorrect: false,
        score: 0,
        timeTaken: 60000, // Full time used
        selectedAnswer: "TIME_UP",
        correctAnswer: quizState.currentQuiz.correctAnswer,
        question: quizState.currentQuiz.question,
        category: quizState.currentQuiz.category,
        difficulty: quizState.currentQuiz.difficulty,
      });
    }
  }, [timer, quizState.isAnswered, quizState.currentQuiz, showResult, actions]);

  const handleStartGame = async () => {
    actions.resetGame();
    const success = await actions.fetchQuiz(
      difficulty,
      category === "all" ? undefined : category
    );
    if (success) {
      await actions.startGame("quiz", { difficulty, category });
      setTimer(60); // 1 minute timer
    }
  };

  const handleAnswer = (answer: string) => {
    // Allow changing answer if not already submitted
    if (quizState.isAnswered) return;

    setSelectedAnswer(answer);
    actions.selectAnswer(answer);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await actions.submitAnswer();
      if (result.success) {
        // Store validation result for display
        setValidationResult({
          isCorrect: result.isCorrect || false,
          points: result.points || 0,
        });

        // Use the validation result directly
        if (result.isCorrect) {
          const base = result.points || quizState.currentQuiz?.points || 10;
          // Use the effective user multiplier (totalNear * contractMul) from deposit summary
          // This is the correct multiplier that matches the server-side calculation
          const multiplier = Number(
            effectiveUserMultiplier ||
            currentMultiplier ||
            user?.multiplier ||
            1
          );
          const earned = Math.round(
            base * (isFinite(multiplier) ? multiplier : 1)
          );
          console.log(
            `Quiz multiplier calculation: base=${base}, effectiveUserMultiplier=${effectiveUserMultiplier}, contractMultiplier=${currentMultiplier}, multiplier=${multiplier}, earned=${earned}`
          );
          setPointsEarned(earned);
          setScore((prev) => prev + earned);
          setUserCoins((prev) => prev + earned);
          onEarnCoins(earned);
        } else {
          setPointsEarned(0);
        }

        // Show result screen
        setShowResult(true);
      } else if (gameState.error) {
        toast.error(gameState.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextQuestion = async () => {
    setIsLoadingNext(true);
    try {
      const success = await actions.nextQuiz();
      if (success) {
        setCurrentQuestionIndex((prev) => prev + 1);
        setSelectedAnswer(null);
        setIsCorrect(null);
        setShowHint(false);
        setShowResult(false);
        setPointsEarned(0);
        setValidationResult(null);
        setIsSubmitting(false); // Reset loading state
        setTimer(60); // Reset timer to 60 seconds
      } else {
        setGameOver(true);
        toast.success(`Quiz completed! You earned ${score} coins!`);
      }
    } finally {
      setIsLoadingNext(false);
    }
  };

  const handleUseHint = () => {
    if (userCoins >= 10) {
      setUserCoins((prev) => prev - 10);
      setHintsUsed((prev) => prev + 1);
      setShowHint(true);
      toast.info("Hint: This is a sample hint");
    } else {
      toast.error("Not enough coins for a hint!");
    }
  };

  const handlePlayAgain = async () => {
    actions.resetGame();
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setGameOver(false);
    setScore(0);
    setHintsUsed(0);
    setShowHint(false);
    setShowResult(false);
    setPointsEarned(0);
    setValidationResult(null);
    setIsSubmitting(false); // Reset loading state
    setTimer(60); // Reset timer to 60 seconds
    await handleStartGame();
  };

  // Show loading state
  if (gameState.isLoading) {
    return (
      <div className="h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] relative overflow-hidden flex items-center justify-center">
        <div className="text-white text-xl">Loading Quiz...</div>
      </div>
    );
  }

  // Show error state
  if (gameState.error) {
    return (
      <div className="h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] relative overflow-hidden flex flex-col items-center justify-center text-white p-4">
        <h2 className="text-3xl font-bold mb-4">Error!</h2>
        <p className="text-gray-300 mb-6 text-center">{gameState.error}</p>
        <div className="space-x-4">
          <button
            onClick={handlePlayAgain}
            className="bg-white text-purple-900 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors"
          >
            Try Again
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="bg-gray-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  // Show game start screen these are the settings screen
  if (!gameState.gameStarted || !quizState.currentQuiz) {
    return (
      <div className="h-[calc(100vh-150px)] bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-float"
              style={{
                width: Math.random() * 6 + 2 + "px",
                height: Math.random() * 6 + 2 + "px",
                left: Math.random() * 100 + "%",
                top: Math.random() * 100 + "%",
                background:
                  Math.random() > 0.5
                    ? "rgba(139, 92, 246, 0.3)"
                    : "rgba(236, 72, 153, 0.3)",
                animationDelay: Math.random() * 5 + "s",
                animationDuration: Math.random() * 10 + 10 + "s",
                boxShadow: "0 0 20px currentColor",
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center h-full text-white p-4 pt-16">
          <h1
            className="text-2xl font-bold text-white tracking-wider mb-8 absolute top-4 left-0 right-0 text-center pointer-events-none"
            style={{
              fontFamily: "'Pixelify Sans', monospace",
              letterSpacing: "0.1em",
            }}
          >
            QUIZ
          </h1>

          {/* Mission Control Card */}
          <div className="bg-[#000024] backdrop-blur-md rounded-3xl p-5 mb-6 w-full max-w-md border border-[#1C97D8] shadow-2xl relative overflow-hidden group mt-8">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            {/* Daily Progress Section */}
            <div className="relative z-10 mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  Daily Progress
                </span>
                <span className="text-xs rounded-full font-bold text-white bg-white/10 px-2 py-1">
                  {quizState.dailyQuizzesCompleted}/{quizState.dailyLimit}
                </span>
              </div>
              <div className="w-full bg-black/30 border border-[#1C97D8] rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${quizState.dailyQuizzesCompleted >= quizState.dailyLimit
                    ? "bg-gradient-to-r from-red-500 to-red-600"
                    : "bg-gradient-to-r from-blue-400 to-purple-500"
                    }`}
                  style={{
                    width: `${Math.min(
                      (quizState.dailyQuizzesCompleted / quizState.dailyLimit) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5"></div>

            {/* Settings Section */}
            <div className="relative z-10 space-y-5">
              {/* Difficulty Segmented Control */}
              <div className="bg-black/20 border border-[#1C97D8] p-1 rounded-full flex relative">
                {["easy", "medium", "hard"].map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setDifficulty(diff)}
                    className={`flex-1 py-2.5 rounded-full text-xs font-bold capitalize transition-all duration-300 relative z-10 ${difficulty === diff
                      ? "text-white shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
                      }`}
                  >
                    {diff}
                    {difficulty === diff && (
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0084FF] to-[#0084FF] rounded-full -z-10 shadow-lg"></div>
                    )}
                  </button>
                ))}
              </div>

              {/* Categories Horizontal Scroll */}
              <div className="relative">
                <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar mask-linear-fade">
                  {[
                    { id: "all", label: "All" },
                    { id: "science", label: "Science" },
                    { id: "history", label: "History" },
                    { id: "geography", label: "Geo" },
                    { id: "sports", label: "Sports" },
                    { id: "entertainment", label: "Entmt" },
                    { id: "technology", label: "Tech" },
                    { id: "literature", label: "Lit" },
                    { id: "art", label: "Art" },
                    { id: "music", label: "Music" },
                    { id: "general", label: "General" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`whitespace-nowrap py-2 px-4 rounded-full text-xs font-bold transition-all duration-300 border ${category === cat.id
                        ? "bg-white text-[#002799] border-white shadow-lg scale-105"
                        : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:border-white/20"
                        }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                {/* Fade indicators for scroll */}
                <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-[#1a1f3a] to-transparent pointer-events-none"></div>
              </div>
            </div>
          </div>

          <button
            onClick={handleStartGame}
            disabled={
              quizState.dailyQuizzesCompleted >= quizState.dailyLimit ||
              gameState.isLoading
            }
            className={`w-full max-w-md py-2 rounded-xl mt-6 font-bold text-lg transition-all shadow-xl ${quizState.dailyQuizzesCompleted >= quizState.dailyLimit
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-[#0084FF] border-2 border-[#B5F6FD] text-white hover:scale-[1.02] hover:shadow-[#4E07AD]/25 active:scale-[0.98]"
              }`}
          >
            {quizState.dailyQuizzesCompleted >= quizState.dailyLimit ? (
              <span className="flex items-center justify-center gap-2">
                <span className="text-xl">🔒</span> Daily Limit Reached
              </span>
            ) : gameState.isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Loading...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Start Quiz
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = quizState.currentQuiz;

  return (
    <div className="h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float"
            style={{
              width: Math.random() * 6 + 2 + "px",
              height: Math.random() * 6 + 2 + "px",
              left: Math.random() * 100 + "%",
              top: Math.random() * 100 + "%",
              background:
                Math.random() > 0.5
                  ? "rgba(139, 92, 246, 0.3)"
                  : "rgba(236, 72, 153, 0.3)",
              animationDelay: Math.random() * 5 + "s",
              animationDuration: Math.random() * 10 + 10 + "s",
              boxShadow: "0 0 20px currentColor",
            }}
          />
        ))}
      </div>


      <div className="relative z-10 flex items-center justify-between px-4 py-3">
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs">Back</span>
          </button>
        )}

        <h1
          className="text-2xl font-bold text-white tracking-wider ml-10"
          style={{
            fontFamily: "'Pixelify Sans', monospace",
            letterSpacing: "0.1em",
          }}
        >
          QUIZ
        </h1>

        <GameHUD
          score={score}
          pointsEarned={pointsEarned}
          multiplier={effectiveUserMultiplier}
          currentBalance={userCoins}
          showMultiplier={effectiveUserMultiplier > 1}
          totalSolv={user?.totalSOLV}
          levelLabel={`L${user?.level ?? 1}`}
          difficultyLabel={
            difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
          }
          isFixed={false}
        />

        {!selectedAnswer && !gameOver && (
          <button
            onClick={handleUseHint}
            className="transition-transform hover:scale-105"
          >
            <img
              src="/assets/quiz/hint-button.svg"
              alt="Use Hint"
              className="h-9 w-auto"
            />
          </button>
        )}
        {(selectedAnswer || gameOver) && <div className="w-16" />}
      </div>

      {
        !gameOver ? (
          showResult ? (
            <div className="relative z-10 px-4 flex flex-col items-center justify-center min-h-[50vh]">
              <div className="bg-[#000024]/80 backdrop-blur-xl rounded-3xl p-8 w-full max-w-sm border border-[#1C97D8] shadow-2xl flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="relative">
                  <div className={`text-7xl filter drop-shadow-lg animate-bounce ${validationResult?.isCorrect ? "grayscale-0" : "grayscale"}`}>
                    {validationResult?.isCorrect ? "🎉" : "❌"}
                  </div>
                  {validationResult?.isCorrect && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
                  )}
                </div>

                <div className="space-y-2">
                  <h2 className={`text-3xl font-bold tracking-wide ${validationResult?.isCorrect ? "text-green-400" : "text-red-500"}`}>
                    {validationResult?.isCorrect ? "Correct!" : "Incorrect"}
                  </h2>
                  {!validationResult?.isCorrect && (
                    <p className="text-gray-300 text-sm font-medium">
                      Don't give up! Keep going!
                    </p>
                  )}
                </div>

                {validationResult?.isCorrect && pointsEarned > 0 ? (
                  <div className="w-full bg-blue-900/30 rounded-2xl p-4 border border-blue-500/30 space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <img src="/assets/games/Solvium-coin.svg" alt="Coin" className="w-6 h-6" />
                      <span className="text-2xl font-bold text-white">+{pointsEarned}</span>
                      <span className="text-blue-300 font-medium">SOLV</span>
                    </div>

                    {effectiveUserMultiplier > 1 && (
                      <div className="flex items-center justify-center gap-2 text-xs bg-blue-500/20 py-1 px-3 rounded-full mx-auto w-fit">
                        <span className="text-blue-300">Multiplier Active:</span>
                        <span className="text-yellow-400 font-bold">{effectiveUserMultiplier.toFixed(1)}x</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full bg-red-900/20 rounded-2xl p-3 border border-red-500/20">
                    <p className="text-red-300 text-sm font-medium">
                      +0 Points
                    </p>
                  </div>
                )}

                <div className="w-full pt-2">
                  <button
                    onClick={handleNextQuestion}
                    disabled={isLoadingNext}
                    className="w-full bg-gradient-to-r from-[#0084FF] to-[#0044FF] text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoadingNext ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <span>Next Question</span>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative z-10 px-4 pb-4 overflow-y-auto max-h-[calc(100vh-120px)]">
              <div className="flex justify-center mb-2">
                <div className="relative w-10 h-10">
                  <svg className="w-10 h-10 transform -rotate-90">
                    <circle
                      cx="20"
                      cy="20"
                      r="18"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="3"
                      fill="none"
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r="18"
                      stroke="white"
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray={`${(timer / 60) * 113} 113`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">
                    {String(timer).padStart(2, "0")}
                  </div>
                </div>
              </div>

              <div className="mb-2">
                <img
                  src="/mona-lisa-inspired.jpg"
                  alt="Question"
                  className="w-full h-24 object-cover rounded-xl"
                />
              </div>

              <div className="mb-3">
                <p className="text-gray-400 text-[10px] mb-0.5">
                  Question {currentQuestionIndex + 1} of {quizState.dailyLimit}
                </p>
                <h2 className="text-white text-base font-bold leading-tight">
                  {currentQuestion.question}
                </h2>
              </div>

              <div className="space-y-2">
                {currentQuestion.options.map((option) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrectAnswer =
                    option === currentQuestion.correctAnswer;
                  const showCorrect = isSelected && isCorrectAnswer;
                  const showIncorrect = isSelected && !isCorrectAnswer;

                  return (
                    <button
                      key={option}
                      onClick={() => handleAnswer(option)}
                      disabled={quizState.isAnswered}
                      className={`w-full p-2 rounded-xl font-semibold text-sm transition-all ${showCorrect
                        ? "bg-green-500 text-white"
                        : showIncorrect
                          ? "bg-red-500 text-white"
                          : selectedAnswer === option
                            ? "bg-blue-500 text-white"
                            : "bg-white text-black"
                        }`}
                      style={{
                        boxShadow: showCorrect
                          ? "0 0 20px rgba(34, 197, 94, 0.5)"
                          : selectedAnswer === option
                            ? "0 0 15px rgba(59, 130, 246, 0.5)"
                            : "none",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        {showCorrect && (
                          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center mr-2">
                            <svg
                              className="w-2.5 h-2.5 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        )}
                        <span className="flex-1 text-center">{option}</span>
                        {showCorrect && <div className="w-4" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedAnswer && !quizState.isAnswered && (
                <div className="mt-4">
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-[#0084FF] to-[#0044FF] text-white py-3 rounded-xl font-bold text-base shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      "Submit Answer"
                    )}
                  </button>
                </div>
              )}

              {selectedAnswer && isCorrect && (
                <div className="mt-4 text-center space-y-2">
                  <p className="text-white text-sm">
                    That's the right Answer - +{currentQuestion.points} Solv
                  </p>
                  <div className="flex justify-center">
                    <img
                      src="/assets/games/Solvium-coin.svg"
                      alt="Coin"
                      className="w-10 h-10 animate-bounce"
                    />
                  </div>
                </div>
              )}

              {selectedAnswer === "TIME_UP" && (
                <div className="mt-4 text-center space-y-2">
                  <p className="text-red-400 text-sm">
                    Time's up! Moving to next question...
                  </p>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="relative z-10 px-4 text-center space-y-4">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-white text-2xl font-bold">Quiz Complete!</h2>
            <p className="text-white text-lg">
              Your score: <span className="font-bold">{score}</span>
            </p>
            <p className="text-gray-400 text-sm">Hints used: {hintsUsed}</p>

            <button
              onClick={handlePlayAgain}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold text-base hover:scale-105 transition-transform"
            >
              Play Again
            </button>
          </div>
        )}

      <div
        className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(10, 14, 39, 0.8))",
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          transform: "perspective(500px) rotateX(60deg)",
          transformOrigin: "bottom",
        }}
      />
    </div>
  );
};

export default QuizGame;
