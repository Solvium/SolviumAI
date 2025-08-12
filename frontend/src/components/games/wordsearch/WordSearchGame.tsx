"use client"

import React from "react"

import type { ReactElement } from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  Lightbulb,
  Trophy,
  Zap,
  CheckCircle,
  Pause,
  Play,
  RotateCcw,
  Menu,
  Home,
  Search,
  X,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  Hand,
  Target,
  Clock,
  Volume2,
  VolumeX,
} from "lucide-react"

// Types
interface GridCell {
    letter: string
    isPartOfWord: boolean
    foundWordIds: number[]
    isHighlighted: boolean
    isSelected: boolean
  }

  interface WordToFind {
    id: number
    word: string
    found: boolean
    startRow: number
    startCol: number
    endRow: number
    endCol: number
    direction: "horizontal" | "vertical" | "diagonal-down" | "diagonal-up"
    isReversed: boolean
  }

  interface GameStats {
    level: number
    difficulty: "easy" | "medium" | "hard"
    puzzle: number
    score: number
    totalScore: number
    hintsUsed: number
    hintsRemaining: number
    purchasedHints: number
    points: number
    tokens: number
    badges: string[]
    completedPuzzles: Set<string>
    perfectSolves: number
    speedBonuses: number
    currentStreak: number
    wordsFound: number
  }

  interface PuzzleData {
    id: string
    title: string
    theme: string
    grid: GridCell[][]
    words: WordToFind[]
    gridSize: number
    basePoints: number
  }

  interface TutorialStep {
    id: number
    title: string
    description: string
    target?: string
    action?: string
    icon: React.ComponentType<{ className?: string }>
  }

  // Sound effects class
class SoundManager {
    private audioContext: AudioContext | null = null
    private sounds: { [key: string]: AudioBuffer } = {}
    private isEnabled = true
    private volume = 0.3
  
    constructor() {
      this.initializeAudioContext()
    }
  
