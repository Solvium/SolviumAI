"use client"

import type React from "react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Coins, Trophy, Gift, Sparkles, Play, X } from "lucide-react"
import HintSystem from "../monetization/HintSystem"
// import HintSystem from "@/components/monetization/HintSystem";

// A simple list of words for the game
const WORDS = ["REACT", "GAMES", "WORDLE", "PUZZLE", "BRAIN", "LOGIC", "CODES", "BONUS"]

const WordleGame: React.FC = () => {
  const [gameStarted, setGameStarted] = useState(false)
  const [targetWord, setTargetWord] = useState("")
  const [guesses, setGuesses] = useState<string[]>([])
  const [currentGuess, setCurrentGuess] = useState("")
  const [gameOver, setGameOver] = useState(false)
  const [gameWon, setGameWon] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)
  const [userCoins, setUserCoins] = useState(150)
  const [showGameOverModal, setShowGameOverModal] = useState(false)
  const maxGuesses = 6

  const startNewGame = () => {
    const randomIndex = Math.floor(Math.random() * WORDS.length)
    setTargetWord(WORDS[randomIndex])
    setGuesses([])
    setCurrentGuess("")
    setGameOver(false)
    setGameWon(false)
    setHintUsed(false)
    setGameStarted(true)
    setShowGameOverModal(false)
    // For debugging
  }

  const handleStartGame = () => {
    startNewGame()
  }

  const handleKeyPress = (key: string) => {
    if (gameOver) return

    if (key === "ENTER") {
      if (currentGuess.length !== 5) {
        toast.error("Word must be 5 letters!")
        return
      }

      const newGuesses = [...guesses, currentGuess]
      setGuesses(newGuesses)
      setCurrentGuess("")

      if (currentGuess === targetWord) {
        setGameWon(true)
        setGameOver(true)
        setShowGameOverModal(true)

        const baseReward = 20
        const guessBonus = (maxGuesses - newGuesses.length) * 5
        const hintPenalty = hintUsed ? -5 : 0
        const totalReward = baseReward + guessBonus + hintPenalty

        setUserCoins((prev) => prev + totalReward)

        toast.success(`You won! +${totalReward} coins! 🎉`)
      } else if (newGuesses.length >= maxGuesses) {
        setGameOver(true)
        setShowGameOverModal(true)
        toast.error(`Game over! The word was ${targetWord}`)
      }
    } else if (key === "BACKSPACE") {
      setCurrentGuess((prev) => prev.slice(0, -1))
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess((prev) => prev + key)
    }
  }

  const getTileColor = (letter: string, index: number, word: string) => {
    if (letter === targetWord[index]) {
      return "bg-green-500 text-white"
    } else if (targetWord.includes(letter)) {
      return "bg-yellow-500 text-white"
    } else {
      return "bg-gray-300 dark:bg-gray-700"
    }
  }

  const generateHint = () => {
    if (guesses.length === 0) {
      return `The first letter is ${targetWord[0]}`
    }

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

    return `The word rhymes with "${targetWord.replace(/.[^aeiou]$/, "AY")}"`
  }

  const handleUseHint = () => {
    setHintUsed(true)
    setUserCoins((prev) => prev - 15)
  }

  const TutorialScreen = () => (
    <div className="flex-1 flex flex-col justify-center items-center px-4 text-white overflow-hidden">
      <div className="max-w-md mx-auto text-center space-y-4">
        <div className="mb-3">
          {/* <Info className="w-8 h-8 mx-auto mb-2 text-blue-400" /> */}
          <h2 className="text-xl font-bold mb-1 mt-3">Instructions</h2>
          <p className="text-sm text-gray-300">Guess the 5-letter word in 6 tries!</p>
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
              <span className="text-sm">Green = Correct letter in correct position</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500 rounded flex items-center justify-center text-white font-bold">
                B
              </div>
              <span className="text-sm">Yellow = Correct letter in wrong position</span>
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
            <p className="text-sm">Need help? Use hints for 15 coins to reveal letters!</p>
          </div>

          <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-400/30">
            <h4 className="font-bold mb-2 flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Earn Rewards
            </h4>
            <p className="text-sm">Win coins based on how quickly you solve the puzzle!</p>
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
  )

  const GameOverModal = () => {
    if (!showGameOverModal) return null

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
            <h3 className="text-2xl font-bold text-white">{gameWon ? "You Won!" : "Game Over"}</h3>
            <p className="text-slate-300 text-center mt-2">
              {gameWon ? `You guessed the word in ${guesses.length} tries.` : `The word was: ${targetWord}`}
            </p>
          </div>

          <div className="flex-1 px-6 pb-6">
            {gameWon ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-yellow-500/20 rounded-lg p-4 text-center border border-yellow-400/30">
                    <Trophy className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                    <span className="text-sm text-white block font-medium">+100 pts</span>
                  </div>
                  <div className="bg-yellow-500/20 rounded-lg p-4 text-center border border-yellow-400/30">
                    <Coins className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                    <span className="text-sm text-white block font-medium">
                      +{20 + (maxGuesses - guesses.length) * 5 + (hintUsed ? -5 : 0)} coins
                    </span>
                  </div>
                  <div className="bg-yellow-500/20 rounded-lg p-4 text-center border border-yellow-400/30">
                    <Gift className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                    <span className="text-sm text-white block font-medium">🔤 Badge</span>
                  </div>
                </div>

                {hintUsed && (
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <p className="text-slate-300 text-sm">
                      <Sparkles className="inline-block w-4 h-4 mr-1" />
                      Hint used: -5 coin bonus
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-slate-300">Better luck next time!</p>
                <div className="bg-slate-700/50 rounded-lg p-3 inline-block">
                  <Coins className="w-4 h-4 inline-block mr-1 text-yellow-400" />
                  <span className="text-white text-sm">+5 coins for playing</span>
                </div>
              </div>
            )}

            <div className="space-y-3 mt-6">
              <Button
                onClick={() => {
                  startNewGame()
                  setShowGameOverModal(false)
                }}
                className="w-full bg-[#1EC7FF] hover:bg-[]-600 text-white font-semibold py-3 rounded-xl transition-all duration-200 transform hover:scale-105"
              >
                Play Again
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
    )
  }

  return (
    <div className="w-full h-max-screen p-2 bg-[#0A0146] overflow-hidden">
      <div className="absolute"></div>

      <div className="relative z-10 h-full flex flex-col">
        <div className="w-full h-full flex flex-col">
          <div className="pb-0 pt-4 px-4 flex-shrink-0">
            <div className="text-center flex justify-between items-center text-[#1EC7FF]">
              <span className="text-xl ml-10 md:text-2xl font-bold">Wordle Game</span>
              {gameStarted && !gameOver && (
                <HintSystem hintCost={15} hint={generateHint()} userCoins={userCoins} onUseHint={handleUseHint} />
              )}
            </div>
          </div>

          {!gameStarted ? (
            <TutorialScreen />
          ) : (
            <>
              <div className="px-4 pt-10 flex-1 flex flex-col space-y-3 justify-center items-center">
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

                {!gameOver && (
                  <div className="grid grid-cols-5 gap-2  md:gap-3 w-full">
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

                {!gameOver &&
                  Array.from({ length: maxGuesses - guesses.length - 1 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-5 gap-3  md:gap-3 w-full">
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
                <div className="space-y-3 mt-8 max-h-[700px]:mt-5 w-full max-w-lg p-2 pr-4 pl-4">
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
            </>
          )}
        </div>
      </div>

      <GameOverModal />
    </div>
  )
}

export default WordleGame
