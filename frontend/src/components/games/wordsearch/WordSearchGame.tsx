"use client";

import React from "react";

import type { ReactElement } from "react";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
} from "lucide-react";

// Types
interface GridCell {
  letter: string;
  isPartOfWord: boolean;
  foundWordIds: number[];
  isHighlighted: boolean;
  isSelected: boolean;
}

interface WordToFind {
  id: number;
  word: string;
  found: boolean;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  direction: "horizontal" | "vertical" | "diagonal-down" | "diagonal-up";
  isReversed: boolean;
}

type WordDifficulty = "easy" | "medium" | "hard";

interface GameStats {
  level: number;
  difficulty: WordDifficulty;
  puzzle: number;
  score: number;
  totalScore: number;
  hintsUsed: number;
  hintsRemaining: number;
  purchasedHints: number;
  points: number;
  tokens: number;
  badges: string[];
  completedPuzzles: Set<string>;
  perfectSolves: number;
  speedBonuses: number;
  currentStreak: number;
  wordsFound: number;
}

interface PuzzleData {
  id: string;
  title: string;
  theme: string;
  grid: GridCell[][];
  words: WordToFind[];
  gridSize: number;
  basePoints: number;
}

interface TutorialStep {
  id: number;
  title: string;
  description: string;
  target?: string;
  action?: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Sound effects class
class SoundManager {
  private audioContext: AudioContext | null = null;
  private sounds: { [key: string]: AudioBuffer } = {};
  private isEnabled = true;
  private volume = 0.3;

  constructor() {
    this.initializeAudioContext();
  }

