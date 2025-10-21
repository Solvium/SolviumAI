"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuiz } from "@/hooks/useQuiz";
import { useAuth } from "@/contexts/AuthContext";

interface QuizGameProps {
  onEarnCoins?: (amount: number) => void;
  onClose?: () => void;
}

const QuizGame: React.FC<QuizGameProps> = ({
  onEarnCoins = () => {},
  onClose,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const { gameState, quizState, actions } = useQuiz();

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

  // Don't auto-start the game - let user choose settings first

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
    if (!selectedAnswer) return;

    const result = await actions.submitAnswer();
    if (result.success) {
      // Store validation result for display
      setValidationResult({
        isCorrect: result.isCorrect || false,
        points: result.points || 0,
      });

      // Use the validation result directly
      if (result.isCorrect) {
        const earned = result.points || quizState.currentQuiz?.points || 10;
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
  };

  const handleNextQuestion = async () => {
    const success = await actions.nextQuiz();
    if (success) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setShowHint(false);
      setShowResult(false);
      setPointsEarned(0);
      setValidationResult(null);
      setTimer(60); // Reset timer to 60 seconds
    } else {
      setGameOver(true);
      toast.success(`Quiz completed! You earned ${score} coins!`);
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

  // Show game start screen
  if (!gameState.gameStarted || !quizState.currentQuiz) {
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

        <div className="relative z-10 flex flex-col items-center justify-center h-full text-white p-4">
          <h1
            className="text-4xl font-bold text-white tracking-wider mb-8"
            style={{
              fontFamily: "monospace",
              textShadow: "0 0 10px rgba(255,255,255,0.5)",
            }}
          >
            QUIZ CHALLENGE
          </h1>

          {/* Settings */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4 text-center">
              Game Settings
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full p-2 rounded-lg bg-white/20 text-white border border-white/30 focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2 rounded-lg bg-white/20 text-white border border-white/30 focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  <option value="science">Science</option>
                  <option value="history">History</option>
                  <option value="geography">Geography</option>
                  <option value="sports">Sports</option>
                  <option value="entertainment">Entertainment</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handleStartGame}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-transform"
          >
            Start Quiz
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
          className="text-2xl font-bold text-white tracking-wider ml-16"
          style={{
            fontFamily: "monospace",
            textShadow: "0 0 10px rgba(255,255,255,0.5)",
          }}
        >
          QUIZ
        </h1>

        {!selectedAnswer && !gameOver && (
          <button
            onClick={handleUseHint}
            className="transition-transform hover:scale-105"
          >
            <img
              src="/assets/quiz/hint-button.svg"
              alt="Use Hint"
              className="w-24 h-auto"
            />
          </button>
        )}
        {(selectedAnswer || gameOver) && <div className="w-16" />}
      </div>

      {!gameOver ? (
        showResult ? (
          <div className="relative z-10 px-4 text-center space-y-4">
            <div className="text-6xl mb-4">
              {validationResult?.isCorrect ? "🎉" : "❌"}
            </div>
            <h2 className="text-white text-2xl font-bold">
              {validationResult?.isCorrect ? "Correct!" : "Incorrect!"}
            </h2>
            <p className="text-white text-lg">
              {validationResult?.isCorrect
                ? `+${pointsEarned} points earned!`
                : "Better luck next time!"}
            </p>
            <p className="text-gray-400 text-sm">
              {validationResult?.isCorrect
                ? `Total Score: ${score}`
                : `Points for this question: 0`}
            </p>
            <button
              onClick={handleNextQuestion}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold text-base hover:scale-105 transition-transform mt-4"
            >
              Next Question
            </button>
          </div>
        ) : (
          <div className="relative z-10 px-4 pb-8 overflow-y-auto max-h-[calc(100vh-120px)]">
            <div className="flex justify-center mb-3">
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="3"
                    fill="none"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="white"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${(timer / 60) * 125.6} 125.6`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
                  {String(timer).padStart(2, "0")}
                </div>
              </div>
            </div>

            <div className="mb-3">
              <img
                src="/mona-lisa-inspired.jpg"
                alt="Question"
                className="w-full h-32 object-cover rounded-xl"
              />
            </div>

            <div className="mb-4">
              <p className="text-gray-400 text-xs mb-1">
                Question {currentQuestionIndex + 1} of {quizState.dailyLimit}
              </p>
              <h2 className="text-white text-lg font-bold leading-tight">
                {currentQuestion.question}
              </h2>
            </div>

            <div className="space-y-2.5">
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
                    className={`w-full p-3 rounded-xl font-semibold text-base transition-all ${
                      showCorrect
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
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mr-2">
                          <svg
                            className="w-3 h-3 text-white"
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
                      {showCorrect && <div className="w-5" />}
                    </div>
                  </button>
                );
              })}
            </div>

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

            {selectedAnswer && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleSubmitAnswer}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl font-bold text-base hover:scale-105 transition-transform"
                >
                  Submit Answer
                </button>
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