    private async initializeAudioContext() {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        await this.generateSounds()
      } catch (error) {
        console.warn("Audio not supported:", error)
      }
    }
  
    private async generateSounds() {
      if (!this.audioContext) return
  
      // Generate different sound effects
      this.sounds.wordFound = this.createWordFoundSound()
      this.sounds.puzzleComplete = this.createPuzzleCompleteSound()
      this.sounds.tick = this.createTickSound()
      this.sounds.swipe = this.createSwipeSound()
      this.sounds.hint = this.createHintSound()
      this.sounds.error = this.createErrorSound()
      this.sounds.button = this.createButtonSound()
      this.sounds.selection = this.createSelectionSound()
      this.sounds.speedBonus = this.createSpeedBonusSound()
    }
  
    private createWordFoundSound(): AudioBuffer {
      if (!this.audioContext) return new AudioBuffer({ length: 1, sampleRate: 44100 })
  
      const sampleRate = this.audioContext.sampleRate
      const duration = 0.3
      const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buffer.getChannelData(0)
  
      // Create a pleasant ascending chord
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate
        const envelope = Math.exp(-t * 3)
  
        const freq1 = 523.25 // C5
        const freq2 = 659.25 // E5
        const freq3 = 783.99 // G5
  
        data[i] =
          envelope *
          0.3 *
          (Math.sin(2 * Math.PI * freq1 * t) +
            Math.sin(2 * Math.PI * freq2 * t) * 0.7 +
            Math.sin(2 * Math.PI * freq3 * t) * 0.5)
      }
  
      return buffer
    }
  
    private createPuzzleCompleteSound(): AudioBuffer {
      if (!this.audioContext) return new AudioBuffer({ length: 1, sampleRate: 44100 })
  
      const sampleRate = this.audioContext.sampleRate
      const duration = 1.0
      const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buffer.getChannelData(0)
  
      // Victory fanfare
      const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
  
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate
        const noteIndex = Math.floor(t * 4)
        const envelope = Math.exp(-t * 2) * (1 - t * 0.5)
  
        if (noteIndex < notes.length) {
          data[i] = envelope * 0.4 * Math.sin(2 * Math.PI * notes[noteIndex] * t)
        }
      }
  
      return buffer
    }
  
    private createTickSound(): AudioBuffer {
      if (!this.audioContext) return new AudioBuffer({ length: 1, sampleRate: 44100 })
  
      const sampleRate = this.audioContext.sampleRate
      const duration = 0.1
      const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buffer.getChannelData(0)
  
      // Short tick sound
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate
        const envelope = Math.exp(-t * 50)
        data[i] = envelope * 0.2 * Math.sin(2 * Math.PI * 800 * t)
      }
  
      return buffer
    }
  
    private createSwipeSound(): AudioBuffer {
      if (!this.audioContext) return new AudioBuffer({ length: 1, sampleRate: 44100 })
  
      const sampleRate = this.audioContext.sampleRate
      const duration = 0.2
      const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buffer.getChannelData(0)
  
      // Swoosh sound
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate
        const envelope = Math.exp(-t * 8)
        const frequency = 400 + t * 200
        data[i] = envelope * 0.15 * Math.sin(2 * Math.PI * frequency * t)
      }
  
      return buffer
    }
  
    private createHintSound(): AudioBuffer {
      if (!this.audioContext) return new AudioBuffer({ length: 1, sampleRate: 44100 })
  
      const sampleRate = this.audioContext.sampleRate
      const duration = 0.4
      const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buffer.getChannelData(0)
  
      // Magical hint sound
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate
        const envelope = Math.exp(-t * 4)
        const frequency = 440 + Math.sin(t * 10) * 100
        data[i] = envelope * 0.25 * Math.sin(2 * Math.PI * frequency * t)
      }
  
      return buffer
    }
  
    private createErrorSound(): AudioBuffer {
      if (!this.audioContext) return new AudioBuffer({ length: 1, sampleRate: 44100 })
  
      const sampleRate = this.audioContext.sampleRate
      const duration = 0.3
      const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buffer.getChannelData(0)
  
      // Error buzz
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate
        const envelope = Math.exp(-t * 5)
        data[i] = envelope * 0.2 * Math.sin(2 * Math.PI * 150 * t)
      }
  
      return buffer
    }
  
    private createButtonSound(): AudioBuffer {
      if (!this.audioContext) return new AudioBuffer({ length: 1, sampleRate: 44100 })
  
      const sampleRate = this.audioContext.sampleRate
      const duration = 0.1
      const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buffer.getChannelData(0)
  
      // Button click
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate
        const envelope = Math.exp(-t * 30)
        data[i] = envelope * 0.15 * Math.sin(2 * Math.PI * 1000 * t)
      }
  
      return buffer
    }
  
    private createSelectionSound(): AudioBuffer {
      if (!this.audioContext) return new AudioBuffer({ length: 1, sampleRate: 44100 })
  
      const sampleRate = this.audioContext.sampleRate
      const duration = 0.05
      const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buffer.getChannelData(0)
  
      // Soft selection sound
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate
        const envelope = Math.exp(-t * 20)
        data[i] = envelope * 0.1 * Math.sin(2 * Math.PI * 600 * t)
      }
  
      return buffer
    }
  
    private createSpeedBonusSound(): AudioBuffer {
      if (!this.audioContext) return new AudioBuffer({ length: 1, sampleRate: 44100 })
  
      const sampleRate = this.audioContext.sampleRate
      const duration = 0.6
      const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buffer.getChannelData(0)
  
      // Speed bonus celebration
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate
        const envelope = Math.exp(-t * 3)
        const frequency = 880 + Math.sin(t * 15) * 200
        data[i] = envelope * 0.3 * Math.sin(2 * Math.PI * frequency * t)
      }
  
      return buffer
    }
  
    async playSound(soundName: string) {
      if (!this.audioContext || !this.isEnabled || !this.sounds[soundName]) return
  
      try {
        // Resume audio context if suspended (required by some browsers)
        if (this.audioContext.state === "suspended") {
          await this.audioContext.resume()
        }
  
        const source = this.audioContext.createBufferSource()
        const gainNode = this.audioContext.createGain()
  
        source.buffer = this.sounds[soundName]
        gainNode.gain.value = this.volume
  
        source.connect(gainNode)
        gainNode.connect(this.audioContext.destination)
  
        source.start()
      } catch (error) {
        console.warn("Error playing sound:", error)
      }
    }
  
    setEnabled(enabled: boolean) {
      this.isEnabled = enabled
    }
  
    setVolume(volume: number) {
      this.volume = Math.max(0, Math.min(1, volume))
    }
  
    isAudioEnabled(): boolean {
      return this.isEnabled
    }
  }

  const tutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: "Welcome to Word Hunt!",
      description: "Let's learn how to play this exciting word search game.",
      icon: Trophy,
    },
    {
      id: 2,
      title: "Find Hidden Words",
      description: "Words are hidden in the grid horizontally, vertically, and diagonally.",
      target: "grid",
      icon: Search,
    },
    {
      id: 3,
      title: "Drag to Select",
      description: "Touch and drag across letters to select words. Try it now!",
      target: "grid",
      action: "drag",
      icon: Hand,
    },
    {
      id: 4,
      title: "Check Your Progress",
      description: "Found words turn green. Track your progress at the top.",
      target: "progress",
      icon: Target,
    },
    {
      id: 5,
      title: "Beat the Clock",
      description: "Complete puzzles quickly for bonus points!",
      target: "timer",
      icon: Clock,
    },
    {
      id: 6,
      title: "Swipe to Navigate",
      description: "Swipe left/right to change difficulty, up/down to change levels.",
      icon: ArrowUp,
    },
    {
      id: 7,
      title: "Ready to Play!",
      description: "You're all set! Have fun finding words!",
      icon: Zap,
    },
  ]

  const wordThemes = {
    1: {
      easy: {
        theme: "Animals",
        words: ["CAT", "DOG", "BIRD", "FISH", "BEAR"],
      },
      medium: {
        theme: "Colors",
        words: ["RED", "BLUE", "GREEN", "YELLOW", "PURPLE", "ORANGE"],
      },
      hard: {
        theme: "Food",
        words: ["PIZZA", "BURGER", "PASTA", "SALAD", "BREAD", "FRUIT", "CHEESE"],
      },
    },
    2: {
      easy: {
        theme: "Sports",
        words: ["BALL", "GAME", "RUN", "JUMP", "SWIM"],
      },
      medium: {
        theme: "Nature",
        words: ["TREE", "FLOWER", "RIVER", "MOUNTAIN", "OCEAN", "FOREST"],
      },
      hard: {
        theme: "Technology",
        words: ["PHONE", "COMPUTER", "INTERNET", "SOFTWARE", "DIGITAL", "MOBILE"],
      },
    },
  }

  // Generate word search (same logic as before)