  private async initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      await this.generateSounds();
    } catch (error) {
      console.warn("Audio not supported:", error);
    }
  }

  private async generateSounds() {
    if (!this.audioContext) return;

    // Generate different sound effects
    this.sounds.wordFound = this.createWordFoundSound();
    this.sounds.puzzleComplete = this.createPuzzleCompleteSound();
    this.sounds.tick = this.createTickSound();
    this.sounds.swipe = this.createSwipeSound();
    this.sounds.hint = this.createHintSound();
    this.sounds.error = this.createErrorSound();
    this.sounds.button = this.createButtonSound();
    this.sounds.selection = this.createSelectionSound();
    this.sounds.speedBonus = this.createSpeedBonusSound();
  }

  private createWordFoundSound(): AudioBuffer {
    if (!this.audioContext)
      return new AudioBuffer({ length: 1, sampleRate: 44100 });

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.3;
    const buffer = this.audioContext.createBuffer(
      1,
      sampleRate * duration,
      sampleRate
    );
    const data = buffer.getChannelData(0);

    // Create a pleasant ascending chord
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 3);

      const freq1 = 523.25; // C5
      const freq2 = 659.25; // E5
      const freq3 = 783.99; // G5

      data[i] =
        envelope *
        0.3 *
        (Math.sin(2 * Math.PI * freq1 * t) +
          Math.sin(2 * Math.PI * freq2 * t) * 0.7 +
          Math.sin(2 * Math.PI * freq3 * t) * 0.5);
    }

    return buffer;
  }

  private createPuzzleCompleteSound(): AudioBuffer {
    if (!this.audioContext)
      return new AudioBuffer({ length: 1, sampleRate: 44100 });

    const sampleRate = this.audioContext.sampleRate;
    const duration = 1.0;
    const buffer = this.audioContext.createBuffer(
      1,
      sampleRate * duration,
      sampleRate
    );
    const data = buffer.getChannelData(0);

    // Victory fanfare
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.floor(t * 4);
      const envelope = Math.exp(-t * 2) * (1 - t * 0.5);

      if (noteIndex < notes.length) {
        data[i] = envelope * 0.4 * Math.sin(2 * Math.PI * notes[noteIndex] * t);
      }
    }

    return buffer;
  }

  private createTickSound(): AudioBuffer {
    if (!this.audioContext)
      return new AudioBuffer({ length: 1, sampleRate: 44100 });

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.1;
    const buffer = this.audioContext.createBuffer(
      1,
      sampleRate * duration,
      sampleRate
    );
    const data = buffer.getChannelData(0);

    // Short tick sound
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 50);
      data[i] = envelope * 0.2 * Math.sin(2 * Math.PI * 800 * t);
    }

    return buffer;
  }

  private createSwipeSound(): AudioBuffer {
    if (!this.audioContext)
      return new AudioBuffer({ length: 1, sampleRate: 44100 });

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.2;
    const buffer = this.audioContext.createBuffer(
      1,
      sampleRate * duration,
      sampleRate
    );
    const data = buffer.getChannelData(0);

    // Swoosh sound
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 8);
      const frequency = 400 + t * 200;
      data[i] = envelope * 0.15 * Math.sin(2 * Math.PI * frequency * t);
    }

    return buffer;
  }

  private createHintSound(): AudioBuffer {
    if (!this.audioContext)
      return new AudioBuffer({ length: 1, sampleRate: 44100 });

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.4;
    const buffer = this.audioContext.createBuffer(
      1,
      sampleRate * duration,
      sampleRate
    );
    const data = buffer.getChannelData(0);

    // Magical hint sound
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 4);
      const frequency = 440 + Math.sin(t * 10) * 100;
      data[i] = envelope * 0.25 * Math.sin(2 * Math.PI * frequency * t);
    }

    return buffer;
  }

  private createErrorSound(): AudioBuffer {
    if (!this.audioContext)
      return new AudioBuffer({ length: 1, sampleRate: 44100 });

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.3;
    const buffer = this.audioContext.createBuffer(
      1,
      sampleRate * duration,
      sampleRate
    );
    const data = buffer.getChannelData(0);

    // Error buzz
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 5);
      data[i] = envelope * 0.2 * Math.sin(2 * Math.PI * 150 * t);
    }

    return buffer;
  }

  private createButtonSound(): AudioBuffer {
    if (!this.audioContext)
      return new AudioBuffer({ length: 1, sampleRate: 44100 });

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.1;
    const buffer = this.audioContext.createBuffer(
      1,
      sampleRate * duration,
      sampleRate
    );
    const data = buffer.getChannelData(0);

    // Button click
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 30);
      data[i] = envelope * 0.15 * Math.sin(2 * Math.PI * 1000 * t);
    }

    return buffer;
  }

  private createSelectionSound(): AudioBuffer {
    if (!this.audioContext)
      return new AudioBuffer({ length: 1, sampleRate: 44100 });

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.05;
    const buffer = this.audioContext.createBuffer(
      1,
      sampleRate * duration,
      sampleRate
    );
    const data = buffer.getChannelData(0);

    // Soft selection sound
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 20);
      data[i] = envelope * 0.1 * Math.sin(2 * Math.PI * 600 * t);
    }

    return buffer;
  }

  private createSpeedBonusSound(): AudioBuffer {
    if (!this.audioContext)
      return new AudioBuffer({ length: 1, sampleRate: 44100 });

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.6;
    const buffer = this.audioContext.createBuffer(
      1,
      sampleRate * duration,
      sampleRate
    );
    const data = buffer.getChannelData(0);

    // Speed bonus celebration
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 3);
      const frequency = 880 + Math.sin(t * 15) * 200;
      data[i] = envelope * 0.3 * Math.sin(2 * Math.PI * frequency * t);
    }

    return buffer;
  }

  async playSound(soundName: string) {
    if (!this.audioContext || !this.isEnabled || !this.sounds[soundName])
      return;

    try {
      // Resume audio context if suspended (required by some browsers)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = this.sounds[soundName];
      gainNode.gain.value = this.volume;

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start();
    } catch (error) {
      console.warn("Error playing sound:", error);
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  isAudioEnabled(): boolean {
    return this.isEnabled;
  }
}

// Tutorial steps
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
    description:
      "Words are hidden in the grid horizontally, vertically, and diagonally.",
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
    description:
      "Swipe left/right to change difficulty, up/down to change levels.",
    icon: ArrowUp,
  },
  {
    id: 7,
    title: "Ready to Play!",
    description: "You're all set! Have fun finding words!",
    icon: Zap,
  },
];

// Word themes
const wordThemes: Record<
  number,
  Record<WordDifficulty, { theme: string; words: string[] }>
> = {
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
};

