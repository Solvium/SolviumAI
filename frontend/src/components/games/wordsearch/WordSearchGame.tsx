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
        </div>
    )
}