"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { computeGuessColors } from "@/lib/wordle/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Coins, Trophy, Gift, Sparkles, Play, X, Settings } from "lucide-react";
import HintSystem from "../monetization/HintSystem";
import { useGameConfig } from "@/app/contexts/GameConfigContext";
import { validateWord, getDailyWord } from "@/lib/wordle/geminiWordFetcher";
import { WordMeaning } from "@/components/wordle/WordMeaning";
// import HintSystem from "@/components/monetization/HintSystem";

// A simple list of words for the game
const WORDS = [
  "REACT",
  "GAMES",
  "WORDLE",
  "PUZZLE",
  "BRAIN",
  "LOGIC",
  "CODES",
  "BONUS",
];

const WordleGame: React.FC = () => {
  const { config, dailyProgress, updateWordleConfig, updateDailyProgress } =
    useGameConfig();
  const [gameStarted, setGameStarted] = useState(false);
  const [targetWord, setTargetWord] = useState("");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [userSOLV, setUserSOLV] = useState(501); // Updated to match current DB balance

  // Fetch user's current SOLV balance from database
  const fetchUserSOLV = async () => {
    try {
      // For now, we'll calculate the SOLV based on the game completion API response
      // In a real app, this would fetch from a user API endpoint
      console.log("💰 User SOLV will be updated after game completion");
    } catch (error) {
      console.error("Error fetching user SOLV:", error);
    }
  };

  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWordMeaning, setShowWordMeaning] = useState(false);
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

  // Timer and progress tracking
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [hintsUsedToday, setHintsUsedToday] = useState<number>(0);

  // Fetch user SOLV on component mount
  useEffect(() => {
    fetchUserSOLV();
  }, []);

  // Log user state
  useEffect(() => {
    console.log("👤 User State Updated:", {
      userSOLV,
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
    userSOLV,
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
      // Get daily word from Gemini service
      const dailyId = new Date().toISOString().split("T")[0]; // Use date as daily ID
      // TODO: Get actual userId from auth context
      const userId = 1; // Placeholder - should come from auth context

      console.log(
        `🎮 Starting new Wordle game - Level: ${level}, User: ${userId}, DailyId: ${dailyId}`
      );
      const word = await getDailyWord(dailyId, level, userId);

      if (word) {
        console.log(
          `🎯 Word received for game: "${word}" (${word.length} letters)`
        );
        setDailyId(dailyId);
        setWordLen(word.length);
        setTargetWord(word);
      } else {
        throw new Error("No word received from database - game cannot start");
      }

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
    }
  };

  const handleStartGame = () => {
    startNewGame();
  };

  const handleKeyPress = async (key: string) => {
    if (gameOver) return;

    if (key === "ENTER") {
      if (currentGuess.length !== wordLen) {
        toast.error(`Word must be ${wordLen} letters!`);
        return;
      }
      // Validate word using dictionary service
      const guessUpper = currentGuess.toUpperCase();
      console.log(
        `🔍 Validating guess: "${guessUpper}" against target: "${targetWord}"`
      );
      const isValid = await validateWord(guessUpper);

      if (!isValid) {
        console.log(`❌ Invalid word: "${guessUpper}"`);
        toast.error("Word not found in dictionary!");
        return;
      }

      console.log(`✅ Valid word: "${guessUpper}"`);

      // Prefer local validation if we have the answer
      if (targetWord && targetWord.replace(/•/g, "").length === wordLen) {
        const colors = computeGuessColors(targetWord, guessUpper);
        const newGuesses = [...guesses, guessUpper];
        setGuesses(newGuesses);
        setColorsByRow((prev) => [...prev, colors]);
        setCurrentGuess("");

        const allExact = colors.every((c: string) => c === "exact");
        if (allExact) {
          setGameWon(true);
          setGameOver(true);
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

          setUserSOLV((prev) => {
            const newSOLV = prev + rewards.totalSOLV;
            console.log(
              `💰 SOLV Update: ${prev} + ${rewards.totalSOLV} = ${newSOLV}`
            );
            return newSOLV;
          });
          toast.success(`You won! +${rewards.totalSOLV} SOLV! 🎉`);

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

          // Update database with complete game data
          fetch(`/api/wordle/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dailyId,
              level: level,
              difficulty: difficulty,
              won: true,
              guesses: newGuesses.length,
              completionTime,
              hintUsed,
              rewards: rewards.totalSOLV,
              targetWord: targetWord,
              userId: 1, // TODO: Get from auth context
            }),
          })
            .then(async (response) => {
              if (response.ok) {
                const result = await response.json();
                console.log("✅ Game completion saved to database");
                console.log("📊 API Response:", result);

                // Check for level progression using API response
                if (result.levelUp) {
                  console.log(
                    `🎯 Level progression triggered: current level ${level} → new level ${result.level}`
                  );
                  advanceLevel(result.totalGamesWon);
                }

                // Refresh user SOLV balance from database
                fetchUserSOLV();
              } else {
                console.error("❌ Failed to save game completion to database");
              }
            })
            .catch((error) => {
              console.error("❌ Error saving game completion:", error);
            });
        } else if (newGuesses.length >= maxGuesses) {
          setGameOver(true);
          setShowGameOverModal(true);
          toast.error("Game over!");

          console.log("💀 Game Lost! Updating database:", {
            level: level,
            difficulty: difficulty,
            guesses: newGuesses.length,
            targetWord: targetWord,
          });

          fetch(`/api/wordle/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dailyId,
              level: level,
              difficulty: difficulty,
              won: false,
              guesses: newGuesses.length,
              completionTime: timeRemaining,
              hintUsed,
              rewards: 0,
              targetWord: targetWord,
              userId: 1, // TODO: Get from auth context
            }),
          })
            .then((response) => {
              if (response.ok) {
                console.log("✅ Game loss saved to database");
              } else {
                console.error("❌ Failed to save game loss to database");
              }
            })
            .catch((error) => {
              console.error("❌ Error saving game loss:", error);
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

  const handleUseHint = () => {
    const difficulty = getDifficultyLabel(level);
    const maxHints = config.wordle.dailyHintsPerDifficulty[difficulty];

    if (hintsUsedToday >= maxHints) {
      toast.error(`Daily hint limit reached for ${difficulty} difficulty!`);
      return;
    }

    setHintUsed(true);
    setUserSOLV((prev) => prev - config.wordle.hintCost);

    // Update daily progress
    if (dailyProgress) {
      const newHintsUsed = { ...dailyProgress.hintsUsed };
      newHintsUsed[difficulty] = (newHintsUsed[difficulty] || 0) + 1;
      updateDailyProgress({
        hintsUsed: newHintsUsed,
      });
    }
  };

  const TutorialScreen = () => (
    <div className="flex-1 flex flex-col justify-center items-center px-4 text-white overflow-hidden">
      <div className="max-w-md mx-auto text-center space-y-4">
        <div className="mb-3">
          {/* <Info className="w-8 h-8 mx-auto mb-2 text-blue-400" /> */}
          <h2 className="text-xl font-bold mb-1 mt-3">Instructions</h2>
          <p className="text-sm text-gray-300">
            Guess the {wordLen}-letter word in 6 tries!
          </p>
        </div>

        <div className="space-y-4 text-left">
          <div className="bg-white/10 rounded-lg p-4 max-h-[800px]:p-3">
            <h3 className="font-bold text-lg max-h-[800px]:text-base mb-2 text-center">
              Game Rules
            </h3>
            <ul className="space-y-1 text-gray-300 text-sm max-h-[800px]:text-xs">
              <li>• You have 6 attempts to guess the word</li>
              <li>• Each guess must be a valid 5-letter word</li>
              <li>• After each guess, tiles will change color:</li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded flex items-center justify-center text-white font-bold">
                A
              </div>
              <span className="text-sm">
                Green = Correct letter in correct position
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500 rounded flex items-center justify-center text-white font-bold">
                B
              </div>
              <span className="text-sm">
                Yellow = Correct letter in wrong position
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-500 rounded flex items-center justify-center text-white font-bold">
                C
              </div>
              <span className="text-sm">Gray = Letter not in the word</span>
            </div>
          </div>

          <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-400/30">
            <h4 className="font-bold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Hints Available
            </h4>
            <p className="text-sm">
              Need help? Use hints for 15 coins to reveal letters!
            </p>
          </div>

          <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-400/30">
            <h4 className="font-bold mb-2 flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Earn Rewards
            </h4>
            <p className="text-sm">
              Win coins based on how quickly you solve the puzzle!
            </p>
          </div>
        </div>

        <Button
          onClick={handleStartGame}
          className="w-full bg-[#1EC7FF] hover:bg-[#1EC7FF]-700 text-[#0A0146] py-4 text-lg font-bold rounded-lg flex items-center justify-center gap-2 mt-12"
        >
          <Play className="w-5 h-5" />
          Start Playing
        </Button>
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
            <div className="text-6xl mb-4">{gameWon ? "🎉" : "😢"}</div>
            <h3 className="text-2xl font-bold text-white">
              {gameWon ? "You Won!" : "Game Over"}
            </h3>
            <p className="text-slate-300 text-center mt-2">
              {gameWon
                ? `You guessed the word in ${guesses.length} tries.`
                : `The word was: ${targetWord}`}
            </p>
          </div>

          <div className="flex-1 px-6 pb-6">
            {gameWon ? (
              <div className="space-y-4">
                {(() => {
                  const rewards = calculateRewards(
                    guesses.length,
                    hintUsed,
                    timeRemaining
                  );
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-yellow-500/20 rounded-lg p-4 text-center border border-yellow-400/30">
                        <Trophy className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                        <span className="text-sm text-white block font-medium">
                          +{rewards.totalSOLV} SOLV
                        </span>
                      </div>
                      <div className="bg-yellow-500/20 rounded-lg p-4 text-center border border-yellow-400/30">
                        <Coins className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                        <span className="text-sm text-white block font-medium">
                          +{rewards.totalSOLV} SOLV
                        </span>
                      </div>
                      <div className="bg-yellow-500/20 rounded-lg p-4 text-center border border-yellow-400/30">
                        <Gift className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                        <span className="text-sm text-white block font-medium">
                          🔤 Badge
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-slate-300 text-xs">
                    Level {level} ({getDifficultyLabel(level)}) •{" "}
                    {guesses.length}/{maxGuesses} guesses
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
            ) : (
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

            <div className="space-y-3 mt-6">
              <Button
                onClick={() => {
                  setCurrentWord(targetWord.replace(/•/g, ""));
                  setShowWordMeaning(true);
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-all duration-200"
              >
                📖 Learn About This Word
              </Button>

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
    <div className="w-full min-h-screen p-2 bg-[#0A0146] overflow-hidden">
      <div className="absolute"></div>

      <div className="relative z-10 h-full flex flex-col">
        <div className="w-full h-full flex flex-col">
          <div className="pb-0 pt-4 px-4 flex-shrink-0">
            <div className="text-center flex justify-between items-center text-[#1EC7FF]">
              <span className="text-xl ml-10 md:text-2xl font-bold">
                Wordle Game
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  className="text-[#1EC7FF] hover:bg-white/10 p-2"
                >
                  <Settings className="w-4 h-4" />
                </Button>
                {gameStarted && !gameOver && config.wordle.showHints && (
                  <HintSystem
                    hintCost={config.wordle.hintCost}
                    hint={generateHint()}
                    userCoins={userSOLV}
                    onUseHint={handleUseHint}
                  />
                )}
              </div>
            </div>
          </div>

          {!gameStarted ? (
            <TutorialScreen />
          ) : (
            <>
              <div className="px-3 pt-4 flex-1 flex flex-col space-y-2 justify-center items-center">
                <div className="w-full max-w-lg mb-1 text-[#9DDFFF] text-xs md:text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/10 border border-white/20">
                      Level: {level}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/10 border border-white/20">
                      Difficulty: {getDifficultyLabel(level)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/10 border border-white/20">
                      Length: {wordLen}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/10 border border-white/20">
                      Guesses: {Math.max(0, maxGuesses - guesses.length)}
                    </span>
                  </div>
                </div>

                {/* Timer and Daily Progress */}
                <div className="w-full max-w-lg mb-2 text-[#9DDFFF] text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-400/30">
                      ⏱️ {Math.floor(timeRemaining / 60)}:
                      {(timeRemaining % 60).toString().padStart(2, "0")}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/10 border border-white/20">
                      Hints: {hintsUsedToday}/
                      {
                        config.wordle.dailyHintsPerDifficulty[
                          getDifficultyLabel(level)
                        ]
                      }
                    </span>
                  </div>
                  {dailyProgress && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-white/10 border border-white/20">
                        🔥 {dailyProgress.currentStreak}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/10 border border-white/20">
                        📊 {dailyProgress.gamesWon}/{dailyProgress.gamesPlayed}
                      </span>
                    </div>
                  )}
                </div>
                {guesses.map((guess, i) => (
                  <div
                    key={i}
                    className="w-full mx-auto"
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${wordLen}, minmax(0.5rem, 40px))`,
                      gap: "0.15rem",
                      justifyContent: "center",
                    }}
                  >
                    {Array.from({ length: wordLen }).map((_, j) => (
                      <div
                        key={j}
                        className={`aspect-square flex items-center justify-center text-[10px] md:text-xs font-bold rounded-sm uppercase ${
                          colorsByRow[i]?.[j] === "exact"
                            ? "bg-green-500 text-white"
                            : colorsByRow[i]?.[j] === "present"
                            ? "bg-yellow-500 text-white"
                            : "bg-gray-300 dark:bg-gray-700"
                        }`}
                      >
                        {(guess[j] || "").toUpperCase()}
                      </div>
                    ))}
                  </div>
                ))}

                {!gameOver && (
                  <div
                    className="w-full mx-auto"
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${wordLen}, minmax(0.5rem, 40px))`,
                      gap: "0.15rem",
                      justifyContent: "center",
                    }}
                  >
                    {Array.from({ length: wordLen }).map((_, i) => (
                      <div
                        key={i}
                        className="aspect-square flex items-center justify-center text-[10px] md:text-xs font-bold rounded-sm uppercase border border-white/40 bg-white/20 text-white"
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
                    <div
                      key={r}
                      className="w-full mx-auto"
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${wordLen}, minmax(0.5rem, 40px))`,
                        gap: "0.15rem",
                        justifyContent: "center",
                      }}
                    >
                      {Array.from({ length: wordLen }).map((_, j) => (
                        <div
                          key={j}
                          className="aspect-square flex items-center justify-center rounded-sm border border-white/30 bg-white/10"
                        />
                      ))}
                    </div>
                  ))}
              </div>

              {!gameOver && (
                <div className="space-y-1.5 mt-3 w-full max-w-[360px] mx-auto px-2">
                  {[
                    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
                    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
                    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
                  ].map((row, i) => (
                    <div key={i} className="flex justify-center gap-1">
                      {row.map((key) => (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          className={`
                            h-6 md:h-7 text-[10px] md:text-[11px] font-semibold bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white rounded-sm
                            ${
                              key === "ENTER" || key === "BACKSPACE"
                                ? "px-1.5 md:px-2 min-w-[38px] md:min-w-[50px]"
                                : "px-1 md:px-1 min-w-[20px] md:min-w-[26px] flex-1 max-w-[26px] md:max-w-[34px]"
                            }
                          `}
                          onClick={() => handleKeyPress(key)}
                        >
                          {key === "BACKSPACE"
                            ? "⌫"
                            : key === "ENTER"
                            ? "↵"
                            : key}
                        </Button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <GameOverModal />
      <SettingsModal />
      <WordMeaning
        word={currentWord}
        isOpen={showWordMeaning}
        onClose={() => setShowWordMeaning(false)}
      />
    </div>
  );
};

export default WordleGame;
