"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Coins, Trophy, Gift, Sparkles } from "lucide-react"
import HintSystem from "../monetization/HintSystem"
// import HintSystem from "@/components/monetization/HintSystem";

// A simple list of words for the game
const WORDS = ["REACT", "GAMES", "WORDLE", "PUZZLE", "BRAIN", "LOGIC", "CODES", "BONUS"]

const WordleGame: React.FC = () => {
  const [targetWord, setTargetWord] = useState("")
  const [guesses, setGuesses] = useState<string[]>([])
  const [currentGuess, setCurrentGuess] = useState("")
  const [gameOver, setGameOver] = useState(false)
  const [gameWon, setGameWon] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)
  const [userCoins, setUserCoins] = useState(150)
  const maxGuesses = 6

  // Initialize the game
  useEffect(() => {
    startNewGame()
  }, [])

  const startNewGame = () => {
    const randomIndex = Math.floor(Math.random() * WORDS.length)
    setTargetWord(WORDS[randomIndex])
    setGuesses([])
    setCurrentGuess("")
    setGameOver(false)
    setGameWon(false)
    setHintUsed(false)
    // For debugging
  }

  const handleKeyPress = (key: string) => {
    if (gameOver) return

    if (key === "ENTER") {
      // Submit guess
      if (currentGuess.length !== 5) {
        toast.error("Word must be 5 letters!")
        return
      }

      const newGuesses = [...guesses, currentGuess]
      setGuesses(newGuesses)
      setCurrentGuess("")

      // Check if won
      if (currentGuess === targetWord) {
        setGameWon(true)
        setGameOver(true)

        // Calculate reward (more coins if fewer guesses were used)
        const baseReward = 20
        const guessBonus = (maxGuesses - newGuesses.length) * 5
        const hintPenalty = hintUsed ? -5 : 0
        const totalReward = baseReward + guessBonus + hintPenalty

        setUserCoins((prev) => prev + totalReward)

        toast.success(`You won! +${totalReward} coins! 🎉`)
      }
      // Check if lost
      else if (newGuesses.length >= maxGuesses) {
        setGameOver(true)
        toast.error(`Game over! The word was ${targetWord}`)
      }
    } else if (key === "BACKSPACE") {
      // Delete last letter
      setCurrentGuess((prev) => prev.slice(0, -1))
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      // Add letter
      setCurrentGuess((prev) => prev + key)
    }
  }

  // Get tile color based on letter position
  const getTileColor = (letter: string, index: number, word: string) => {
    if (letter === targetWord[index]) {
      return "bg-green-500 text-white" // Correct letter, correct position
    } else if (targetWord.includes(letter)) {
      return "bg-yellow-500 text-white" // Correct letter, wrong position
    } else {
      return "bg-gray-300 dark:bg-gray-700" // Wrong letter
    }
  }

  // Generate hint based on current game state
  const generateHint = () => {
    // If no guesses yet, reveal the first letter
    if (guesses.length === 0) {
      return `The first letter is ${targetWord[0]}`
    }

    // Find a letter position they haven't guessed correctly yet
    for (let i = 0; i < 5; i++) {
      let correctGuess = false
      for (const guess of guesses) {
        if (guess[i] === targetWord[i]) {
          correctGuess = true
          break
        }
      }

      if (!correctGuess) {
        return `The letter at position ${i + 1} is ${targetWord[i]}`
      }
    }

    // Fallback hint
    return `The word rhymes with "${targetWord.replace(/.[^aeiou]$/, "AY")}"`
  }

  const handleUseHint = () => {
    setHintUsed(true)
    setUserCoins((prev) => prev - 15) // Deduct coins for hint
  }

  return (
    <div
    className="w-full h-max-screen p-2 bg-cover bg-center bg-no-repeat overflow-hidden"

      style={{ backgroundImage: "url('/tropical-adventure-bg.jpg')" }}
    >
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Content wrapper with relative positioning and full height */}
      <div className="relative z-10 h-full flex flex-col">
        <div className="w-full h-full flex flex-col">
          {/* Header */}
          <div className="pb-0 pt-4 px-4 flex-shrink-0">
            <div className="text-center flex justify-between items-center text-white">
              <span className="text-xl ml-10 md:text-2xl font-bold">Wordle Game</span>
              {!gameOver && (
                <HintSystem hintCost={15} hint={generateHint()} userCoins={userCoins} onUseHint={handleUseHint} />
              )}
            </div>
          </div>

          {/* Game content */}
          <div className="px-4 pt-10 flex-1 flex flex-col justify-center items-center">
            <div className="space-y-2 md:space-y-3 mb-4 md:mb-4 w-full max-w-sm md:max-w-md lg:max-w-lg">
              {/* Render previous guesses */}
              {guesses.map((guess, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 md:gap-3 w-full">
                  {guess.split("").map((letter, j) => (
                    <div
                      key={j}
                      className={`aspect-square flex items-center justify-center text-lg md:text-xl lg:text-2xl font-bold rounded-lg uppercase ${getTileColor(
                        letter,
                        j,
                        guess,
                      )}`}
                    >
                      {letter}
                    </div>
                  ))}
                </div>
              ))}

              {/* Current guess */}
              {!gameOver && (
                <div className="grid grid-cols-5 gap-2 md:gap-3 w-full">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square flex items-center justify-center text-lg md:text-xl lg:text-2xl font-bold rounded-lg uppercase border-2 border-white/50 bg-white/20 text-white"
                    >
                      {currentGuess[i] || ""}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty rows */}
              {!gameOver &&
                Array.from({ length: maxGuesses - guesses.length - 1 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 md:gap-3 w-full">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div
                        key={j}
                        className="aspect-square flex items-center justify-center rounded-lg border border-white/30 bg-white/10"
                      />
                    ))}
                  </div>
                ))}
            </div>

            {!gameOver && (
              <div className="space-y-2 w-full max-w-lg p-2 pr-4 pl-4">
                {[
                  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
                  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
                  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
                ].map((row, i) => (
                  <div key={i} className="flex justify-center gap-1 md:gap-2">
                    {row.map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        className={`
                          h-10 md:h-12 text-sm md:text-base font-semibold bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white rounded-lg
                          ${
                            key === "ENTER" || key === "BACKSPACE"
                              ? "px-2 md:px-4 min-w-[60px] md:min-w-[80px]"
                              : "px-2 md:px-3 min-w-[32px] md:min-w-[40px] flex-1 max-w-[40px] md:max-w-[50px]"
                          }
                        `}
                        onClick={() => handleKeyPress(key)}
                      >
                        {key === "BACKSPACE" ? "⌫" : key === "ENTER" ? "↵" : key}
                      </Button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {gameOver && (
              <div className="mt-6 space-y-4 text-center text-white max-w-md">
                {gameWon ? (
                  <>
                    <div className="text-4xl md:text-5xl mb-2">🎉</div>
                    <p className="text-xl md:text-2xl font-bold">You Won!</p>
                    <p className="text-base md:text-lg">You guessed the word in {guesses.length} tries.</p>

                    <div className="grid grid-cols-3 gap-2 md:gap-3 my-4 max-w-sm mx-auto">
                      <div className="bg-primary/20 rounded-lg p-3 md:p-4 text-center">
                        <Trophy className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1 text-yellow-400" />
                        <span className="text-xs md:text-sm block">+100 pts</span>
                      </div>
                      <div className="bg-primary/20 rounded-lg p-3 md:p-4 text-center">
                        <Coins className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1 text-yellow-400" />
                        <span className="text-xs md:text-sm block">
                          +{20 + (maxGuesses - guesses.length) * 5 + (hintUsed ? -5 : 0)} coins
                        </span>
                      </div>
                      <div className="bg-primary/20 rounded-lg p-3 md:p-4 text-center">
                        <Gift className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1 text-yellow-400" />
                        <span className="text-xs md:text-sm block">🔤 Badge</span>
                      </div>
                    </div>

                    {hintUsed && (
                      <p className="text-sm md:text-base text-gray-300">
                        <Sparkles className="inline-block w-4 h-4 md:w-5 md:h-5 mr-1" />
                        Hint used: -5 coin bonus
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-4xl md:text-5xl mb-2">😢</div>
                    <p className="text-xl md:text-2xl font-bold">Game Over</p>
                    <p className="text-base md:text-lg">
                      The word was: <span className="font-bold text-yellow-400">{targetWord}</span>
                    </p>
                    <p className="text-sm md:text-base text-gray-300">Better luck next time!</p>

                    {/* Even when losing, give a small reward for playing */}
                    <div className="bg-primary/20 rounded-lg p-3 text-center inline-block mt-2">
                      <Coins className="w-4 h-4 md:w-5 md:h-5 inline-block mr-1 text-yellow-400" />
                      <span className="text-sm">+5 coins for playing</span>
                    </div>
                  </>
                )}

                <Button
                  onClick={startNewGame}
                  className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 text-base md:text-lg rounded-lg"
                >
                  Play Again
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default WordleGame