// Generate word search (same logic as before)
const generateWordSearch = (
  words: string[],
  gridSize: number,
  difficulty: WordDifficulty
): PuzzleData => {
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
        }))
    );

  const wordsToFind: WordToFind[] = [];
  const directions = ["horizontal", "vertical", "diagonal-down", "diagonal-up"];

  words.forEach((word, index) => {
    let placed = false;
    let attempts = 0;
    const maxAttempts = 50;

    while (!placed && attempts < maxAttempts) {
      const direction =
        directions[Math.floor(Math.random() * directions.length)];
      const isReversed = Math.random() < 0.2;
      const wordToPlace = isReversed ? word.split("").reverse().join("") : word;

      let startRow, startCol, endRow, endCol;
      let canPlace = true;

      switch (direction) {
        case "horizontal":
          startRow = Math.floor(Math.random() * gridSize);
          startCol = Math.floor(
            Math.random() * (gridSize - wordToPlace.length + 1)
          );
          endRow = startRow;
          endCol = startCol + wordToPlace.length - 1;
          break;
        case "vertical":
          startRow = Math.floor(
            Math.random() * (gridSize - wordToPlace.length + 1)
          );
          startCol = Math.floor(Math.random() * gridSize);
          endRow = startRow + wordToPlace.length - 1;
          endCol = startCol;
          break;
        case "diagonal-down":
          startRow = Math.floor(
            Math.random() * (gridSize - wordToPlace.length + 1)
          );
          startCol = Math.floor(
            Math.random() * (gridSize - wordToPlace.length + 1)
          );
          endRow = startRow + wordToPlace.length - 1;
          endCol = startCol + wordToPlace.length - 1;
          break;
        case "diagonal-up":
          startRow =
            Math.floor(Math.random() * (gridSize - wordToPlace.length + 1)) +
            wordToPlace.length -
            1;
          startCol = Math.floor(
            Math.random() * (gridSize - wordToPlace.length + 1)
          );
          endRow = startRow - wordToPlace.length + 1;
          endCol = startCol + wordToPlace.length - 1;
          break;
        default:
          continue;
      }

      for (let i = 0; i < wordToPlace.length; i++) {
        let row: number = 0;
        let col: number = 0;
        switch (direction) {
          case "horizontal":
            row = startRow;
            col = startCol + i;
            break;
          case "vertical":
            row = startRow + i;
            col = startCol;
            break;
          case "diagonal-down":
            row = startRow + i;
            col = startCol + i;
            break;
          case "diagonal-up":
            row = startRow - i;
            col = startCol + i;
            break;
          default:
            canPlace = false;
            break;
        }

        if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
          canPlace = false;
          break;
        }

        if (grid[row][col].letter && grid[row][col].letter !== wordToPlace[i]) {
          canPlace = false;
          break;
        }
      }

      if (canPlace) {
        for (let i = 0; i < wordToPlace.length; i++) {
          let row: number = 0;
          let col: number = 0;
          switch (direction) {
            case "horizontal":
              row = startRow;
              col = startCol + i;
              break;
            case "vertical":
              row = startRow + i;
              col = startCol;
              break;
            case "diagonal-down":
              row = startRow + i;
              col = startCol + i;
              break;
            case "diagonal-up":
              row = startRow - i;
              col = startCol + i;
              break;
          }

          grid[row][col].letter = wordToPlace[i];
          grid[row][col].isPartOfWord = true;
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
        });

        placed = true;
      }

      attempts++;
    }
  });

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (!grid[row][col].letter) {
        grid[row][col].letter =
          alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    }
  }

  const difficultyPoints: Record<WordDifficulty, number> = {
    easy: 100,
    medium: 200,
    hard: 300,
  };

  return {
    id: `${Math.random()}`,
    title: `${wordThemes[1][difficulty].theme} Hunt`,
    theme: wordThemes[1][difficulty].theme,
    grid,
    words: wordsToFind,
    gridSize,
    basePoints: difficultyPoints[difficulty],
  };
};

