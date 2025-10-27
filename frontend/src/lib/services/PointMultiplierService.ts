"use client";

import { useDepositMultiplier } from "@/hooks/useDepositMultiplier";

export interface PointCalculationResult {
  basePoints: number;
  multiplier: number;
  boostedPoints: number;
  totalPoints: number;
  boostAmount: number;
}

export interface PointMultiplierService {
  calculatePointsWithMultiplier: (
    basePoints: number
  ) => Promise<PointCalculationResult>;
  getCurrentMultiplier: () => Promise<number>;
}

class PointMultiplierServiceImpl implements PointMultiplierService {
  private multiplierHook: ReturnType<typeof useDepositMultiplier> | null = null;

  constructor() {
    // We'll initialize this when the hook is available
  }

  setMultiplierHook(hook: ReturnType<typeof useDepositMultiplier>) {
    this.multiplierHook = hook;
  }

  async getCurrentMultiplier(): Promise<number> {
    if (!this.multiplierHook) {
      console.warn(
        "Multiplier hook not initialized, using default multiplier of 1"
      );
      return 1;
    }

    try {
      // Fetch current multiplier from contract
      await this.multiplierHook.fetchCurrentMultiplier();
      return this.multiplierHook.currentMultiplier || 1;
    } catch (error) {
      console.error("Failed to fetch multiplier:", error);
      return 1; // Fallback to 1x multiplier
    }
  }

  async calculatePointsWithMultiplier(
    basePoints: number
  ): Promise<PointCalculationResult> {
    const multiplier = await this.getCurrentMultiplier();
    const boostedPoints = Math.round(basePoints * multiplier);
    const boostAmount = boostedPoints - basePoints;

    return {
      basePoints,
      multiplier,
      boostedPoints,
      totalPoints: boostedPoints,
      boostAmount,
    };
  }
}

// Singleton instance
export const pointMultiplierService = new PointMultiplierServiceImpl();

// Hook to use the service with React components
export const usePointMultiplier = () => {
  const multiplierHook = useDepositMultiplier();

  // Initialize the service with the hook
  pointMultiplierService.setMultiplierHook(multiplierHook);

  const calculatePoints = async (
    basePoints: number
  ): Promise<PointCalculationResult> => {
    return pointMultiplierService.calculatePointsWithMultiplier(basePoints);
  };

  const getCurrentMultiplier = async (): Promise<number> => {
    return pointMultiplierService.getCurrentMultiplier();
  };

  return {
    calculatePoints,
    getCurrentMultiplier,
    currentMultiplier: multiplierHook.currentMultiplier,
    isLoading: multiplierHook.isLoading,
    error: multiplierHook.error,
  };
};

// Utility function for non-React contexts (API routes, etc.)
export const calculatePointsWithMultiplier = async (
  basePoints: number,
  multiplier?: number
): Promise<PointCalculationResult> => {
  const actualMultiplier = multiplier ?? 1;
  const boostedPoints = Math.round(basePoints * actualMultiplier);
  const boostAmount = boostedPoints - basePoints;

  return {
    basePoints,
    multiplier: actualMultiplier,
    boostedPoints,
    totalPoints: boostedPoints,
    boostAmount,
  };
};
