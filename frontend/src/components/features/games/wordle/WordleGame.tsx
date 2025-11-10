"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { computeGuessColors } from "@/lib/wordle/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Coins,
  Trophy,
  Gift,
  Sparkles,
  Play,
  X,
  Settings,
  Loader2,
  Users,
  ChevronLeft,
} from "lucide-react";
import HintSystem from "../monetization/HintSystem";
import { useGameConfig } from "@/contexts/GameConfigContext";
import { useAuth } from "@/contexts/AuthContext";
import GameHUD from "../common/GameHUD";
import {
  validateWordFrontend,
  getDailyWord,
} from "@/lib/wordle/geminiWordFetcher";
import WordleRoomModal from "./WordleRoomModal";
import { useMultiplayerRoom } from "@/hooks/useMultiplayerRoom";
// import HintSystem from "@/components/monetization/HintSystem";

interface WordleGameProps {
  roomCode?: string;
  isMultiplayer?: boolean;
}

const WordleGame: React.FC<WordleGameProps> = ({
  roomCode,
  isMultiplayer = false,
}) => {
  const { config, dailyProgress, updateWordleConfig, updateDailyProgress } =
    useGameConfig();
  const { user, fetchUserProfile } = useAuth();
  const {
    createRoom,
    joinRoom,
    room,
    loading: roomLoading,
  } = useMultiplayerRoom();

  // Multiplayer state
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(
    roomCode || null
  );

  // Game context integration (simplified for now)
  const [userBalance, setUserBalance] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [targetWord, setTargetWord] = useState("");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  // Fixed outcome snapshot for modal rendering
  const [modalOutcome, setModalOutcome] = useState<"win" | "loss" | null>(null);
  // User balance is now managed by the unified game context

  // Fetch user's current SOLV balance from database
  const fetchUserSOLV = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/games/stats?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setUserBalance(data.user.totalSOLV);
      }
    } catch (error) {
      console.error("Error fetching user SOLV:", error);
    }
  };

  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Meaning modal removed
  const [currentWord, setCurrentWord] = useState("");
  // dynamic length support
  const [wordLen, setWordLen] = useState<number>(5);
  const [dailyId, setDailyId] = useState<string>("");
  const [colorsByRow, setColorsByRow] = useState<
    ("exact" | "present" | "absent")[][]
  >([]);
  const maxGuesses = 6;
  // Use level from config
  const level = config.wordle.level;
  const difficulty = config.wordle.difficulty;
  // Store server-calculated points
  const [pointCalculation, setPointCalculation] = useState<{
    basePoints: number;
    multiplier: number;
    boostedPoints: number;
    boostAmount: number;
    totalPoints: number;
  } | null>(null);
  // Loading state while saving and waiting for API
  const [isSavingResult, setIsSavingResult] = useState(false);

  // Timer and progress tracking
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [hintsUsedToday, setHintsUsedToday] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch user SOLV on component mount
  useEffect(() => {
    fetchUserSOLV();
  }, []);

  // Log user state
  useEffect(() => {
    console.log("👤 User State Updated:", {
      userBalance,
      gameStarted,
      gameWon,
      gameOver,
      hintUsed,
      guesses: guesses.length,
      currentGuess,
      targetWord: targetWord ? `${targetWord.substring(0, 2)}***` : "none",
      level: level,
      difficulty: difficulty,
      dailyProgress: {
        gamesPlayed: dailyProgress?.gamesPlayed || 0,
        gamesWon: dailyProgress?.gamesWon || 0,
        hintsUsed: dailyProgress?.hintsUsed || 0,
        totalSOLVEarned: dailyProgress?.totalSOLVEarned || 0,
      },
    });
  }, [
    userBalance,
    gameStarted,
    gameWon,
    gameOver,
    hintUsed,
    guesses,
    currentGuess,
    targetWord,
    level,
    difficulty,
    dailyProgress,
  ]);

  const getDifficultyLabel = (lv: number) => {
    if (lv >= 1 && lv <= 5) return "Easy";
    if (lv >= 6 && lv <= 10) return "Medium";
    return "Hard";
  };

  // Level progression logic
  const shouldAdvanceLevel = (currentLevel: number, totalGamesWon: number) => {
    // Advance every 5 games won
    // Calculate what level the user should be at based on total games won
    const expectedLevel = Math.floor(totalGamesWon / 5) + 1;
    return expectedLevel > currentLevel;
  };

  const advanceLevel = (totalGamesWon?: number) => {
    let newLevel = level + 1;

    // If totalGamesWon is provided, calculate the correct level
    if (totalGamesWon) {
      newLevel = Math.floor(totalGamesWon / 5) + 1;
    }

    const newDifficulty = getDifficultyLabel(newLevel);

    console.log(
      `🎯 Level up! ${level} → ${newLevel} (${newDifficulty}) - Total games won: ${
        totalGamesWon || "unknown"
      }`
    );

    // Update frontend config
    updateWordleConfig({
      level: newLevel,
      difficulty: newDifficulty as "Easy" | "Medium" | "Hard",
    });

    toast.success(`🎉 Level Up! Now Level ${newLevel} (${newDifficulty})`);
  };

  // Auto-start game if configured
  useEffect(() => {
    if (config.wordle.autoStart && !gameStarted) {
      startNewGame();
    }
  }, [config.wordle.autoStart, gameStarted]);

  // Timer tracking (no countdown, just elapsed time)
  useEffect(() => {
    if (gameStarted && !gameOver) {
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
        setTimeRemaining(elapsed); // Store elapsed time instead of remaining
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameStarted, gameOver, gameStartTime]);

  // Update hints used today from daily progress
  useEffect(() => {
    if (dailyProgress) {
      const difficulty = getDifficultyLabel(level);
      setHintsUsedToday(dailyProgress.hintsUsed[difficulty] || 0);
    }
  }, [dailyProgress, level]);

  // Physical keyboard support
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const handlePhysicalKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        handleKeyPress("ENTER");
      } else if (e.key === "Backspace") {
        handleKeyPress("BACKSPACE");
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKeyPress(e.key.toUpperCase());
      }
    };

    window.addEventListener("keydown", handlePhysicalKeyPress);
    return () => window.removeEventListener("keydown", handlePhysicalKeyPress);
  }, [gameStarted, gameOver, currentGuess, guesses, targetWord]);

  // Calculate rewards based on config
  const calculateRewards = (
    guessesUsed: number,
    usedHint: boolean,
    completionTime?: number
  ) => {
    const { wordle } = config;
    const difficulty = getDifficultyLabel(level);

    // Base SOLV with difficulty multiplier
    const baseSOLV =
      wordle.baseWinSOLV * wordle.difficultyMultiplier[difficulty];

    // Level bonus (10% per level)
    const levelBonus = baseSOLV * (wordle.levelMultiplier * level);

    // Guess bonus (SOLV for remaining guesses)
    const remainingGuesses = maxGuesses - guessesUsed;
    const guessBonus = remainingGuesses * wordle.guessBonusPerRemaining;

    // Hint penalty
    const hintPenalty = usedHint ? wordle.hintPenalty : 0;

    // Time bonus
    let timeBonus = 0;
    if (completionTime) {
      if (completionTime <= 30) timeBonus = wordle.fastCompletionBonus.under30s;
      else if (completionTime <= 60)
        timeBonus = wordle.fastCompletionBonus.under60s;
      else if (completionTime <= 120)
        timeBonus = wordle.fastCompletionBonus.under120s;
    }

    // Streak bonus
    const streakBonus = dailyProgress
      ? Math.min(
          dailyProgress.currentStreak * wordle.streakBonus,
          wordle.maxStreakBonus
        )
      : 0;

    const totalSOLV = Math.round(
      baseSOLV + levelBonus + guessBonus - hintPenalty + timeBonus + streakBonus
    );

    return {
      baseSOLV: Math.round(baseSOLV),
      levelBonus: Math.round(levelBonus),
      guessBonus,
      hintPenalty,
      timeBonus,
      streakBonus,
      totalSOLV,
    };
  };

  const startNewGame = async () => {
    try {
      setIsLoading(true);
      // Get daily word from Gemini service
      const dailyId = new Date().toISOString().split("T")[0]; // Use date as daily ID
      // Get actual userId from auth context
      const userId = user?.id ? parseInt(user.id) : null;

      if (!userId) {
        toast.error("Please log in to play Wordle");
        setIsLoading(false);
        return;
      }

      console.log(
        `🎮 Starting new Wordle game - Level: ${level}, User: ${userId}, DailyId: ${dailyId}`
      );
      const word = await getDailyWord(dailyId, level, userId);

      if (word) {
        console.log(
          `🎯 Word received for game: "${word}" (${word.length} letters)`
        );

        // Accept any word length from 3-10 letters
        if (word.length < 3 || word.length > 10) {
          console.error(
            `❌ Invalid word length: ${word.length} (must be 3-10 letters)`
          );
          toast.error(
            "Error: Invalid word length from server. Please try again."
          );
          setIsLoading(false);
          return;
        }

        setDailyId(dailyId);
        setWordLen(word.length);
        setTargetWord(word.toUpperCase());
      } else {
        throw new Error("No word received from database - game cannot start");
      }

      // Game started

      // Initialize game state
      setGuesses([]);
      setColorsByRow([]);
      setCurrentGuess("");
      setGameOver(false);
      setGameWon(false);
      setHintUsed(false);
      setGameStarted(true);
      setShowGameOverModal(false);

      // Initialize timer (track elapsed time, no limit)
      setTimeRemaining(0);
      setGameStartTime(Date.now());

      // Update daily progress
      if (dailyProgress) {
        console.log("🎮 Starting new game - updating daily progress:", {
          before: { gamesPlayed: dailyProgress.gamesPlayed },
          update: { gamesPlayed: dailyProgress.gamesPlayed + 1 },
        });
        updateDailyProgress({
          gamesPlayed: dailyProgress.gamesPlayed + 1,
        });
      }
    } catch (error) {
      console.error("Error starting new game:", error);
      toast.error("Failed to start new game. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartGame = () => {
    startNewGame();
  };

  const handleKeyPress = async (key: string) => {
    console.log(
      `🎹 Key pressed: "${key}", gameOver: ${gameOver}, currentGuess: "${currentGuess}"`
    );

    if (gameOver) return;

    if (key === "ENTER") {
      console.log(
        `✅ ENTER pressed - currentGuess length: ${currentGuess.length}, wordLen: ${wordLen}`
      );

      if (currentGuess.length !== wordLen) {
        toast.error(`Word must be ${wordLen} letters!`);
        return;
      }

      // Validate word using dictionary service
      const guessUpper = currentGuess.toUpperCase();
      console.log(
        `🔍 Validating guess: "${guessUpper}" against target: "${targetWord}"`
      );

      // Validate word using frontend dictionary check (fast)
      console.log(`📖 Calling validateWordFrontend for: "${guessUpper}"`);
      const isValid = await validateWordFrontend(guessUpper);
      console.log(`📖 Validation result: ${isValid}`);

      if (!isValid) {
        console.log(`❌ Invalid word: "${guessUpper}"`);
        toast.error("Word not found in dictionary!");
        return;
      }
      console.log(`✅ Valid word: "${guessUpper}"`);

      // Prefer local validation if we have the answer
      if (targetWord) {
        const colors = computeGuessColors(targetWord, guessUpper);
        const newGuesses = [...guesses, guessUpper];
        setGuesses(newGuesses);
        setColorsByRow((prev) => [...prev, colors]);
        setCurrentGuess("");

        const allExact = colors.every((c: string) => c === "exact");
        if (allExact) {
          setGameWon(true);
          setGameOver(true);
          setModalOutcome("win");
          // Open modal immediately and show loader until API returns
          setPointCalculation(null);
          setIsSavingResult(true);
          setShowGameOverModal(true);

          // Use tracked elapsed time
          const completionTime = timeRemaining;
          const rewards = calculateRewards(
            newGuesses.length,
            hintUsed,
            completionTime
          );

          console.log("🎉 Game Won! Updating user state and database:", {
            rewards,
            completionTime,
            guesses: newGuesses.length,
            hintUsed,
            level: level,
            difficulty: difficulty,
          });

          // SOLV balance will be updated by the API response
          console.log(`💰 SOLV Update: +${rewards.totalSOLV} SOLV`);
          // Win message will be shown after backend confirms success

          // Update daily progress with game config
          if (dailyProgress) {
            console.log("📊 Updating daily progress:", {
              before: {
                gamesWon: dailyProgress.gamesWon,
                totalSOLVEarned: dailyProgress.totalSOLVEarned,
              },
              update: {
                gamesWon: dailyProgress.gamesWon + 1,
                totalSOLVEarned:
                  dailyProgress.totalSOLVEarned + rewards.totalSOLV,
              },
            });
            updateDailyProgress({
              gamesWon: dailyProgress.gamesWon + 1,
              totalSOLVEarned:
                dailyProgress.totalSOLVEarned + rewards.totalSOLV,
              fastestCompletion: dailyProgress.fastestCompletion
                ? Math.min(dailyProgress.fastestCompletion, completionTime)
                : completionTime,
            });
          }

          // Level progression will be checked after API response

          // Update database with complete game data using unified system
          fetch("/api/games/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user?.id ? parseInt(user.id) : null,
              gameType: "wordle",
              gameId: dailyId,
              level: level,
              difficulty: difficulty,
              won: true,
              score: newGuesses.length,
              completionTime,
              hintUsed,
              hintCost: hintUsed ? config.wordle.hintCost : 0,
              rewards: rewards.totalSOLV,
              metadata: {
                targetWord: targetWord,
              },
            }),
          })
            .then(async (response) => {
              if (response.ok) {
                const result = await response.json();
                console.log("✅ Game completion saved to database");
                console.log("📊 API Response:", result);

                // Capture server-calculated point calculation
                if (result?.pointCalculation) {
                  setPointCalculation(result.pointCalculation);
                }

                // Update user balance
                if (result.userUpdate?.newBalance !== undefined) {
                  setUserBalance(result.userUpdate.newBalance);
                }

                // Check for level progression using API response
                if (result.userUpdate?.levelUp) {
                  console.log(
                    `🎯 Level progression triggered: current level ${level} → new level ${result.userUpdate.newLevel}`
                  );
                  advanceLevel(result.userUpdate.totalGamesWon);
                }

                // Show win message only after backend confirms success
                toast.success(
                  `You won! +${
                    result.userUpdate?.rewardsEarned || rewards.totalSOLV
                  } SOLV! 🎉`
                );
              } else {
                console.error("❌ Failed to save game completion to database");
                const errorData = await response.json();
                toast.error(
                  `Game completion failed: ${
                    errorData.error || "Unknown error"
                  }`
                );
              }
            })
            .catch((error) => {
              console.error("❌ Error saving game completion:", error);
              toast.error("Failed to complete game. Please try again.");
            })
            .finally(() => {
              setIsSavingResult(false);
            });
        } else if (newGuesses.length >= maxGuesses) {
          setGameOver(true);
          setModalOutcome("loss");
          // Open modal immediately and show loader during save
          setPointCalculation(null);
          setIsSavingResult(true);
          setShowGameOverModal(true);
          toast.error("Game over!");

          console.log("💀 Game Lost! Updating database:", {
            level: level,
            difficulty: difficulty,
            guesses: newGuesses.length,
            targetWord: targetWord,
          });

          fetch(`/api/games/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user?.id ? parseInt(user.id) : null,
              gameType: "wordle",
              gameId: dailyId,
              level: level,
              difficulty: difficulty,
              won: false,
              score: newGuesses.length,
              completionTime: timeRemaining,
              hintUsed,
              hintCost: hintUsed ? config.wordle.hintCost : 0,
              rewards: 0,
              metadata: { targetWord },
            }),
          })
            .then(async (response) => {
              if (response.ok) {
                const result = await response.json();
                console.log("✅ Game loss saved to database", result);
                if (result.userUpdate?.newBalance !== undefined) {
                  setUserBalance(result.userUpdate.newBalance);
                }
                if (result.userUpdate?.rewardsEarned) {
                  toast.success(
                    `You earned ${result.userUpdate?.rewardsEarned} SOLV`
                  );
                }
                // Capture server-calculated point calculation
                if (result?.pointCalculation) {
                  setPointCalculation(result.pointCalculation);
                }
              } else {
                console.error("❌ Failed to save game loss to database");
              }
            })
            .catch((error) => {
              console.error("❌ Error saving game loss:", error);
            })
            .finally(() => {
              setIsSavingResult(false);
            });
        }
      }
    } else if (key === "BACKSPACE") {
      setCurrentGuess((prev) => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < wordLen) {
      setCurrentGuess((prev) => prev + key);
    }
  };

  const getTileColor = (letter: string, index: number, word: string) => {
    if (letter === targetWord[index]) {
      return "bg-green-500 text-white";
    } else if (targetWord.includes(letter)) {
      return "bg-yellow-500 text-white";
    } else {
      return "bg-gray-300 dark:bg-gray-700";
    }
  };

  const generateHint = () => {
    if (guesses.length === 0) {
      return `The first letter is ${targetWord[0]}`;
    }

    for (let i = 0; i < 5; i++) {
      let correctGuess = false;
      for (const guess of guesses) {
        if (guess[i] === targetWord[i]) {
          correctGuess = true;
          break;
        }
      }

      if (!correctGuess) {
        return `The letter at position ${i + 1} is ${targetWord[i]}`;
      }
    }

    return `The word rhymes with "${targetWord.replace(/.[^aeiou]$/, "AY")}"`;
  };

  const handleUseHint = async () => {
    const difficulty = getDifficultyLabel(level);
    const maxHints = config.wordle.dailyHintsPerDifficulty[difficulty];

    if (hintsUsedToday >= maxHints) {
      toast.error(`Daily hint limit reached for ${difficulty} difficulty!`);
      return;
    }

    if (!user?.id) {
      toast.error("Please log in to use hints");
      return;
    }

    if (userBalance < config.wordle.hintCost) {
      toast.error("Insufficient SOLV balance for hint");
      return;
    }

    try {
      const response = await fetch("/api/games/hints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          gameType: "wordle",
          hintCost: config.wordle.hintCost,
          hintData: { hint: generateHint() },
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setHintUsed(true);
        toast.success(`Hint used! -${config.wordle.hintCost} SOLV`);

        // Update daily progress
        if (dailyProgress) {
          const newHintsUsed = { ...dailyProgress.hintsUsed };
          newHintsUsed[difficulty] = (newHintsUsed[difficulty] || 0) + 1;
          updateDailyProgress({
            hintsUsed: newHintsUsed,
          });
        }
      } else {
        toast.error(result.error || "Failed to use hint");
      }
    } catch (error) {
      toast.error("Network error while using hint");
      console.error("Hint error:", error);
    }
  };

  const LoadingScreen = () => (
    <div className="flex-1 flex flex-col justify-center items-center px-4 text-white">
      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="w-16 h-16 bg-[#1EC7FF]/20 rounded-full flex items-center justify-center mx-auto">
          <Loader2 className="w-8 h-8 text-[#1EC7FF] animate-spin" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Loading Game...</h2>
          <p className="text-sm text-gray-300">
            Fetching your daily word and setting up the game
          </p>
        </div>
        <div className="bg-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400">
            Level: {level} • Difficulty: {getDifficultyLabel(level)} • Word
            Length: {wordLen}
          </p>
        </div>
      </div>
    </div>
  );

  const TutorialScreen = () => (
    <div className="flex-1 flex flex-col justify-center items-center px-6 text-white overflow-hidden">
      <div
        className="max-w-md mx-auto w-full md:space-y-2 space-y-2 mt-2
      "
      >
        {/* Instruction Cards */}
        <div className="space-y-4">
          <div className="bg-[#000033] border-2 border-blue-600 rounded-3xl p-5">
            <p className="text-white md:text-sm text-xs">
              <span className="font-bold">1.</span> Guess the 5 letter words in
              6 tries!
            </p>
          </div>

          <div className="bg-[#000033] border-2 border-blue-600 rounded-3xl p-5">
            <p className="text-white md:text-sm text-xs">
              <span className="font-bold">2.</span> Each guess must be a valid
              word.
            </p>
          </div>

          <div className="bg-[#000033] border-2 border-blue-600 rounded-3xl p-5">
            <p className="text-white md:text-sm text-xs">
              <span className="font-bold">3.</span> The color of the tiles shows
              how close your guess is to the word.
            </p>
          </div>
        </div>

        {/* Color Examples */}
        <div className="flex justify-center gap-8 py-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-2">
              A
            </div>
            <p className="text-[7px] text-gray-400 leading-tight">
              correct letter in
              <br />
              correct position
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-500 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-2">
              B
            </div>
            <p className="text-[7px] text-gray-400 leading-tight">
              correct letter in <br />
              wrong position
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-gray-500 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-2">
              C
            </div>
            <p className="text-[7px] text-gray-400 leading-tight">
              letter not in the <br /> word
            </p>
          </div>
        </div>

        {/* Hints Info */}
        <div className="bg-[#000033] border-2 border-blue-600 rounded-3xl p-3">
          <ul className="text-white md:text-xs text-[9px] space-y-1.5">
            <li>• Need help? Use hints for 15 coins to reveal letters!</li>
            <li>• win coins based on how quickly you solve the puzzle</li>
          </ul>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartGame}
          className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white py-2 text-xl font-bold rounded-xl shadow-lg transform transition-all hover:scale-105 border-2 border-cyan-300"
        >
          Start Playing
        </button>
      </div>
    </div>
  );

  const SettingsModal = () => {
    if (!showSettings) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="relative bg-[#0A0146] from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-600/50 w-96 max-h-[80vh] overflow-y-auto flex flex-col">
          <button
            onClick={() => setShowSettings(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-700/50 hover:bg-slate-600/50 transition-colors z-10"
          >
            <X className="h-4 w-4 text-slate-300" />
          </button>

          <div className="flex flex-col items-center pt-8 pb-6">
            <h3 className="text-2xl font-bold text-white">Wordle Settings</h3>
          </div>

          <div className="flex-1 px-6 pb-6 space-y-4">
            {/* Current Game Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white">Current Game</h4>
              <div className="bg-white/10 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Level:</span>
                  <span className="text-white">
                    {config.wordle.level} (
                    {getDifficultyLabel(config.wordle.level)})
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Word Length:</span>
                  <span className="text-white">{wordLen} letters</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Hints Used:</span>
                  <span className="text-white">
                    {hintsUsedToday}/
                    {
                      config.wordle.dailyHintsPerDifficulty[
                        getDifficultyLabel(level)
                      ]
                    }
                  </span>
                </div>
                {dailyProgress && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Current Streak:</span>
                      <span className="text-white">
                        🔥 {dailyProgress.currentStreak}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Today's Games:</span>
                      <span className="text-white">
                        {dailyProgress.gamesWon}/{dailyProgress.gamesPlayed}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Game Settings (Read-only) */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white">Game Settings</h4>
              <div className="bg-white/10 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Auto-start:</span>
                  <span className="text-white">
                    {config.wordle.autoStart ? "✅" : "❌"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Show Hints:</span>
                  <span className="text-white">
                    {config.wordle.showHints ? "✅" : "❌"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Sound Effects:</span>
                  <span className="text-white">
                    {config.wordle.soundEnabled ? "✅" : "❌"}
                  </span>
                </div>
              </div>
            </div>

            {/* Rewards Info (Read-only) */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white">Rewards</h4>
              <div className="bg-white/10 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Base Points:</span>
                  <span className="text-white">
                    {config.wordle.baseWinSOLV}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Hint Cost:</span>
                  <span className="text-white">
                    {config.wordle.hintCost} coins
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Guess Bonus:</span>
                  <span className="text-white">
                    +{config.wordle.guessBonusPerRemaining} per remaining
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Fast Completion:</span>
                  <span className="text-white">
                    +{config.wordle.fastCompletionBonus.under30s}/+
                    {config.wordle.fastCompletionBonus.under60s}/+
                    {config.wordle.fastCompletionBonus.under120s}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 mt-6">
              <Button
                onClick={() => setShowSettings(false)}
                className="w-full bg-[#1EC7FF] hover:bg-[#1EC7FF]/80 text-white font-semibold py-3 rounded-xl transition-all duration-200"
              >
                Close Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const GameOverModal = () => {
    if (!showGameOverModal) return null;

    const isWin = modalOutcome === "win";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="relative bg-[#0A0146] from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-600/50 w-96 max-h-[80vh] overflow-y-auto flex flex-col">
          <button
            onClick={() => setShowGameOverModal(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-700/50 hover:bg-slate-600/50 transition-colors z-10"
          >
            <X className="h-4 w-4 text-slate-300" />
          </button>

          <div className="flex flex-col items-center pt-8 pb-6">
            <div className="text-6xl mb-4">{isWin ? "🎉" : "😢"}</div>
            <h3 className="text-2xl font-bold text-white">
              {isWin ? "You Won!" : "Game Over"}
            </h3>
            <p className="text-slate-300 text-center mt-2">
              {isWin
                ? `You guessed the word in ${guesses.length} tries.`
                : `The word was: ${targetWord}`}
            </p>
          </div>

          <div className="flex-1 px-6 pb-6">
            {/* Loading animation while waiting for API */}
            {isSavingResult && (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="h-10 w-10 border-4 border-slate-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-slate-300 text-sm">Calculating rewards...</p>
              </div>
            )}
            {/* Points Summary from server */}
            {!isSavingResult && pointCalculation && (
              <div className="mt-2 mb-4 rounded-xl border border-slate-600/50 bg-slate-800/30 p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300">Base Points</span>
                  <span className="font-semibold">
                    {pointCalculation.basePoints}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300">Multiplier</span>
                  <span className="font-semibold">
                    x {pointCalculation.multiplier}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300">Boost</span>
                  <span className="font-semibold">
                    +{pointCalculation.boostAmount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Total Points</span>
                  <span className="font-bold text-green-400">
                    +{pointCalculation.totalPoints}
                  </span>
                </div>
              </div>
            )}
            {/* Legacy fallback content if no calculation returned */}
            {!isSavingResult &&
              !pointCalculation &&
              modalOutcome === "loss" && (
                <div className="text-center space-y-4">
                  <p className="text-slate-300">Better luck next time!</p>
                  <div className="bg-slate-700/50 rounded-lg p-3 inline-block">
                    <Coins className="w-4 h-4 inline-block mr-1 text-yellow-400" />
                    <span className="text-white text-sm">
                      +5 SOLV for playing
                    </span>
                  </div>
                </div>
              )}
            <div className="space-y-4">
              <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                <p className="text-slate-300 text-xs">
                  Level {level} ({getDifficultyLabel(level)}) • {guesses.length}
                  /{maxGuesses} guesses
                </p>
              </div>

              {hintUsed && (
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-slate-300 text-sm">
                    <Sparkles className="inline-block w-4 h-4 mr-1" />
                    Hint used: -5 SOLV bonus
                  </p>
                </div>
              )}
            </div>
            )
            <div className="space-y-3 mt-6">
              <Button
                onClick={() => {
                  startNewGame();
                  setShowGameOverModal(false);
                }}
                className="w-full bg-[#1EC7FF] hover:bg-[#1EC7FF]/80 text-white font-semibold py-3 rounded-xl transition-all duration-200 transform hover:scale-105"
              >
                Next Game
              </Button>

              <Button
                onClick={() => setShowGameOverModal(false)}
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700/50 py-3 rounded-xl bg-transparent"
              >
                Continue Viewing
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen  bg-[url('/assets/background/num-genius-bg.svg')] bg-cover bg-center bg-no-repeat overflow-hidden">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-16 h-16 bg-pink-500/20 rounded-full blur-xl animate-pulse" />
        <div className="absolute top-40 right-20 w-12 h-12 bg-purple-500/20 rounded-full blur-xl animate-pulse delay-100" />
        <div className="absolute bottom-40 left-20 w-20 h-20 bg-blue-500/20 rounded-full blur-xl animate-pulse delay-200" />
      </div>

      <div className="relative z-10 h-full flex flex-col">
        <div className="w-full h-full flex flex-col">
          <div className="pb-0 pt-4 px-4 flex-shrink-0">
            <div className="flex justify-between items-center">
              <button className="flex items-center gap-2 text-white hover:text-blue-300 transition-colors">
                {/* <ChevronLeft className="w-3 h-3 md:w-5 md:h-5" /> */}
                {/* <span className="text-sm font-semibold">Back</span> */}
              </button>
              <h1
                className="text-2xl md:text-3xl font-bold text-white  md:ml-20 ml-16
              "
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                WORDLE GAME
              </h1>
              <div className="w-20"></div>
            </div>
          </div>

          {isLoading ? (
            <LoadingScreen />
          ) : !gameStarted ? (
            <TutorialScreen />
          ) : (
            <>
              <GameHUD
                score={guesses.length}
                pointsEarned={pointCalculation?.boostAmount || 0}
                multiplier={pointCalculation?.multiplier || 1}
                currentBalance={userBalance}
                showMultiplier={!!pointCalculation && pointCalculation.multiplier > 1}
                totalSolv={user?.totalSOLV}
                levelLabel={`L${level}`}
                difficultyLabel={getDifficultyLabel(level)}
              />
              <div className="px-3 pt-4 flex-1 flex flex-col justify-center items-center pb-4">
                {/* Game Board */}
                <div className="space-y-2 mb-3">
                  {guesses.map((guess, i) => (
                    <div key={i} className="flex gap-2 justify-center">
                      {Array.from({ length: wordLen }).map((_, j) => (
                        <div
                          key={j}
                          className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-xl md:text-2xl font-bold rounded-lg border-2 ${
                            colorsByRow[i]?.[j] === "exact"
                              ? "bg-green-500 border-green-600 text-white"
                              : colorsByRow[i]?.[j] === "present"
                              ? "bg-yellow-500 border-yellow-600 text-white"
                              : "bg-gray-600 border-gray-700 text-white"
                          }`}
                        >
                          {(guess[j] || "").toUpperCase()}
                        </div>
                      ))}
                    </div>
                  ))}

                  {!gameOver && (
                    <div className="flex gap-2 justify-center">
                      {Array.from({ length: wordLen }).map((_, i) => (
                        <div
                          key={i}
                          className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-xl md:text-2xl font-bold rounded-lg border-2 border-blue-500 bg-[#0A0A3E] text-white"
                        >
                          {currentGuess[i] || ""}
                        </div>
                      ))}
                    </div>
                  )}

                  {!gameOver &&
                    Array.from({
                      length: Math.max(0, maxGuesses - guesses.length - 1),
                    }).map((_, r) => (
                      <div key={r} className="flex gap-2 justify-center">
                        {Array.from({ length: wordLen }).map((_, j) => (
                          <div
                            key={j}
                            className="w-12 h-12 md:w-14 md:h-14 rounded-lg border-2 border-blue-500 bg-[#0A0A3E]"
                          />
                        ))}
                      </div>
                    ))}
                </div>
              </div>

              {/* Keyboard */}
              {!gameOver && (
                <div className="w-full px-4 pb-6">
                  <div className="max-w-lg mx-auto space-y-2">
                    {[
                      ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
                      ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
                      ["↵", "Z", "X", "C", "V", "B", "N", "M", "@"],
                    ].map((row, i) => (
                      <div
                        key={i}
                        className="flex justify-center gap-1.5
                      "
                      >
                        {row.map((key) => (
                          <button
                            key={key}
                            onClick={() => {
                              if (key === "↵") handleKeyPress("ENTER");
                              else if (key === "@") handleKeyPress("BACKSPACE");
                              else handleKeyPress(key);
                            }}
                            className="w-8 h-10 md:w-10 md:h-12 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-2xl
                             text-sm md:text-base transition-all active:scale-95 shadow-lg
                            "
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <GameOverModal />
      <SettingsModal />
      {/* Meaning UI removed */}

      {/* Multiplayer Room Modal */}
      <WordleRoomModal
        isOpen={showRoomModal}
        onClose={() => setShowRoomModal(false)}
        onStartGame={(roomId) => {
          setShowRoomModal(false);
          startNewGame();
        }}
        roomCode={currentRoomCode || undefined}
        isHost={room?.hostUserId === user?.id}
      />
    </div>
  );
};

export default WordleGame;
