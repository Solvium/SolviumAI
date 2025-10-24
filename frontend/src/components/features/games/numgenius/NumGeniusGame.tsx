"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";

interface NumGeniusGameProps {
  onClose?: () => void;
}

const NumGeniusGame: React.FC<NumGeniusGameProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [gameStarted, setGameStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [maxLevel] = useState(50);
  const [timer, setTimer] = useState(60);
  const [coins, setCoins] = useState(120);
  const [target, setTarget] = useState(0);
  const [availableNumbers, setAvailableNumbers] = useState<number[]>([]);
  const [selectedNumbers, setSelectedNumbers] = useState<(number | string)[]>([]);
  const [currentOperator, setCurrentOperator] = useState<string | null>(null);
  const [showLevelCompleteModal, setShowLevelCompleteModal] = useState(false);
  const [showTimeUpModal, setShowTimeUpModal] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [timeBonus, setTimeBonus] = useState(0);

  // Timer countdown
  useEffect(() => {
    if (gameStarted && timer > 0) {
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
  }, [gameStarted, timer]);

  const handleTimeUp = () => {
    setShowTimeUpModal(true);
  };

  const generateNewLevel = () => {
    // Generate random target number based on level difficulty
    const newTarget = Math.floor(Math.random() * (20 + level * 10)) + 10;
    
    // Generate 4 random numbers
    const numbers: number[] = [];
    for (let i = 0; i < 4; i++) {
      numbers.push(Math.floor(Math.random() * 12) + 1);
    }
    
    setTarget(newTarget);
    setAvailableNumbers(numbers);
    setSelectedNumbers([]);
    setCurrentOperator(null);
    setTimer(60);
  };

  const handleStartGame = () => {
    setGameStarted(true);
    setLevel(1);
    setCoins(120);
    generateNewLevel();
  };

  const handleNumberClick = (num: number) => {
    if (selectedNumbers.length >= 3) return;
    
    // If we already have a number and no operator, we need an operator next
    if (selectedNumbers.length === 1 && !currentOperator) {
      toast.error("Please select an operator first");
      return;
    }
    
    // If we have number + operator, add the second number
    if (selectedNumbers.length === 2 && currentOperator) {
      setSelectedNumbers([...selectedNumbers, num]);
      setCurrentOperator(null);
    } else if (selectedNumbers.length === 0) {
      // First number
      setSelectedNumbers([num]);
    }
  };

  const handleOperatorClick = (operator: string) => {
    if (selectedNumbers.length === 0) {
      toast.error("Please select a number first");
      return;
    }
    
    if (selectedNumbers.length === 1 && !currentOperator) {
      setSelectedNumbers([...selectedNumbers, operator]);
      setCurrentOperator(operator);
    } else if (selectedNumbers.length === 3) {
      // We have a complete equation, evaluate it first
      const result = evaluateExpression();
      if (result !== null) {
        setSelectedNumbers([result, operator]);
        setCurrentOperator(operator);
      }
    }
  };

  const evaluateExpression = (): number | null => {
    if (selectedNumbers.length !== 3) return null;
    
    const num1 = selectedNumbers[0] as number;
    const operator = selectedNumbers[1] as string;
    const num2 = selectedNumbers[2] as number;
    
    let result: number;
    switch (operator) {
      case "+":
        result = num1 + num2;
        break;
      case "-":
        result = num1 - num2;
        break;
      case "×":
        result = num1 * num2;
        break;
      case "/":
        if (num2 === 0) {
          toast.error("Cannot divide by zero");
          return null;
        }
        result = Math.floor(num1 / num2);
        break;
      default:
        return null;
    }
    
    return result;
  };

  const handleSubmit = () => {
    const result = evaluateExpression();
    
    if (result === null) {
      toast.error("Please complete the equation");
      return;
    }
    
    if (result === target) {
      // Correct answer
      const pointsEarned = Math.floor(timer / 2) + level * 5;
      const bonus = parseFloat((timer / 60 * 1.5).toFixed(2));
      
      setEarnedPoints(pointsEarned);
      setTimeBonus(bonus);
      setCoins((prev) => prev + pointsEarned);
      
      // Show level complete modal
      setShowLevelCompleteModal(true);
    } else {
      toast.error(`Wrong! Result is ${result}, target is ${target}`);
    }
  };

  const handleClear = () => {
    setSelectedNumbers([]);
    setCurrentOperator(null);
  };

  const handleBack = () => {
    setGameStarted(false);
    setSelectedNumbers([]);
    setCurrentOperator(null);
  };

  const handleNextLevel = () => {
    setShowLevelCompleteModal(false);
    if (level < maxLevel) {
      setLevel((prev) => prev + 1);
      generateNewLevel();
    } else {
      toast.success("Congratulations! You completed all levels!");
      setGameStarted(false);
    }
  };

  const handleTryAgain = () => {
    setShowTimeUpModal(false);
    generateNewLevel();
  };

  // Instructions screen
  if (!gameStarted) {
    return (
      <div className="min-h-screen w-screen  bg-[url('/assets/background/num-genius-bg.svg')] bg-cover bg-center bg-no-repeat relative overflow-x-hidden overflow-y-auto">
        {/* Animated background particles - matching design */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Left side particles */}
          <div 
            className="absolute left-2 md:left-4 top-[20%] w-2 h-2 md:w-3 md:h-3 rounded-full animate-pulse"
            style={{
              background: 'radial-gradient(circle, rgba(236, 72, 153, 0.8) 0%, rgba(236, 72, 153, 0) 70%)',
              boxShadow: '0 0 20px rgba(236, 72, 153, 0.6)',
              animationDuration: '3s'
            }}
          />
          <div 
            className="absolute left-2 md:left-4 bottom-[35%] w-2 h-2 md:w-3 md:h-3 rounded-full animate-pulse"
            style={{
              background: 'radial-gradient(circle, rgba(147, 51, 234, 0.8) 0%, rgba(147, 51, 234, 0) 70%)',
              boxShadow: '0 0 20px rgba(147, 51, 234, 0.6)',
              animationDuration: '2.5s',
              animationDelay: '0.5s'
            }}
          />
          
          {/* Right side particles */}
          <div 
            className="absolute right-2 md:right-4 bottom-[20%] w-2 h-2 md:w-3 md:h-3 rounded-full animate-pulse"
            style={{
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, rgba(59, 130, 246, 0) 70%)',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)',
              animationDuration: '3.5s',
              animationDelay: '1s'
            }}
          />
          <div 
            className="absolute right-2 md:right-4 bottom-[45%] w-2 h-2 md:w-3 md:h-3 rounded-full animate-pulse"
            style={{
              background: 'radial-gradient(circle, rgba(236, 72, 153, 0.8) 0%, rgba(236, 72, 153, 0) 70%)',
              boxShadow: '0 0 20px rgba(236, 72, 153, 0.6)',
              animationDuration: '2.8s',
              animationDelay: '1.5s'
            }}
          />
        </div>

        {/* Grid floor effect at bottom */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-32 md:h-64 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, rgba(10, 5, 32, 0.3) 50%, rgba(10, 5, 32, 0.6) 100%)',
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
            <button
              onClick={onClose}
              className="flex items-center gap-1 md:gap-2 text-white hover:text-gray-300 transition-colors group"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm md:text-base font-medium">Back</span>
            </button>
          </div>
        )}

        {/* Title */}
        <div className="pt-5 md:pt-6 text-center z-20 relative px-4">
          <h1
            className="text-xl md:text-3xl lg:text-4xl font-bold text-white tracking-[0.15em] md:tracking-[0.25em]"
            style={{ 
              fontFamily: "'Press Start 2P', 'Courier New', monospace",
              textShadow: '0 0 20px rgba(255, 255, 255, 0.3), 0 0 40px rgba(147, 51, 234, 0.2)'
            }}
          >
            NUM-GENIUS
          </h1>
        </div>

        {/* Main content container */}
        <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-80px)] px-4 md:px-6 py-6 md:py-12">
          <div className="w-full max-w-md">
            {/* Main instructions card with precise border and styling */}
            <div 
              className="relative rounded-2xl md:rounded-[32px] p-[2px] mb-4 md:mb-6"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(147, 51, 234, 0.6) 100%)',
                boxShadow: '0 0 40px rgba(59, 130, 246, 0.3), 0 0 80px rgba(147, 51, 234, 0.2)'
              }}
            >
              <div 
                className="bg-gradient-to-br from-[#1a1055] to-[#0f0838] rounded-[calc(1rem-2px)] md:rounded-[30px] p-4 md:p-6 lg:p-8"
                style={{
                  backdropFilter: 'blur(10px)'
                }}
              >
                {/* Instructions header */}
                <h2 className="text-white text-xl md:text-2xl lg:text-3xl font-bold mb-2 md:mb-3">Instructions</h2>
                <p className="text-gray-300 text-[8px] md:text-sm leading-relaxed mb-4 md:mb-6">
                  Use available numbers to reach the target number by creating equations with +, -, ×, ÷. 
                  You have 1 minute to solve before time runs out!
                </p>

                {/* Game Rules section */}
                <div 
                  className="relative rounded-xl md:rounded-[24px] p-[2px] mb-4 md:mb-6"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.5) 0%, rgba(147, 51, 234, 0.5) 100%)'
                  }}
                >
                  <div 
                    className="bg-gradient-to-br from-[#1e1565] to-[#120a45] rounded-[calc(0.75rem-2px)] md:rounded-[22px] p-3 md:p-5 lg:p-6"
                  >
                    <h3 className="text-white text-base md:text-lg lg:text-xl font-bold mb-2 md:mb-3">Game Rules</h3>
                    <ul className="text-gray-300 text-[8px] md:text-sm space-y-1.5 md:space-y-2.5">
                      <li className="flex items-start">
                        <span className="mr-2 mt-0.5">•</span>
                        <span>Start with easy numbers, progress to harder challenges</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2 mt-0.5">•</span>
                        <span>Each correct solution unlocks the next level</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2 mt-0.5">•</span>
                        <span>If time runs out, the game ends</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Rewards section */}
                <div 
                  className="relative rounded-xl md:rounded-[24px] p-[2px]"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.5) 0%, rgba(147, 51, 234, 0.5) 100%)'
                  }}
                >
                  <div 
                    className="bg-gradient-to-br from-[#1e1565] to-[#120a45] rounded-[calc(0.75rem-2px)] md:rounded-[22px] p-3 md:p-5 lg:p-6"
                  >
                    <h3 className="text-white text-base md:text-lg lg:text-xl font-bold mb-2 md:mb-3">Rewards</h3>
                    <ul className="text-gray-300 text-[8px] md:text-sm space-y-1.5 md:space-y-2.5">
                      <li className="flex items-start">
                        <span className="mr-2 mt-0.5">•</span>
                        <span>Earn points and coins for each solved level. Bonus time for correct answers!</span>
                      </li>
                    </ul>
                  </div>
                </div>
            <button
              onClick={handleStartGame}
              className="w-full bg-gradient-to-r from-[#0ea5e9] to-[#3b82f6] hover:from-[#0284c7] hover:to-[#2563eb] text-white py-3 md:py-4 lg:py-5 text-base md:text-lg lg:text-xl font-bold rounded-xl md:rounded-[20px] shadow-lg transform transition-all hover:scale-[1.02] active:scale-[0.98] mt-8"
              style={{
                boxShadow: '0 8px 32px rgba(14, 165, 233, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              }}
            >
              Start Playing
            </button>
              </div>
            </div>

            {/* Start Playing button */}
          </div>
        </div>
      </div>
    );
  }

  // Game screen
  return (
    <div className="min-h-screen w-screen bg-[url('/assets/background/num-genius-bg.svg')] bg-cover bg-center bg-no-repeat relative overflow-x-hidden overflow-y-auto">
      {/* Animated background particles - matching design exactly */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Left side particles */}
        <div 
          className="absolute left-3 md:left-6 top-[25%] w-2 h-2 md:w-3 md:h-3 rounded-full animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.9) 0%, rgba(236, 72, 153, 0) 70%)',
            boxShadow: '0 0 15px rgba(236, 72, 153, 0.7)',
            animationDuration: '3s'
          }}
        />
        <div 
          className="absolute left-3 md:left-6 bottom-[30%] w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.9) 0%, rgba(139, 92, 246, 0) 70%)',
            boxShadow: '0 0 15px rgba(139, 92, 246, 0.7)',
            animationDuration: '2.5s',
            animationDelay: '0.5s'
          }}
        />
        
        {/* Right side particles */}
        <div 
          className="absolute right-3 md:right-6 bottom-[15%] w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.9) 0%, rgba(236, 72, 153, 0) 70%)',
            boxShadow: '0 0 15px rgba(236, 72, 153, 0.7)',
            animationDuration: '3.5s',
            animationDelay: '1s'
          }}
        />
      </div>

      {/* Grid floor effect at bottom */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-48 md:h-64 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(10, 5, 32, 0.4) 50%, rgba(10, 5, 32, 0.7) 100%)',
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          transform: 'perspective(600px) rotateX(60deg)',
          transformOrigin: 'bottom',
        }}
      />

      {/* Back button */}
      <div className="absolute top-5 md:top-7 left-4 md:left-6 z-20">
        {/* <button
          onClick={handleBack}
          className="flex items-center gap-1.5 md:gap-2 text-white hover:text-gray-300 transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm md:text-base font-semibold">Back</span>
        </button> */}
      </div>

      {/* Title - centered */}
      <div className="pt-5 md:pt-7 text-center z-20 relative px-4">
        <h1
          className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-[0.15em] md:tracking-[0.25em]"
          style={{ 
            fontFamily: "'Press Start 2P', 'Courier New', monospace",
            textShadow: '0 0 20px rgba(255, 255, 255, 0.4), 0 0 40px rgba(139, 92, 246, 0.3)'
          }}
        >
          NUM-GENIUS
        </h1>
      </div>

      {/* Game content */}
      <div className="relative z-10 flex flex-col items-center justify-start px-3 md:px-6 py-3 md:py-8">
        {/* Stats bar */}
        <div className="flex gap-7 md:gap-4 mb-10 md:mb-10">
          {/* Level - blue border */}
          <div 
            className="relative bg-[#1C97D8] rounded-2xl md:rounded-[20px] p-[2px]"
            // style={{
            //   background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(96, 165, 250, 0.6) 100%)'
            // }}
          >
            <div className="bg-[#0f0a2e] rounded-[calc(1rem-3px)] md:rounded-[18px] px-2.5 md:px-5 py-1.5 md:py-3">
              <span className="text-white text-[10px] md:text-sm font-bold whitespace-nowrap">
                Level {level}/{maxLevel}
              </span>
            </div>
          </div>

          {/* Timer - blue border with icon */}
          <div 
            className="relative bg-[#1C97D8] rounded-2xl md:rounded-[20px] p-[2px]"
            // style={{
            //   background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(96, 165, 250, 0.6) 100%)'
            // }}
          >
            <div className="bg-[#0f0a2e] rounded-[calc(1rem-2px)] md:rounded-[18px] px-2.5 md:px-5 py-1.5 md:py-3 flex items-center gap-1.5 md:gap-2">
              <div className="w-4 h-4 md:w-6 md:h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-2 h-2 md:w-3.5 md:h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-white text-[10px] md:text-sm font-bold">{timer}</span>
            </div>
          </div>

          {/* Coins - pink/magenta border */}
          <div 
            className="relative bg-[#DC01FD] rounded-2xl md:rounded-[20px] p-[2px]"
            // style={{
            //   background: 'linear-gradient(135deg, rgba(219, 39, 119, 0.6) 0%, rgba(236, 72, 153, 0.6) 100%)'
            // }}
          >
            <div className="bg-[#0f0a2e] rounded-[calc(1rem-2px)] md:rounded-[18px] px-2.5 md:px-5 py-1.5 md:py-3 flex items-center gap-1.5 md:gap-2">
              <div className="w-4 h-4 md:w-6 md:h-6 bg-yellow-400 rounded-full"></div>
              <span className="text-white text-[10px] md:text-sm font-bold">{coins}</span>
            </div>
          </div>
        </div>

        {/* Target display - cyan border with nested structure */}
        <div className="w-[270px] max-w-md mb-10 md:mb-10">
          <div 
            className="bg-[#1C97D8] relative rounded-[28px] md:rounded-[32px] p-[3px]"
            // style={{
            //   background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.7) 0%, rgba(14, 165, 233, 0.7) 100%)',
            //   // boxShadow: '0 0 30px rgba(6, 182, 212, 0.4), 0 0 60px rgba(6, 182, 212, 0.2)'
            // }}
          >
            <div className="bg-gradient-to-br from-[#0f0a2e] to-[#1a0f3e] rounded-[25px] md:rounded-[29px] p-4 md:p-8">
              <h2 className="text-white text-lg md:text-3xl lg:text-4xl font-bold text-center mb-3 md:mb-6">
                Target = {target}
              </h2>

              {/* Inner equation display - darker cyan border */}
              <div 
                className="relative bg-[#1C97D8] rounded-[20px] md:rounded-[28px] p-[3px]"
                // style={{
                //   background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.6) 0%, rgba(14, 165, 233, 0.6) 100%)'
                // }}
              >
                <div className="bg-[#0a0520] rounded-[17px] md:rounded-[25px] p-4 md:p-8 min-h-[80px] md:min-h-[120px] flex items-center justify-center">
                  <div className="flex items-center gap-3 md:gap-6 text-white text-2xl md:text-4xl lg:text-5xl font-bold">
                    {selectedNumbers.length > 0 ? (
                      <>
                        <span>{selectedNumbers[0]}</span>
                        {selectedNumbers.length > 1 && (
                          <>
                            <span className="text-cyan-400">{selectedNumbers[1]}</span>
                            {selectedNumbers.length > 2 && <span>{selectedNumbers[2]}</span>}
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-600 text-xs md:text-lg">Build your equation...</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Number buttons - cyan borders */}
        <div className="w-[240px] max-w-md mb-3 md:mb-6">
          <div className="grid grid-cols-4 gap-2 md:gap-4">
            {availableNumbers.map((num, index) => (
              <div
                key={index}
                className="bg-[#1C97D8] relative rounded-[16px] md:rounded-[24px] p-[2px]"
                // style={{
                //   background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.6) 0%, rgba(14, 165, 233, 0.6) 100%)'
                // }}
              >
                <button
                  onClick={() => handleNumberClick(num)}
                  className="w-full bg-[#0a0520] rounded-[14px] md:rounded-[22px] h-12 md:h-16 lg:h-[70px] text-white text-xl md:text-3xl lg:text-4xl font-bold hover:bg-[#0f0a2e] active:scale-95 transition-all"
                >
                  {num}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Operator buttons - cyan borders */}
        <div className="w-[240px] max-w-md mb-10 md:mb-8">
          <div className="grid grid-cols-4 gap-2 md:gap-4">
            {["+", "-", "X", "/"].map((op) => (
              <div
                key={op}
                className="bg-[#1C97D8] relative rounded-[16px] md:rounded-[24px] p-[2px]"
                // style={{
                //   background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.6) 0%, rgba(14, 165, 233, 0.6) 100%)'
                // }}
              >
                <button
                  onClick={() => handleOperatorClick(op === "X" ? "×" : op)}
                  className="w-full bg-[#0a0520] rounded-[14px] md:rounded-[22px] h-12 md:h-16 lg:h-[70px] text-white text-xl md:text-3xl lg:text-4xl font-bold hover:bg-[#0f0a2e] active:scale-95 transition-all"
                >
                  {op}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
       <div className="w-[270px] max-w-md grid grid-cols-2 gap-2 md:gap-4 mb-4">
  {/* Submit button */}
  <div className="relative rounded-[10px] md:rounded-[24px] p-[2px]">
    <button
      onClick={handleSubmit}
      className="relative w-full h-[50px] md:h-[70px] hover:from-[#0284c7] hover:to-[#0891b2] text-white text-base md:text-xl font-bold rounded-[10px] md:rounded-[22px] transition-all active:scale-95 flex items-center justify-center overflow-hidden"
      style={{
        textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
      }}
    >
      <Image
        src="/assets/icons/submit-icon.svg"
        alt="Submit"
        width={120}
        height={120}
        className="object-contain"
      />
    </button>
  </div>

  {/* Clear button */}
  <div className="relative rounded-[10px] md:rounded-[24px] p-[2px]">
    <button
      onClick={handleClear}
      className="relative w-full h-[50px] md:h-[70px]hover:from-[#9333ea] hover:to-[#be185d] text-white text-base md:text-xl font-bold rounded-[10px] md:rounded-[22px] transition-all active:scale-95 flex items-center justify-center overflow-hidden"
      style={{
        textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
      }}
    >
      <Image
        src="/assets/icons/clear-icon.svg"
        alt="Clear"
        width={120}
        height={120}
        className="object-contain"
      />
    </button>
  </div>
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
                  {/* <div 
                    className="w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
                      boxShadow: '0 0 30px rgba(6, 182, 212, 0.5), 0 0 60px rgba(14, 165, 233, 0.3)'
                    }}
                  >
                    <svg className="w-12 h-12 md:w-16 md:h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                    </svg>
                  </div> */}
                  <div
  className="w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center"
  // style={{
  //   background: "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)",
  //   boxShadow:
  //     "0 0 30px rgba(6, 182, 212, 0.5), 0 0 60px rgba(14, 165, 233, 0.3)",
  // }}
>
  <Image
    src="/assets/icons/mdi-light_trophy.svg" // replace with your image path
    alt="icon"
    width={120} // adjust as needed
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
                  // style={{
                  //   boxShadow: '0 8px 32px rgba(14, 165, 233, 0.4)',
                  //   textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                  // }}
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
                  // style={{
                  //   boxShadow: '0 8px 32px rgba(14, 165, 233, 0.4)',
                  //   textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                  // }}
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

export default NumGeniusGame;