export default function MobileWordSearchGame(): ReactElement {
  // Game state
  const [gameStats, setGameStats] = useState<GameStats>({
    level: 1,
    difficulty: "easy",
    puzzle: 0,
    score: 0,
    totalScore: 0,
    hintsUsed: 0,
    hintsRemaining: 3,
    purchasedHints: 0,
    points: 2000,
    tokens: 0,
    badges: [],
    completedPuzzles: new Set(),
    perfectSolves: 0,
    speedBonuses: 0,
    currentStreak: 0,
    wordsFound: 0,
  });

  // UI state
  const [currentPuzzle, setCurrentPuzzle] = useState<PuzzleData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isGameActive, setIsGameActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showHintDialog, setShowHintDialog] = useState(false);
  const [showWordsSheet, setShowWordsSheet] = useState(false);
  const [completionStats, setCompletionStats] = useState<any>(null);

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Sound state
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const soundManagerRef = useRef<SoundManager | null>(null);

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false);

  // Touch selection state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [currentSelection, setCurrentSelection] = useState<
    { row: number; col: number }[]
  >([]);

  // Swipe state
  const [swipeStart, setSwipeStart] = useState<{
    x: number;
    y: number;
    time: number;
  } | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState("");

  const gridRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize sound manager
  useEffect(() => {
    soundManagerRef.current = new SoundManager();

    // Load sound preferences
    const savedSoundEnabled = localStorage.getItem("wordHunt_soundEnabled");
    if (savedSoundEnabled !== null) {
      const enabled = JSON.parse(savedSoundEnabled);
      setIsSoundEnabled(enabled);
      soundManagerRef.current.setEnabled(enabled);
    }
  }, []);

  // Play sound helper
  const playSound = useCallback(
    (soundName: string) => {
      if (soundManagerRef.current && isSoundEnabled) {
        soundManagerRef.current.playSound(soundName);
      }
    },
    [isSoundEnabled]
  );

  // Toggle sound
  const toggleSound = () => {
    const newSoundEnabled = !isSoundEnabled;
    setIsSoundEnabled(newSoundEnabled);
    localStorage.setItem(
      "wordHunt_soundEnabled",
      JSON.stringify(newSoundEnabled)
    );

    if (soundManagerRef.current) {
      soundManagerRef.current.setEnabled(newSoundEnabled);
    }

    // Play test sound when enabling
    if (newSoundEnabled) {
      setTimeout(() => playSound("button"), 100);
    }
  };

  // Load preferences on mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("wordHunt_darkMode");
    const savedTutorial = localStorage.getItem("wordHunt_hasSeenTutorial");

    if (savedDarkMode) {
      setIsDarkMode(JSON.parse(savedDarkMode));
    }

    if (savedTutorial) {
      setHasSeenTutorial(JSON.parse(savedTutorial));
    } else {
      // Show tutorial for first-time users
      setShowTutorial(true);
    }
  }, []);

  // Apply dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("wordHunt_darkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    playSound("button");
  };

  // Tutorial functions
  const nextTutorialStep = () => {
    playSound("button");
    if (currentTutorialStep < tutorialSteps.length - 1) {
      setCurrentTutorialStep(currentTutorialStep + 1);
    } else {
      completeTutorial();
    }
  };

  const skipTutorial = () => {
    playSound("button");
    completeTutorial();
  };

  const completeTutorial = () => {
    setShowTutorial(false);
    setHasSeenTutorial(true);
    localStorage.setItem("wordHunt_hasSeenTutorial", JSON.stringify(true));
    playSound("puzzleComplete");
  };

  // Swipe detection
  const handleSwipeStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setSwipeStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    });
  };

  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (!swipeStart) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    const deltaTime = Date.now() - swipeStart.time;

    // Only process quick swipes
    if (deltaTime > 300) return;

    const minSwipeDistance = 50;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > minSwipeDistance || absY > minSwipeDistance) {
      if (absX > absY) {
        // Horizontal swipe - change difficulty
        if (deltaX > 0) {
          // Swipe right - next difficulty
          swipeDifficulty("next");
        } else {
          // Swipe left - previous difficulty
          swipeDifficulty("prev");
        }
      } else {
        // Vertical swipe - change level
        if (deltaY > 0) {
          // Swipe down - previous level
          swipeLevel("prev");
        } else {
          // Swipe up - next level
          swipeLevel("next");
        }
      }
    }

    setSwipeStart(null);
  };

  const swipeDifficulty = (direction: "next" | "prev") => {
    const difficulties = ["easy", "medium", "hard"];
    const currentIndex = difficulties.indexOf(gameStats.difficulty);

    let newIndex;
    if (direction === "next") {
      newIndex =
        currentIndex === difficulties.length - 1 ? 0 : currentIndex + 1;
    } else {
      newIndex =
        currentIndex === 0 ? difficulties.length - 1 : currentIndex - 1;
    }

    const newDifficulty = difficulties[newIndex] as "easy" | "medium" | "hard";
    setGameStats((prev) => ({ ...prev, difficulty: newDifficulty, puzzle: 0 }));

    // Show swipe hint
    setShowSwipeHint(
      `Switched to ${
        newDifficulty.charAt(0).toUpperCase() + newDifficulty.slice(1)
      }`
    );
    setTimeout(() => setShowSwipeHint(""), 1500);

    // Play swipe sound
    playSound("swipe");

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const swipeLevel = (direction: "next" | "prev") => {
    const maxLevel = 2; // Based on available themes
    let newLevel;

    if (direction === "next") {
      newLevel = gameStats.level === maxLevel ? 1 : gameStats.level + 1;
    } else {
      newLevel = gameStats.level === 1 ? maxLevel : gameStats.level - 1;
    }

    setGameStats((prev) => ({ ...prev, level: newLevel, puzzle: 0 }));

    // Show swipe hint
    setShowSwipeHint(`Level ${newLevel}`);
    setTimeout(() => setShowSwipeHint(""), 1500);

    // Play swipe sound
    playSound("swipe");

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  // Calculate timer
  const calculateTimer = useCallback(
    (level: number, difficulty: WordDifficulty): number => {
      const baseTimes: Record<WordDifficulty, number> = {
        easy: 90,
        medium: 120,
        hard: 180,
      };
      const scalingFactor = 1 + (level - 1) * 0.1;
      return Math.round(baseTimes[difficulty] * scalingFactor);
    },
    []
  );

  // Initialize puzzle
  const initializePuzzle = useCallback(() => {
    const themeData = wordThemes[gameStats.level]?.[gameStats.difficulty];
    if (!themeData) return;

    const gridSizes: Record<WordDifficulty, number> = {
      easy: 8,
      medium: 10,
      hard: 12,
    };
    const gridSize = gridSizes[gameStats.difficulty];

    const puzzle = generateWordSearch(
      themeData.words,
      gridSize,
      gameStats.difficulty
    );
    puzzle.title = `${themeData.theme} Hunt`;
    puzzle.theme = themeData.theme;

    setCurrentPuzzle(puzzle);
    setTimeRemaining(calculateTimer(gameStats.level, gameStats.difficulty));
    setIsGameActive(true);
    setIsPaused(false);
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setCurrentSelection([]);

    // Play puzzle start sound
    playSound("button");
  }, [gameStats.level, gameStats.difficulty, calculateTimer, playSound]);

  // Timer effect with tick sound
  useEffect(() => {
    if (isGameActive && !isPaused && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1;
          // Play tick sound for last 10 seconds
          if (newTime <= 10 && newTime > 0) {
            playSound("tick");
          }
          return newTime;
        });
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && isGameActive) {
      setIsGameActive(false);
      handleGameTimeout();
    }
  }, [timeRemaining, isGameActive, isPaused, playSound]);

  // Handle game timeout
  const handleGameTimeout = () => {
    playSound("error");
    setShowCompletionDialog(true);
    setCompletionStats({
      completed: false,
      timeUsed: calculateTimer(gameStats.level, gameStats.difficulty),
      score: 0,
      multiplier: 0,
      wordsFound: currentPuzzle?.words.filter((w) => w.found).length || 0,
      totalWords: currentPuzzle?.words.length || 0,
    });
  };

  // Get cells in selection line
  const getCellsInLine = useCallback(
    (
      start: { row: number; col: number },
      end: { row: number; col: number }
    ) => {
      const cells: { row: number; col: number }[] = [];
      const deltaRow = end.row - start.row;
      const deltaCol = end.col - start.col;
      const distance = Math.max(Math.abs(deltaRow), Math.abs(deltaCol));

      if (distance === 0) {
        return [start];
      }

      const isHorizontal = deltaRow === 0;
      const isVertical = deltaCol === 0;
      const isDiagonal = Math.abs(deltaRow) === Math.abs(deltaCol);

      if (!isHorizontal && !isVertical && !isDiagonal) {
        return [];
      }

      const stepRow = deltaRow === 0 ? 0 : deltaRow / Math.abs(deltaRow);
      const stepCol = deltaCol === 0 ? 0 : deltaCol / Math.abs(deltaCol);

      for (let i = 0; i <= distance; i++) {
        cells.push({
          row: start.row + i * stepRow,
          col: start.col + i * stepCol,
        });
      }

      return cells;
    },
    []
  );

  // Touch handlers
  const handleTouchStart = (row: number, col: number, e: React.TouchEvent) => {
    e.preventDefault();
    if (!isGameActive || isPaused) return;

    setIsSelecting(true);
    setSelectionStart({ row, col });
    setSelectionEnd({ row, col });
    setCurrentSelection([{ row, col }]);

    // Play selection sound
    playSound("selection");

    if (currentPuzzle) {
      const newPuzzle = { ...currentPuzzle };
      newPuzzle.grid.forEach((gridRow) =>
        gridRow.forEach((cell) => {
          cell.isSelected = false;
        })
      );
      newPuzzle.grid[row][col].isSelected = true;
      setCurrentPuzzle(newPuzzle);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!isSelecting || !selectionStart || !currentPuzzle || !gridRef.current)
      return;

    const touch = e.touches[0];
    const rect = gridRef.current.getBoundingClientRect();
    const cellSize = rect.width / currentPuzzle.gridSize;

    const col = Math.floor((touch.clientX - rect.left) / cellSize);
    const row = Math.floor((touch.clientY - rect.top) / cellSize);

    if (
      row >= 0 &&
      row < currentPuzzle.gridSize &&
      col >= 0 &&
      col < currentPuzzle.gridSize
    ) {
      setSelectionEnd({ row, col });
      const cells = getCellsInLine(selectionStart, { row, col });
      setCurrentSelection(cells);

      const newPuzzle = { ...currentPuzzle };
      newPuzzle.grid.forEach((gridRow) =>
        gridRow.forEach((cell) => {
          cell.isSelected = false;
        })
      );

      cells.forEach((cell) => {
        if (newPuzzle.grid[cell.row] && newPuzzle.grid[cell.row][cell.col]) {
          newPuzzle.grid[cell.row][cell.col].isSelected = true;
        }
      });

      setCurrentPuzzle(newPuzzle);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!isSelecting || !currentPuzzle || !selectionStart || !selectionEnd)
      return;

    setIsSelecting(false);

    const selectedText = currentSelection
      .map((cell) => currentPuzzle.grid[cell.row]?.[cell.col]?.letter || "")
      .join("");
    const reversedText = selectedText.split("").reverse().join("");

    let foundWord: WordToFind | null = null;

    for (const word of currentPuzzle.words) {
      if (
        !word.found &&
        (word.word === selectedText || word.word === reversedText)
      ) {
        foundWord = word;
        break;
      }
    }

    if (foundWord) {
      const newPuzzle = { ...currentPuzzle };
      const wordIndex = newPuzzle.words.findIndex(
        (w) => w.id === foundWord!.id
      );
      newPuzzle.words[wordIndex].found = true;

      currentSelection.forEach((cell) => {
        if (newPuzzle.grid[cell.row] && newPuzzle.grid[cell.row][cell.col]) {
          newPuzzle.grid[cell.row][cell.col].foundWordIds.push(foundWord!.id);
          newPuzzle.grid[cell.row][cell.col].isHighlighted = true;
        }
      });

      setCurrentPuzzle(newPuzzle);
      setGameStats((prev) => ({ ...prev, wordsFound: prev.wordsFound + 1 }));

      // Play word found sound
      playSound("wordFound");

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }

      if (newPuzzle.words.every((w) => w.found)) {
        setIsGameActive(false);
        handlePuzzleCompletion();
      }
    } else {
      // Play error sound for invalid selection
      if (currentSelection.length > 1) {
        playSound("error");
      }
    }

    // Clear selection
    const newPuzzle = { ...currentPuzzle };
    newPuzzle.grid.forEach((gridRow) =>
      gridRow.forEach((cell) => {
        cell.isSelected = false;
      })
    );
    setCurrentPuzzle(newPuzzle);

    setSelectionStart(null);
    setSelectionEnd(null);
    setCurrentSelection([]);
  };

  // Handle puzzle completion
  const handlePuzzleCompletion = useCallback(() => {
    const totalTime = calculateTimer(gameStats.level, gameStats.difficulty);
    const timeUsed = totalTime - timeRemaining;
    const timePercentage = timeUsed / totalTime;

    let multiplier = 1;
    if (timePercentage < 0.5) multiplier = 3;
    else if (timePercentage < 0.7) multiplier = 2;

    const basePoints = currentPuzzle?.basePoints || 100;
    const score = basePoints * multiplier;
    const isSpeedBonus = multiplier === 3;
    const isPerfect = gameStats.hintsUsed === 0;

    setCompletionStats({
      completed: true,
      timeUsed,
      score,
      multiplier,
      isSpeedBonus,
      isPerfect,
      wordsFound: currentPuzzle?.words.length || 0,
      totalWords: currentPuzzle?.words.length || 0,
    });

    setGameStats((prev) => ({
      ...prev,
      score,
      totalScore: prev.totalScore + score,
      points: prev.points + score,
      speedBonuses: isSpeedBonus ? prev.speedBonuses + 1 : prev.speedBonuses,
      perfectSolves: isPerfect ? prev.perfectSolves + 1 : prev.perfectSolves,
      completedPuzzles: new Set([
        ...prev.completedPuzzles,
        currentPuzzle?.id || "",
      ]),
    }));

    setShowCompletionDialog(true);

    // Play completion sound
    if (isSpeedBonus) {
      playSound("speedBonus");
    } else {
      playSound("puzzleComplete");
    }

    // Celebration haptic
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
  }, [
    calculateTimer,
    currentPuzzle?.basePoints,
    gameStats.hintsUsed,
    gameStats.level,
    gameStats.difficulty,
    playSound,
    setGameStats,
    setShowCompletionDialog,
    timeRemaining,
  ]);

  // Use hint
  const applyHint = useCallback(
    (type: "reveal" | "highlight") => {
      if (!currentPuzzle) return;
      if (gameStats.hintsRemaining + gameStats.purchasedHints <= 0) return;

      const costs = { reveal: 200, highlight: 100 };

      if (gameStats.hintsRemaining > 0) {
        setGameStats((prev) => ({
          ...prev,
          hintsRemaining: prev.hintsRemaining - 1,
          hintsUsed: prev.hintsUsed + 1,
        }));
      } else {
        setGameStats((prev) => ({
          ...prev,
          purchasedHints: prev.purchasedHints - 1,
          points: prev.points - costs[type],
          hintsUsed: prev.hintsUsed + 1,
        }));
      }

      const newPuzzle = { ...currentPuzzle };
      const unFoundWords = newPuzzle.words.filter((w) => !w.found);

      if (unFoundWords.length === 0) return;

      const randomWord =
        unFoundWords[Math.floor(Math.random() * unFoundWords.length)];

      if (type === "reveal") {
        const wordIndex = newPuzzle.words.findIndex(
          (w) => w.id === randomWord.id
        );
        newPuzzle.words[wordIndex].found = true;

        const cells = getCellsInLine(
          { row: randomWord.startRow, col: randomWord.startCol },
          { row: randomWord.endRow, col: randomWord.endCol }
        );

        cells.forEach((cell) => {
          if (newPuzzle.grid[cell.row] && newPuzzle.grid[cell.row][cell.col]) {
            newPuzzle.grid[cell.row][cell.col].foundWordIds.push(randomWord.id);
            newPuzzle.grid[cell.row][cell.col].isHighlighted = true;
          }
        });

        setGameStats((prev) => ({ ...prev, wordsFound: prev.wordsFound + 1 }));
        playSound("wordFound");
      } else if (type === "highlight") {
        const cells = getCellsInLine(
          { row: randomWord.startRow, col: randomWord.startCol },
          { row: randomWord.endRow, col: randomWord.endCol }
        );

        cells.forEach((cell) => {
          if (newPuzzle.grid[cell.row] && newPuzzle.grid[cell.row][cell.col]) {
            newPuzzle.grid[cell.row][cell.col].isSelected = true;
          }
        });

        setTimeout(() => {
          const tempPuzzle = { ...newPuzzle };
          cells.forEach((cell) => {
            if (
              tempPuzzle.grid[cell.row] &&
              tempPuzzle.grid[cell.row][cell.col]
            ) {
              tempPuzzle.grid[cell.row][cell.col].isSelected = false;
            }
          });
          setCurrentPuzzle(tempPuzzle);
        }, 2000);
      }

      // Play hint sound
      playSound("hint");

      setCurrentPuzzle(newPuzzle);

      if (newPuzzle.words.every((w) => w.found)) {
        setIsGameActive(false);
        handlePuzzleCompletion();
      }

      setShowHintDialog(false);
    },
    [
      currentPuzzle,
      gameStats.hintsRemaining,
      gameStats.purchasedHints,
      setGameStats,
      playSound,
      getCellsInLine,
      handlePuzzleCompletion,
      setShowHintDialog,
    ]
  );

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Initialize first puzzle
  useEffect(() => {
    initializePuzzle();
  }, [initializePuzzle]);

  if (!currentPuzzle) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading puzzle...</p>
        </div>
      </div>
    );
  }

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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => playSound("button")}
                >
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
                      setShowTutorial(true);
                      playSound("button");
                    }}
                  >
                    <Target className="w-4 h-4 mr-2" />
                    Tutorial
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start dark:text-gray-300"
                    onClick={toggleDarkMode}
                  >
                    {isDarkMode ? (
                      <Sun className="w-4 h-4 mr-2" />
                    ) : (
                      <Moon className="w-4 h-4 mr-2" />
                    )}
                    {isDarkMode ? "Light Mode" : "Dark Mode"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start dark:text-gray-300"
                    onClick={toggleSound}
                  >
                    {isSoundEnabled ? (
                      <Volume2 className="w-4 h-4 mr-2" />
                    ) : (
                      <VolumeX className="w-4 h-4 mr-2" />
                    )}
                    {isSoundEnabled ? "Sound On" : "Sound Off"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                Word Hunt
              </h1>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {currentPuzzle.theme}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleSound}>
              {isSoundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleDarkMode}>
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsPaused(!isPaused);
                playSound("button");
              }}
              disabled={!isGameActive}
            >
              {isPaused ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Stats Bar */}
      <div className="px-4 py-3 bg-white/50 dark:bg-gray-800/50 transition-colors duration-300">
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {gameStats.level}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Level
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {gameStats.totalScore.toLocaleString()}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Score
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {gameStats.hintsRemaining + gameStats.purchasedHints}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Hints
            </div>
          </div>
          <div className="text-center" id="timer">
            <div
              className={`text-lg font-bold font-mono ${
                timeRemaining < 30
                  ? "text-red-600 dark:text-red-400"
                  : "text-indigo-600 dark:text-indigo-400"
              }`}
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
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Progress
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {currentPuzzle.words.filter((w) => w.found).length}/
            {currentPuzzle.words.length}
          </span>
        </div>
        <Progress
          value={
            (currentPuzzle.words.filter((w) => w.found).length /
              currentPuzzle.words.length) *
            100
          }
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
                setGameStats((prev) => ({
                  ...prev,
                  difficulty: diff as "easy" | "medium" | "hard",
                  puzzle: 0,
                }));
                playSound("button");
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
                      onTouchStart={(e) =>
                        handleTouchStart(rowIndex, colIndex, e)
                      }
                      style={{ minHeight: "28px", fontSize: "12px" }}
                    >
                      {cell.letter}
                    </div>
                  ))
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
              Words to Find (
              {currentPuzzle.words.filter((w) => !w.found).length} remaining)
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
                    setShowWordsSheet(false);
                    playSound("button");
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
                    <span
                      className={`font-medium ${
                        word.found ? "line-through" : ""
                      }`}
                    >
                      {word.word}
                    </span>
                    {word.found && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
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
              setShowHintDialog(true);
              playSound("button");
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
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {tutorialSteps[currentTutorialStep].description}
              </p>

              <div className="flex items-center justify-center gap-2 mb-6">
                {tutorialSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentTutorialStep
                        ? "bg-blue-600 dark:bg-blue-400"
                        : "bg-gray-300 dark:bg-gray-600"
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
                  {currentTutorialStep === tutorialSteps.length - 1
                    ? "Start Playing!"
                    : "Next"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Hint Dialog */}
      <Dialog open={showHintDialog} onOpenChange={setShowHintDialog}>
        <DialogContent className="w-[90vw] max-w-md dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">
              Choose Your Hint
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Remaining words:{" "}
              <strong>
                {currentPuzzle.words.filter((w) => !w.found).length}
              </strong>
            </p>

            <div className="space-y-3">
              <Button
                onClick={() => applyHint("highlight")}
                className="w-full h-16 justify-start dark:bg-gray-700 dark:text-white"
                variant="outline"
              >
                <div className="text-left">
                  <div className="font-semibold">
                    Highlight Word - 100 points
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Briefly show a word location
                  </div>
                </div>
              </Button>

              <Button
                onClick={() => applyHint("reveal")}
                className="w-full h-16 justify-start dark:bg-gray-700 dark:text-white"
                variant="outline"
              >
                <div className="text-left">
                  <div className="font-semibold">Reveal Word - 200 points</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Completely reveal a random word
                  </div>
                </div>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Completion Dialog */}
      <Dialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
      >
        <DialogContent className="w-[90vw] max-w-md dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="text-center text-xl dark:text-white">
              {completionStats?.completed
                ? "🎉 Puzzle Complete!"
                : "⏰ Time's Up!"}
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            {completionStats?.completed && (
              <>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {completionStats.score.toLocaleString()} Points
                </div>
                <div className="space-y-2">
                  <div className="text-lg dark:text-white">
                    Multiplier:{" "}
                    <span className="font-bold">
                      ×{completionStats.multiplier}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Time: {formatTime(completionStats.timeUsed)}
                  </div>
                  {completionStats.isSpeedBonus && (
                    <Badge className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                      <Zap className="w-3 h-3 mr-1" />
                      Speed Bonus!
                    </Badge>
                  )}
                  {completionStats.isPerfect && (
                    <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                      <Trophy className="w-3 h-3 mr-1" />
                      Perfect Solve!
                    </Badge>
                  )}
                </div>
              </>
            )}

            {!completionStats?.completed && (
              <div className="space-y-2">
                <div className="text-lg text-gray-600 dark:text-gray-400">
                  Better luck next time!
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Words Found: {completionStats?.wordsFound || 0}/
                  {completionStats?.totalWords || 0}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setGameStats((prev) => ({
                    ...prev,
                    puzzle: prev.puzzle + 1,
                  }));
                  setShowCompletionDialog(false);
                  playSound("button");
                }}
                className="flex-1"
              >
                Next Puzzle
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  initializePuzzle();
                  setShowCompletionDialog(false);
                }}
                className="flex-1 dark:bg-gray-700 dark:text-white"
              >
                Replay
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
