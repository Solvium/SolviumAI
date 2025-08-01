import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Trophy, Gift, Sparkles } from "lucide-react";
import HintSystem from "../monetization/HintSystem";
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
  const [targetWord, setTargetWord] = useState("");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [userCoins, setUserCoins] = useState(150);
  const maxGuesses = 6;

  // Initialize the game
  useEffect(() => {
    startNewGame();
  }, []);

  const startNewGame = () => {
    const randomIndex = Math.floor(Math.random() * WORDS.length);
    setTargetWord(WORDS[randomIndex]);
    setGuesses([]);
    setCurrentGuess("");
    setGameOver(false);
    setGameWon(false);
    setHintUsed(false);
    console.log(`Target word: ${WORDS[randomIndex]}`); // For debugging
  };

  const handleKeyPress = (key: string) => {
    if (gameOver) return;

    if (key === "ENTER") {
      // Submit guess
      if (currentGuess.length !== 5) {
        toast.error("Word must be 5 letters!");
        return;
      }

      const newGuesses = [...guesses, currentGuess];
      setGuesses(newGuesses);
      setCurrentGuess("");

      // Check if won
      if (currentGuess === targetWord) {
        setGameWon(true);
        setGameOver(true);

        // Calculate reward (more coins if fewer guesses were used)
        const baseReward = 20;
        const guessBonus = (maxGuesses - newGuesses.length) * 5;
        const hintPenalty = hintUsed ? -5 : 0;
        const totalReward = baseReward + guessBonus + hintPenalty;

        setUserCoins((prev) => prev + totalReward);

        toast.success(`You won! +${totalReward} coins! 🎉`);
      }
      // Check if lost
      else if (newGuesses.length >= maxGuesses) {
        setGameOver(true);
        toast.error(`Game over! The word was ${targetWord}`);
      }
    } else if (key === "BACKSPACE") {
      // Delete last letter
      setCurrentGuess((prev) => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      // Add letter
      setCurrentGuess((prev) => prev + key);
    }
  };

  // Get tile color based on letter position
  const getTileColor = (letter: string, index: number, word: string) => {
    if (letter === targetWord[index]) {
      return "bg-green-500 text-white"; // Correct letter, correct position
    } else if (targetWord.includes(letter)) {
      return "bg-yellow-500 text-white"; // Correct letter, wrong position
    } else {
      return "bg-gray-300 dark:bg-gray-700"; // Wrong letter
    }
  };

  // Generate hint based on current game state
  const generateHint = () => {
    // If no guesses yet, reveal the first letter
    if (guesses.length === 0) {
      return `The first letter is ${targetWord[0]}`;
    }

    // Find a letter position they haven't guessed correctly yet
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

    // Fallback hint
    return `The word rhymes with "${targetWord.replace(/.[^aeiou]$/, "AY")}"`;
  };

  const handleUseHint = () => {
    setHintUsed(true);
    setUserCoins((prev) => prev - 15); // Deduct coins for hint
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center flex justify-between items-center">
          <span>Wordle Game</span>
          {!gameOver && (
            <HintSystem
              hintCost={15}
              hint={generateHint()}
              userCoins={userCoins}
              onUseHint={handleUseHint}
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Game board */}
        <div className="space-y-2 mb-4">
          {/* Render previous guesses */}
          {guesses.map((guess, i) => (
            <div key={i} className="grid grid-cols-5 gap-2">
              {guess.split("").map((letter, j) => (
                <div
                  key={j}
                  className={`w-full aspect-square flex items-center justify-center text-lg font-bold rounded uppercase ${getTileColor(
                    letter,
                    j,
                    guess
                  )}`}
                >
                  {letter}
                </div>
              ))}
            </div>
          ))}

          {/* Current guess */}
          {!gameOver && (
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="w-full aspect-square flex items-center justify-center text-lg font-bold rounded uppercase border-2 border-primary/30"
                >
                  {currentGuess[i] || ""}
                </div>
              ))}
            </div>
          )}

          {/* Empty rows */}
          {!gameOver &&
            Array.from({ length: maxGuesses - guesses.length - 1 }).map(
              (_, i) => (
                <div key={i} className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div
                      key={j}
                      className="w-full aspect-square flex items-center justify-center rounded border border-gray-300 dark:border-gray-700"
                    />
                  ))}
                </div>
              )
            )}
        </div>

        {/* Keyboard */}
        {!gameOver && (
          <div className="space-y-2">
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
                    className={`px-2 py-5 ${
                      key === "ENTER" || key === "BACKSPACE"
                        ? "text-xs px-1"
                        : ""
                    }`}
                    onClick={() => handleKeyPress(key)}
                  >
                    {key === "BACKSPACE" ? "⌫" : key}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Game over state */}
        {gameOver && (
          <div className="mt-6 space-y-4 text-center">
            {gameWon ? (
              <>
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-lg font-bold">You Won!</p>
                <p>You guessed the word in {guesses.length} tries.</p>

                <div className="grid grid-cols-3 gap-2 my-4">
                  <div className="bg-primary/10 rounded p-3 text-center">
                    <Trophy className="w-5 h-5 mx-auto mb-1 text-game-accent" />
                    <span className="text-xs block">+100 pts</span>
                  </div>
                  <div className="bg-primary/10 rounded p-3 text-center">
                    <Coins className="w-5 h-5 mx-auto mb-1 text-game-accent" />
                    <span className="text-xs block">
                      +
                      {20 +
                        (maxGuesses - guesses.length) * 5 +
                        (hintUsed ? -5 : 0)}{" "}
                      coins
                    </span>
                  </div>
                  <div className="bg-primary/10 rounded p-3 text-center">
                    <Gift className="w-5 h-5 mx-auto mb-1 text-game-accent" />
                    <span className="text-xs block">🔤 Badge</span>
                  </div>
                </div>

                {hintUsed && (
                  <p className="text-sm text-muted-foreground">
                    <Sparkles className="inline-block w-4 h-4 mr-1" />
                    Hint used: -5 coin bonus
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="text-3xl mb-2">😢</div>
                <p className="text-lg font-bold">Game Over</p>
                <p>
                  The word was: <span className="font-bold">{targetWord}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Better luck next time!
                </p>

                {/* Even when losing, give a small reward for playing */}
                <div className="bg-primary/10 rounded p-2 text-center inline-block mt-2">
                  <Coins className="w-4 h-4 inline-block mr-1 text-game-accent" />
                  <span className="text-xs">+5 coins for playing</span>
                </div>
              </>
            )}

            <Button onClick={startNewGame} className="mt-4">
              Play Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WordleGame;
