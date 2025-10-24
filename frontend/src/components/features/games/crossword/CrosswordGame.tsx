"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";

interface CrosswordGameProps {
  onClose?: () => void;
}

interface LetterCell {
  letter: string;
  isCorrect: boolean;
  isSelected: boolean;
  row: number;
  col: number;
}

const CrosswordGame: React.FC<CrosswordGameProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [gameStarted, setGameStarted] = useState(false);
  const [level, setLevel] = useState(3);
  const [timer, setTimer] = useState(60);
  const [coins, setCoins] = useState(10);
  const [hintCost] = useState(5);
  
  // Game state
  const [grid, setGrid] = useState<LetterCell[][]>([]);
  const [selectedCells, setSelectedCells] = useState<LetterCell[]>([]);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [wordsToFind, setWordsToFind] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showLevelCompleteModal, setShowLevelCompleteModal] = useState(false);
  const [showTimeUpModal, setShowTimeUpModal] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [timeBonus, setTimeBonus] = useState(0);

  // Sample words for the game (in production, fetch from API)
  const gameWords = [
    { word: "WORD", direction: "horizontal", startRow: 0, startCol: 0 },
    { word: "MEAN", direction: "diagonal", startRow: 0, startCol: 0 },
    { word: "NEAR", direction: "horizontal", startRow: 3, startCol: 1 },
  ];

  // Timer countdown
  useEffect(() => {
    if (gameStarted && timer > 0 && foundWords.length < wordsToFind.length) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameStarted, timer, foundWords.length, wordsToFind.length]);

  const handleTimeUp = () => {
    setShowTimeUpModal(true);
  };

  const handleTryAgain = () => {
    setShowTimeUpModal(false);
    initializeGame();
  };

  const handleNextLevel = () => {
    setShowLevelCompleteModal(false);
    setLevel(prev => prev + 1);
    initializeGame();
  };

  // Initialize game grid
  const initializeGame = () => {
    const gridSize = 8;
    const newGrid: LetterCell[][] = [];
    
    // Create empty grid
    for (let i = 0; i < gridSize; i++) {
      const row: LetterCell[] = [];
      for (let j = 0; j < gridSize; j++) {
        row.push({
          letter: "",
          isCorrect: false,
          isSelected: false,
          row: i,
          col: j,
        });
      }
      newGrid.push(row);
    }

    // Place words in grid
    const words: string[] = [];
    gameWords.forEach(({ word, direction, startRow, startCol }) => {
      words.push(word);
      for (let i = 0; i < word.length; i++) {
        if (direction === "horizontal") {
          newGrid[startRow][startCol + i].letter = word[i];
        } else if (direction === "vertical") {
          newGrid[startRow + i][startCol].letter = word[i];
        } else if (direction === "diagonal") {
          newGrid[startRow + i][startCol + i].letter = word[i];
        }
      }
    });

    // Fill empty cells with random letters
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (!newGrid[i][j].letter) {
          newGrid[i][j].letter = alphabet[Math.floor(Math.random() * alphabet.length)];
        }
      }
    }

    setGrid(newGrid);
    setWordsToFind(words);
    setFoundWords([]);
    setTimer(60);
  };

  const handleStartGame = () => {
    setGameStarted(true);
    setShowInstructions(false);
    initializeGame();
  };

  const handleCellMouseDown = (cell: LetterCell) => {
    setIsDragging(true);
    setSelectedCells([cell]);
    updateCellSelection([cell]);
  };

  const handleCellMouseEnter = (cell: LetterCell) => {
    if (isDragging) {
      const newSelection = [...selectedCells, cell];
      setSelectedCells(newSelection);
      updateCellSelection(newSelection);
    }
  };

  const handleCellMouseUp = () => {
    setIsDragging(false);
    checkWord();
    clearSelection();
  };

  const updateCellSelection = (cells: LetterCell[]) => {
    const newGrid = grid.map(row =>
      row.map(cell => ({
        ...cell,
        isSelected: cells.some(c => c.row === cell.row && c.col === cell.col),
      }))
    );
    setGrid(newGrid);
  };

  const clearSelection = () => {
    setSelectedCells([]);
    const newGrid = grid.map(row =>
      row.map(cell => ({
        ...cell,
        isSelected: false,
      }))
    );
    setGrid(newGrid);
  };

  const checkWord = () => {
    const selectedWord = selectedCells.map(cell => cell.letter).join("");
    const reversedWord = selectedWord.split("").reverse().join("");

    if (wordsToFind.includes(selectedWord) && !foundWords.includes(selectedWord)) {
      handleCorrectWord(selectedWord);
    } else if (wordsToFind.includes(reversedWord) && !foundWords.includes(reversedWord)) {
      handleCorrectWord(reversedWord);
    }
  };

  const handleCorrectWord = (word: string) => {
    setFoundWords([...foundWords, word]);
    
    // Mark cells as correct
    const newGrid = grid.map(row =>
      row.map(cell => ({
        ...cell,
        isCorrect: selectedCells.some(c => c.row === cell.row && c.col === cell.col) || cell.isCorrect,
      }))
    );
    setGrid(newGrid);

    // Calculate rewards
    const coinsEarned = 50;
    const bonus = parseFloat((timer / 60 * 1.5).toFixed(2));
    
    setEarnedPoints(coinsEarned);
    setTimeBonus(bonus);
    setCoins(prev => prev + coinsEarned);
    toast.success(`Correct! +${coinsEarned} coins`);

    // Check if all words found
    if (foundWords.length + 1 === wordsToFind.length) {
      setTimeout(() => {
        setShowLevelCompleteModal(true);
      }, 500);
    }
  };

  const handleUseHint = () => {
    if (coins < hintCost) {
      toast.error("Insufficient coins for hint");
      return;
    }

    setCoins(prev => prev - hintCost);
    toast.success("Hint used! Check the highlighted letters.");
    
    // Highlight first letter of an unfound word
    const unfoundWord = wordsToFind.find(w => !foundWords.includes(w));
    if (unfoundWord) {
      toast.info(`Hint: Look for "${unfoundWord[0]}" to start`);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Instructions screen
  if (!gameStarted && showInstructions) {
    return (
      <div className="min-h-screen w-screen bg-[url('/assets/background/num-genius-bg.svg')] bg-cover bg-center bg-no-repeat relative overflow-hidden">
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute left-2 md:left-4 top-[20%] w-2 h-2 md:w-3 md:h-3 rounded-full bg-pink-500/30 blur-xl animate-pulse" />
          <div className="absolute right-2 md:right-4 top-[40%] w-2 h-2 md:w-3 md:h-3 rounded-full bg-purple-500/30 blur-xl animate-pulse delay-100" />
          <div className="absolute left-2 md:left-4 bottom-[30%] w-2 h-2 md:w-3 md:h-3 rounded-full bg-blue-500/30 blur-xl animate-pulse delay-200" />
          <div className="absolute right-2 md:right-4 bottom-[20%] w-2 h-2 md:w-3 md:h-3 rounded-full bg-pink-500/30 blur-xl animate-pulse delay-300" />
        </div>

        {/* Grid floor effect */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-32 md:h-64 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, rgba(10, 5, 32, 0.4) 50%, rgba(10, 5, 32, 0.7) 100%)',
            backgroundImage: `
              linear-gradient(rgba(147, 51, 234, 0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(147, 51, 234, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            transform: 'perspective(500px) rotateX(60deg)',
            transformOrigin: 'bottom',
          }}
        />

        {/* Back button */}
        {onClose && (
          <div className="absolute top-4 md:top-6 left-3 md:left-6 z-20">
            {/* <button
              onClick={onClose}
              className="flex items-center gap-1 md:gap-2 text-white hover:text-gray-300 transition-colors group"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs md:text-base font-medium">Back</span>
            </button> */}
          </div>
        )}

        {/* Title */}
        <div className="pt-4 md:pt-6 text-center z-20 relative px-4">
          <h1
            className="text-2xl md:text-4xl font-bold text-white tracking-[0.2em] md:tracking-[0.3em]"
            style={{ 
              fontFamily: "'Pixelify Sans', monospace",
              textShadow: '0 0 20px rgba(255, 255, 255, 0.3), 0 0 40px rgba(147, 51, 234, 0.2)'
            }}
          >
            CROSSWORD
          </h1>
        </div>

        {/* Main content */}
        <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-80px)] md:min-h-[calc(100vh-120px)] px-3 md:px-6 py-3 md:py-8">
          <div className="w-full max-w-[420px]">
            {/* Instructions card with gradient border */}
            <div 
              className="relative rounded-[16px] md:rounded-[28px] p-[2px] mb-3 md:mb-6"
              style={{
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.6) 0%, rgba(59, 130, 246, 0.4) 50%, rgba(147, 51, 234, 0.6) 100%)'
              }}
            >
              <div className="bg-[#0a0520] rounded-[14px] md:rounded-[26px] p-3.5 md:p-7">
                {/* How to Play section */}
                <div className="mb-3.5 md:mb-7">
                  <div className="flex items-center gap-2 mb-2.5 md:mb-5">
                    <svg className="w-3.5 h-3.5 md:w-5 md:h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                    <h2 className="text-cyan-400 text-sm md:text-lg font-bold tracking-wide">How to Play</h2>
                  </div>
                  
                  <ul className="space-y-2 md:space-y-3.5">
                    <li className="flex items-start gap-2 text-gray-200 text-[11px] md:text-[15px] leading-relaxed">
                      <span className="text-cyan-400 font-bold mt-0.5">•</span>
                      <span><span className="text-white font-semibold">Drag letters</span> in a straight line or diagonally to form valid words.</span>
                    </li>
                    <li className="flex items-start gap-2 text-gray-200 text-[11px] md:text-[15px] leading-relaxed">
                      <span className="text-cyan-400 font-bold mt-0.5">•</span>
                      <span><span className="text-white font-semibold">Release to submit.</span> Find the hidden word(s) before time runs out (100).</span>
                    </li>
                    <li className="flex items-start gap-2 text-gray-200 text-[11px] md:text-[15px] leading-relaxed">
                      <span className="text-cyan-400 font-bold mt-0.5">•</span>
                      <span>Tap the <span className="text-white font-semibold">💡</span> for a <span className="text-white font-semibold">hint</span> (costs coins).</span>
                    </li>
                  </ul>
                </div>

                {/* Examples section */}
                <div>
                  <div className="flex items-center gap-2 mb-2.5 md:mb-5">
                    <svg className="w-3.5 h-3.5 md:w-5 md:h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <h3 className="text-cyan-400 text-sm md:text-lg font-bold tracking-wide">Examples</h3>
                  </div>

                  {/* Diagonal example */}
                  <div 
                    className="relative rounded-[12px] md:rounded-[18px] p-[1.5px] mb-2 md:mb-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(147, 51, 234, 0.3) 100%)'
                    }}
                  >
                    <div className="bg-gradient-to-br from-[#1a0f3e] to-[#0f0729] rounded-[10.5px] md:rounded-[16.5px] p-2.5 md:p-4">
                      <div className="flex items-center gap-2 mb-1.5 md:mb-2.5">
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <div className="w-4 md:w-6 h-[1.5px] md:h-[2px] bg-purple-400 rounded-full transform rotate-45 origin-left"></div>
                          <span className="text-purple-300 font-bold text-[11px] md:text-sm tracking-wide">Diagonal</span>
                        </div>
                      </div>
                      <div className="text-gray-300 text-[11px] md:text-sm mb-1.5 md:mb-2">
                        Word: <span className="text-cyan-400 font-bold text-[12px] md:text-[15px]">"MEAN"</span>
                      </div>
                      <div className="flex items-center gap-1 md:gap-1.5 text-green-400 text-[10px] md:text-[13px] font-medium">
                        <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>Correct → +50 coins</span>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal example */}
                  <div 
                    className="relative rounded-[12px] md:rounded-[18px] p-[1.5px]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.4) 0%, rgba(245, 158, 11, 0.3) 100%)'
                    }}
                  >
                    <div className="bg-gradient-to-br from-[#1a0f3e] to-[#0f0729] rounded-[10.5px] md:rounded-[16.5px] p-2.5 md:p-4">
                      <div className="flex items-center gap-2 mb-1.5 md:mb-2.5">
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <div className="w-4 md:w-6 h-[1.5px] md:h-[2px] bg-yellow-400 rounded-full"></div>
                          <span className="text-yellow-300 font-bold text-[11px] md:text-sm tracking-wide">Horizontal</span>
                        </div>
                      </div>
                      <div className="text-gray-300 text-[11px] md:text-sm mb-1.5 md:mb-2">
                        Near match detected
                      </div>
                      <div className="flex items-center gap-1 md:gap-1.5 text-yellow-400 text-[10px] md:text-[13px] font-medium">
                        <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>Try a different order</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Start button */}
            <button
              onClick={handleStartGame}
              className="w-full mt-5 bg-[#0074E9] hover:bg-[#0062c7] text-white py-3 md:py-4 text-sm md:text-lg font-bold rounded-[14px] md:rounded-[20px] shadow-lg transform transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                boxShadow: '0 8px 32px rgba(0, 116, 233, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              }}
            >
              Start Playing
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Game screen
  return (
    <div className="min-h-screen w-screen bg-[url('/assets/background/num-genius-bg.svg')] bg-cover bg-center bg-no-repeat relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-4 top-[20%] w-3 h-3 rounded-full bg-pink-500/30 blur-xl animate-pulse" />
        <div className="absolute right-4 top-[40%] w-3 h-3 rounded-full bg-purple-500/30 blur-xl animate-pulse delay-100" />
        <div className="absolute left-4 bottom-[30%] w-3 h-3 rounded-full bg-blue-500/30 blur-xl animate-pulse delay-200" />
        <div className="absolute right-4 bottom-[20%] w-3 h-3 rounded-full bg-pink-500/30 blur-xl animate-pulse delay-300" />
      </div>

      {/* Grid floor effect */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(10, 5, 32, 0.4) 50%, rgba(10, 5, 32, 0.7) 100%)',
          backgroundImage: `
            linear-gradient(rgba(147, 51, 234, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(147, 51, 234, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          transform: 'perspective(500px) rotateX(60deg)',
          transformOrigin: 'bottom',
        }}
      />

      {/* Back button */}
      <div className="absolute top-4 md:top-6 left-3 md:left-6 z-20">
        {/* <button
          onClick={() => {
            setGameStarted(false);
            setShowInstructions(true);
          }}
          className="flex items-center gap-1 md:gap-2 text-white hover:text-gray-300 transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs md:text-base font-medium">Back</span>
        </button> */}
      </div>

      {/* Title */}
      <div className="pt-4 md:pt-6 text-center z-20 relative px-4">
        <h1
          className="text-2xl md:text-4xl font-bold text-white tracking-[0.2em] md:tracking-[0.3em]"
          style={{ 
            fontFamily: "'Pixelify Sans', monospace",
            textShadow: '0 0 20px rgba(255, 255, 255, 0.3), 0 0 40px rgba(147, 51, 234, 0.2)'
          }}
        >
          CROSSWORD
        </h1>
      </div>

      {/* Game content */}
      <div className="relative z-10 flex flex-col items-center px-3 md:px-6 py-3 md:py-6">
        {/* Stats bar - Exactly 3 items */}
        <div className="flex gap-2 md:gap-5 mb-5 md:mb-7 items-center justify-center px-2">
          {/* Level Badge */}
          <div 
            className="relative bg-[#1C97D8] rounded-full p-[2px]"
            // style={{
            //   background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(99, 102, 241, 0.4) 100%)'
            // }}
          >
            <div className="bg-[#0a0520] rounded-full px-4 md:px-6 py-2 md:py-3 flex items-center justify-center">
              <span className="text-[#1C97D8] text-sm md:text-base font-bold whitespace-nowrap">Level {level}</span>
            </div>
          </div>

          {/* Timer - Circular with border */}
          <div 
            className="relative bg-[#00FFFF] rounded-full p-[3px]"
            // style={{
            //   background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.8) 0%, rgba(14, 165, 233, 0.6) 100%)'
            // }}
          >
            <div className="bg-[#0a0520] rounded-full w-14 h-14 md:w-20 md:h-20 flex flex-col items-center justify-center">
              <svg className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-white text-sm md:text-base font-bold leading-none">{formatTime(timer)}</span>
            </div>
          </div>

          {/* Hint Button with Coin Badge */}
          <button
            onClick={handleUseHint}
            className="relative rounded-[12px] p-[1px] transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.6) 0%, rgba(245, 158, 11, 0.4) 100%)'
            }}
          >
            <div className="bg-[#0a0520] rounded-[12px] px-3 md:px-5 py-2 md:py-3 flex items-center gap-2.5 hover:bg-[#1a0f3e] transition-colors">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center">
  <Image
    src="/assets/icons/lightbulb.svg"   // 👈 replace with your image path
    alt="Lightbulb"
    width={18}                           // adjust as needed
    height={18}
    className="w-4 h-4 md:w-5 md:h-5 object-contain"
  />
</span>
                <span className="text-yellow-400 text-sm md:text-base font-bold">Hint</span>
              </div>
              <div className="bg-[#FFD4474D] rounded-[2px] px-2.5 py-1 min-w-[32px] flex items-center justify-center">
                <span className="text-yellow-400 text-xs md:text-sm font-bold">{coins}</span>
              </div>
            </div>
          </button>
        </div>

        {/* Game grid */}
        <div className="w-full max-w-[440px] px-2 md:px-0 mb-6 md:mb-8">
          <div 
            className="grid gap-1.5 md:gap-2 select-none"
            style={{ gridTemplateColumns: `repeat(8, minmax(0, 1fr))` }}
            onMouseLeave={() => {
              if (isDragging) {
                handleCellMouseUp();
              }
            }}
          >
            {grid.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`
                    relative aspect-square flex items-center justify-center text-white font-bold text-sm md:text-xl
                    rounded-[8px] md:rounded-[12px] cursor-pointer transition-all duration-200
                    ${cell.isCorrect 
                      ? 'bg-gradient-to-br from-[#22c55e] to-[#16a34a] border-2 border-[#4ade80] shadow-lg shadow-green-500/40' 
                      : cell.isSelected 
                        ? 'bg-gradient-to-br from-[#06b6d4] to-[#0891b2] border-2 border-[#22d3ee] shadow-lg shadow-cyan-500/40' 
                        : 'bg-gradient-to-br from-[#1e1b4b] to-[#0f0729] border-2 border-[#312e81]/50 hover:border-[#4f46e5]/60 hover:shadow-md hover:shadow-blue-500/20'
                    }
                  `}
                  style={{
                    boxShadow: cell.isCorrect 
                      ? '0 0 20px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                      : cell.isSelected
                        ? '0 0 20px rgba(6, 182, 212, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : 'inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                  }}
                  onMouseDown={() => handleCellMouseDown(cell)}
                  onMouseEnter={() => handleCellMouseEnter(cell)}
                  onMouseUp={handleCellMouseUp}
                  onTouchStart={() => handleCellMouseDown(cell)}
                  onTouchMove={(e) => {
                    const touch = e.touches[0];
                    const element = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (element && element.getAttribute('data-cell')) {
                      const [r, c] = element.getAttribute('data-cell')!.split('-').map(Number);
                      handleCellMouseEnter(grid[r][c]);
                    }
                  }}
                  onTouchEnd={handleCellMouseUp}
                  data-cell={`${rowIndex}-${colIndex}`}
                >
                  {cell.isCorrect && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-white rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 md:w-3 md:h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <span className="relative z-10">{cell.letter}</span>
                </div>
              ))
            )}
          </div>
          
          {/* Success toast notification */}
          {selectedCells.length > 0 && (
            <div className="mt-4 flex justify-center">
              <div className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-full text-xs md:text-sm font-semibold shadow-lg animate-pulse">
                Correct → +50 coins
              </div>
            </div>
          )}
        </div>

        {/* Words to find */}
        <div className="w-full max-w-[440px] px-2 md:px-0">
          <h3 className="text-white text-lg md:text-2xl font-bold text-center mb-4 md:mb-6">
            Words To Find ({wordsToFind.length - foundWords.length} Remaining)
          </h3>
        </div>
      </div>

      {/* Level Complete Modal */}
      {showLevelCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-[340px] md:max-w-[400px] animate-in fade-in zoom-in duration-300">
            {/* Close button */}
            <button
              onClick={() => setShowLevelCompleteModal(false)}
              className="absolute -top-2 -right-2 z-10 w-8 h-8 md:w-10 md:h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal content */}
            <div 
              className="relative rounded-[24px] md:rounded-[32px] p-[3px]"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(147, 51, 234, 0.4) 100%)'
              }}
            >
              <div className="bg-gradient-to-br from-[#1a1055] to-[#0f0838] rounded-[21px] md:rounded-[29px] px-4 py-6 md:px-6 md:py-8 text-center">
                {/* Trophy Icon */}
                <div className="flex justify-center mb-4 md:mb-6">
                  <div className="w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center">
                    <Image
                      src="/assets/icons/mdi-light_trophy.svg"
                      alt="Trophy"
                      width={120}
                      height={120}
                      className="md:w-16 md:h-16 w-16 h-16 object-contain"
                    />
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-white text-2xl md:text-3xl font-bold mb-1 md:mb-2">
                  Level Completed
                </h2>

                {/* Subtitle */}
                <p className="text-gray-300 text-xs md:text-sm mb-5 md:mb-8">
                  Silver Rank - Level {level}
                </p>

                {/* Points section */}
                <div 
                  className="relative rounded-[18px] md:rounded-[24px] p-[2px] mb-4 md:mb-6"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(147, 51, 234, 0.3) 100%)'
                  }}
                >
                  <div className="bg-[#0a0520] rounded-[16px] md:rounded-[22px] px-4 py-3 md:px-6 md:py-5">
                    {/* Point Earned */}
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <span className="text-white text-sm md:text-lg font-semibold">Point Earned</span>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <div className="w-5 h-5 md:w-6 md:h-6 bg-yellow-400 rounded-full"></div>
                        <span className="text-white text-lg md:text-xl font-bold">{earnedPoints}</span>
                      </div>
                    </div>

                    {/* Time Bonus */}
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm md:text-lg font-semibold">Time Bonus</span>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <div className="w-5 h-5 md:w-6 md:h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 md:w-4 md:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-white text-lg md:text-xl font-bold">x {timeBonus}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Next Level Button */}
                <button
                  onClick={handleNextLevel}
                  className="w-full bg-[#0074E9] hover:bg-[#0074E9] text-white py-3 md:py-4 text-lg md:text-xl font-bold rounded-[16px] md:rounded-[20px] transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  Next Level
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Up Modal */}
      {showTimeUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-[340px] md:max-w-[400px] animate-in fade-in zoom-in duration-300">
            {/* Close button */}
            <button
              onClick={() => setShowTimeUpModal(false)}
              className="absolute -top-2 -right-2 z-10 w-8 h-8 md:w-10 md:h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal content */}
            <div 
              className="relative rounded-[24px] md:rounded-[32px] p-[3px]"
              style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.4) 0%, rgba(220, 38, 38, 0.4) 100%)'
              }}
            >
              <div className="bg-gradient-to-br from-[#1a1055] to-[#0f0838] rounded-[21px] md:rounded-[29px] px-4 py-6 md:px-6 md:py-8 text-center">
                {/* Clock Icon */}
                <div className="flex justify-center mb-4 md:mb-6">
                  <div 
                    className="w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      boxShadow: '0 0 30px rgba(239, 68, 68, 0.5), 0 0 60px rgba(220, 38, 38, 0.3)'
                    }}
                  >
                    <svg className="w-12 h-12 md:w-16 md:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>

                {/* Title */}
                <h2 
                  className="text-3xl md:text-4xl font-bold mb-3 md:mb-4"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  Time Up!
                </h2>

                {/* Subtitle */}
                <p className="text-gray-300 text-sm md:text-base mb-6 md:mb-8">
                  Better luck next time
                </p>

                {/* Try Again Button */}
                <button
                  onClick={handleTryAgain}
                  className="w-full bg-[#0074E9] hover:bg-[#0074E9] text-white py-3 md:py-4 text-lg md:text-xl font-bold rounded-[16px] md:rounded-[20px] transition-all active:scale-95"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrosswordGame;
