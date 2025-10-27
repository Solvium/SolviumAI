// Server-side multiplier service for API routes
// This doesn't use React hooks and can be imported in API routes

export interface PointCalculationResult {
  basePoints: number;
  multiplier: number;
  boostedPoints: number;
  totalPoints: number;
  boostAmount: number;
}

// For now, we'll use a simple multiplier of 1
// In the future, this could fetch from a database or external service
export const calculatePointsWithMultiplier = async (
  basePoints: number,
  multiplier?: number
): Promise<PointCalculationResult> => {
  // For server-side, we'll use a default multiplier of 1
  // This can be enhanced later to fetch from database or contract
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