const generateWordSearch = (words: string[], gridSize: number, difficulty: string): PuzzleData => {
    const grid: GridCell[][] = Array(gridSize)
      .fill(null)
      .map(() =>
        Array(gridSize)
          .fill(null)
          .map(() => ({
            letter: "",
            isPartOfWord: false,
            foundWordIds: [],
            isHighlighted: false,
            isSelected: false,
          })),
      )
  
    const wordsToFind: WordToFind[] = []
    const directions = ["horizontal", "vertical", "diagonal-down", "diagonal-up"]
  
    words.forEach((word, index) => {
      let placed = false
      let attempts = 0
      const maxAttempts = 50
  
      while (!placed && attempts < maxAttempts) {
        const direction = directions[Math.floor(Math.random() * directions.length)]
        const isReversed = Math.random() < 0.2
        const wordToPlace = isReversed ? word.split("").reverse().join("") : word
  
        let startRow, startCol, endRow, endCol
        let canPlace = true
  
        switch (direction) {
          case "horizontal":
            startRow = Math.floor(Math.random() * gridSize)
            startCol = Math.floor(Math.random() * (gridSize - wordToPlace.length + 1))
            endRow = startRow
            endCol = startCol + wordToPlace.length - 1
            break
          case "vertical":
            startRow = Math.floor(Math.random() * (gridSize - wordToPlace.length + 1))
            startCol = Math.floor(Math.random() * gridSize)
            endRow = startRow + wordToPlace.length - 1
            endCol = startCol
            break
          case "diagonal-down":
            startRow = Math.floor(Math.random() * (gridSize - wordToPlace.length + 1))
            startCol = Math.floor(Math.random() * (gridSize - wordToPlace.length + 1))
            endRow = startRow + wordToPlace.length - 1
            endCol = startCol + wordToPlace.length - 1
            break
          case "diagonal-up":
            startRow = Math.floor(Math.random() * (gridSize - wordToPlace.length + 1)) + wordToPlace.length - 1
            startCol = Math.floor(Math.random() * (gridSize - wordToPlace.length + 1))
            endRow = startRow - wordToPlace.length + 1
            endCol = startCol + wordToPlace.length - 1
            break
          default:
            continue
        }
  
        for (let i = 0; i < wordToPlace.length; i++) {
          let row, col
          switch (direction) {
            case "horizontal":
              row = startRow
              col = startCol + i
              break
            case "vertical":
              row = startRow + i
              col = startCol
              break
            case "diagonal-down":
              row = startRow + i
              col = startCol + i
              break
            case "diagonal-up":
              row = startRow - i
              col = startCol + i
              break
            default:
              canPlace = false
              break
          }
  
          if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
            canPlace = false
            break
          }
  
          if (grid[row][col].letter && grid[row][col].letter !== wordToPlace[i]) {
            canPlace = false
            break
          }
        }
  
        if (canPlace) {
          for (let i = 0; i < wordToPlace.length; i++) {
            let row, col
            switch (direction) {
              case "horizontal":
                row = startRow
                col = startCol + i
                break
              case "vertical":
                row = startRow + i
                col = startCol
                break
              case "diagonal-down":
                row = startRow + i
                col = startCol + i
                break
              case "diagonal-up":
                row = startRow - i
                col = startCol + i
                break
            }
  
            grid[row][col].letter = wordToPlace[i]
            grid[row][col].isPartOfWord = true
          }
  
          wordsToFind.push({
            id: index,
            word: word,
            found: false,
            startRow,
            startCol,
            endRow,
            endCol,
            direction: direction as any,
            isReversed,
          })
  
          placed = true
        }
  
        attempts++
      }
    })
  
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        if (!grid[row][col].letter) {
          grid[row][col].letter = alphabet[Math.floor(Math.random() * alphabet.length)]
        }
      }
    }
  
    const difficultyPoints = { easy: 100, medium: 200, hard: 300 }
  
    return {
      id: `${Math.random()}`,
      title: `${wordThemes[1][difficulty].theme} Hunt`,
      theme: wordThemes[1][difficulty].theme,
      grid,
      words: wordsToFind,
      gridSize,
      basePoints: difficultyPoints[difficulty],
    }
  }

