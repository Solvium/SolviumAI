"use client";

import React, { useState, useEffect } from "react";
import { PointCalculationResult } from "@/lib/services/PointMultiplierService";
import { usePointMultiplier } from "@/lib/services/PointMultiplierService";

interface PointsDisplayProps {
  basePoints: number;
  showAnimation?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const PointsDisplay: React.FC<PointsDisplayProps> = ({
  basePoints,
  showAnimation = true,
  className = "",
  size = "md",
}) => {
  const { calculatePoints } = usePointMultiplier();
  const [calculation, setCalculation] = useState<PointCalculationResult | null>(
    null
  );
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const calculate = async () => {
      const result = await calculatePoints(basePoints);
      setCalculation(result);

      if (showAnimation && result.boostAmount > 0) {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 2000);
      }
    };

    calculate();
  }, [basePoints, calculatePoints, showAnimation]);

  if (!calculation) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-pulse bg-gray-300 rounded h-6 w-16"></div>
      </div>
    );
  }

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const iconSizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* SOLV Icon */}
      <div className="flex items-center space-x-1">
        <img
          src="/assets/coins/solv-coin.png"
          alt="SOLV"
          className={`${iconSizeClasses[size]} ${
            isAnimating ? "animate-bounce" : ""
          }`}
        />
        <span className={`font-bold text-yellow-600 ${sizeClasses[size]}`}>
          {calculation.totalPoints}
        </span>
      </div>

      {/* Multiplier Boost Display */}
      {calculation.boostAmount > 0 && (
        <div
          className={`flex items-center space-x-1 px-2 py-1 rounded-full transition-all duration-500 ${
            isAnimating
              ? "bg-gradient-to-r from-green-400 to-emerald-500 scale-110 shadow-lg"
              : "bg-gradient-to-r from-green-500 to-emerald-600"
          }`}
        >
          <span className="text-white text-xs font-bold">
            +{calculation.boostAmount}
          </span>
          <span className="text-white text-xs">
            ({calculation.multiplier}x)
          </span>
        </div>
      )}

      {/* Breakdown Tooltip */}
      {calculation.boostAmount > 0 && (
        <div className="group relative">
          <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap transition-opacity duration-200">
            Base: {calculation.basePoints} + Boost: {calculation.boostAmount}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
          </div>
          <div className="w-2 h-2 bg-gray-400 rounded-full cursor-help"></div>
        </div>
      )}
    </div>
  );
};

// Simple version for when you already have the calculation
interface SimplePointsDisplayProps {
  calculation: PointCalculationResult;
  showAnimation?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const SimplePointsDisplay: React.FC<SimplePointsDisplayProps> = ({
  calculation,
  showAnimation = true,
  className = "",
  size = "md",
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (showAnimation && calculation.boostAmount > 0) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 2000);
    }
  }, [calculation.boostAmount, showAnimation]);

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const iconSizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* SOLV Icon */}
      <div className="flex items-center space-x-1">
        <img
          src="/assets/coins/solv-coin.png"
          alt="SOLV"
          className={`${iconSizeClasses[size]} ${
            isAnimating ? "animate-bounce" : ""
          }`}
        />
        <span className={`font-bold text-yellow-600 ${sizeClasses[size]}`}>
          {calculation.totalPoints}
        </span>
      </div>

      {/* Multiplier Boost Display */}
      {calculation.boostAmount > 0 && (
        <div
          className={`flex items-center space-x-1 px-2 py-1 rounded-full transition-all duration-500 ${
            isAnimating
              ? "bg-gradient-to-r from-green-400 to-emerald-500 scale-110 shadow-lg"
              : "bg-gradient-to-r from-green-500 to-emerald-600"
          }`}
        >
          <span className="text-white text-xs font-bold">
            +{calculation.boostAmount}
          </span>
          <span className="text-white text-xs">
            ({calculation.multiplier}x)
          </span>
        </div>
      )}
    </div>
  );
};