export default function MobileWordSearchGame(): ReactElement {
    return (
        <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 pb-20 transition-colors duration-300"
      onTouchStart={handleSwipeStart}
      onTouchEnd={handleSwipeEnd}
    >

              {/* Swipe Hint */}
      {showSwipeHint && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-medium">
          {showSwipeHint}
        </div>
      )}

       {/* Mobile Header */}
       <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => playSound("button")}>
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 dark:bg-gray-900">
                <SheetHeader>
                  <SheetTitle className="dark:text-white">Game Menu</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-6">
                  <Button
                    variant="ghost"
                    className="w-full justify-start dark:text-gray-300"
                    onClick={() => playSound("button")}
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Home
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start dark:text-gray-300"
                    onClick={() => playSound("button")}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Achievements
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start dark:text-gray-300"
                    onClick={() => {
                      setShowTutorial(true)
                      playSound("button")
                    }}
                  >
                    <Target className="w-4 h-4 mr-2" />
                    Tutorial
                  </Button>
                  <Button variant="ghost" className="w-full justify-start dark:text-gray-300" onClick={toggleDarkMode}>
                    {isDarkMode ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                    {isDarkMode ? "Light Mode" : "Dark Mode"}
                  </Button>
                  <Button variant="ghost" className="w-full justify-start dark:text-gray-300" onClick={toggleSound}>
                    {isSoundEnabled ? <Volume2 className="w-4 h-4 mr-2" /> : <VolumeX className="w-4 h-4 mr-2" />}
                    {isSoundEnabled ? "Sound On" : "Sound Off"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Word Hunt</h1>
              <p className="text-xs text-gray-600 dark:text-gray-400">{currentPuzzle.theme}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleSound}>
              {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleDarkMode}>
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsPaused(!isPaused)
                playSound("button")
              }}
              disabled={!isGameActive}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

 {/* Mobile Stats Bar */}
 <div className="px-4 py-3 bg-white/50 dark:bg-gray-800/50 transition-colors duration-300">
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{gameStats.level}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Level</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {gameStats.totalScore.toLocaleString()}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Score</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {gameStats.hintsRemaining + gameStats.purchasedHints}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Hints</div>
          </div>
          <div className="text-center" id="timer">
            <div
              className={`text-lg font-bold font-mono ${timeRemaining < 30 ? "text-red-600 dark:text-red-400" : "text-indigo-600 dark:text-indigo-400"}`}
            >
              {formatTime(timeRemaining)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Time</div>
          </div>
        </div>
      </div>

 {/* Progress Bar */}
 <div className="px-4 pb-4" id="progress">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {currentPuzzle.words.filter((w) => w.found).length}/{currentPuzzle.words.length}
          </span>
        </div>
        <Progress
          value={(currentPuzzle.words.filter((w) => w.found).length / currentPuzzle.words.length) * 100}
          className="h-2"
        />
      </div>
 {/* Difficulty Selector with Swipe Indicators */}
 <div className="px-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <ChevronLeft className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 text-center">
            Swipe left/right to change difficulty
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 transition-colors duration-300">
          {["easy", "medium", "hard"].map((diff) => (
            <button
              key={diff}
              onClick={() => {
                setGameStats((prev) => ({ ...prev, difficulty: diff as "easy" | "medium" | "hard", puzzle: 0 }))
                playSound("button")
              }}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                gameStats.difficulty === diff
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              {diff.charAt(0).toUpperCase() + diff.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <ArrowUp className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 text-center">
            Swipe up/down to change level
          </span>
          <ArrowDown className="w-4 h-4 text-gray-400" />
        </div>
      </div>

       {/* Word Search Grid */}
       <div className="px-4 mb-6" id="grid">
        <Card className="shadow-lg dark:bg-gray-800 transition-colors duration-300">
          <CardContent className="p-4">
            <div className="flex justify-center">
              <div
                ref={gridRef}
                className="grid gap-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg touch-none select-none transition-colors duration-300"
                style={{
                  gridTemplateColumns: `repeat(${currentPuzzle.gridSize}, 1fr)`,
                  maxWidth: "320px",
                  aspectRatio: "1",
                }}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {currentPuzzle.grid.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`
                        flex items-center justify-center text-sm font-bold rounded transition-all duration-200 border border-gray-300 dark:border-gray-600 aspect-square
                        ${
                          cell.isHighlighted
                            ? "bg-green-200 dark:bg-green-800 border-green-400 dark:border-green-600 text-green-800 dark:text-green-200"
                            : cell.isSelected
                              ? "bg-blue-200 dark:bg-blue-800 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-200"
                              : "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                        }
                      `}
                      onTouchStart={(e) => handleTouchStart(rowIndex, colIndex, e)}
                      style={{ minHeight: "28px", fontSize: "12px" }}
                    >
                      {cell.letter}
                    </div>
                  )),
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

       {/* Words to Find Button */}
       <div className="px-4 mb-6">
        <Sheet open={showWordsSheet} onOpenChange={setShowWordsSheet}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="w-full h-12 text-base bg-transparent dark:bg-gray-800 dark:text-white"
              onClick={() => playSound("button")}
            >
              <Search className="w-4 h-4 mr-2" />
              Words to Find ({currentPuzzle.words.filter((w) => !w.found).length} remaining)
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh] dark:bg-gray-900">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between dark:text-white">
                <span>Find These Words</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowWordsSheet(false)
                    playSound("button")
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-3 mt-6 overflow-y-auto">
              {currentPuzzle.words.map((word) => (
                <div
                  key={word.id}
                  className={`p-3 rounded-lg transition-all duration-200 ${
                    word.found
                      ? "bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-200"
                      : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${word.found ? "line-through" : ""}`}>{word.word}</span>
                    {word.found && <CheckCircle className="w-4 h-4 text-green-500" />}
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 safe-area-pb transition-colors duration-300">
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setShowHintDialog(true)
              playSound("button")
            }}
            disabled={gameStats.hintsRemaining + gameStats.purchasedHints <= 0}
            className="flex-1 h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            Hint
          </Button>
          <Button
            variant="outline"
            onClick={initializePuzzle}
            className="h-12 px-6 bg-transparent dark:bg-gray-800 dark:text-white"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tutorial Overlay */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full transition-colors duration-300">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                {React.createElement(tutorialSteps[currentTutorialStep].icon, {
                  className: "w-8 h-8 text-blue-600 dark:text-blue-400",
                })}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {tutorialSteps[currentTutorialStep].title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">{tutorialSteps[currentTutorialStep].description}</p>

              <div className="flex items-center justify-center gap-2 mb-6">
                {tutorialSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentTutorialStep ? "bg-blue-600 dark:bg-blue-400" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={skipTutorial}
                  className="flex-1 dark:bg-gray-700 dark:text-white bg-transparent"
                >
                  Skip
                </Button>
                <Button onClick={nextTutorialStep} className="flex-1">
                  {currentTutorialStep === tutorialSteps.length - 1 ? "Start Playing!" : "Next"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

        </div>
    )
}