"use client";

import React, { useState, useEffect } from "react";
import { PointsDisplay, SimplePointsDisplay } from "./PointsDisplay";
import { usePointMultiplier } from "@/lib/services/PointMultiplierService";
import { PointCalculationResult } from "@/lib/services/PointMultiplierService";

export const MultiplierDemo: React.FC = () => {
  const {
    calculatePoints,
    getCurrentMultiplier,
    currentMultiplier,
    isLoading,
  } = usePointMultiplier();
  const [demoPoints, setDemoPoints] = useState(100);
  const [calculation, setCalculation] = useState<PointCalculationResult | null>(
    null
  );

  useEffect(() => {
    const calculate = async () => {
      const result = await calculatePoints(demoPoints);
      setCalculation(result);
    };
    calculate();
  }, [demoPoints, calculatePoints]);

  return (
    <div className="p-6 bg-gray-100 rounded-lg">
      <h3 className="text-xl font-bold mb-4">Multiplier System Demo</h3>

      {/* Current Multiplier Status */}
      <div className="mb-4 p-4 bg-white rounded-lg shadow">
        <h4 className="font-semibold mb-2">Current Multiplier Status</h4>
        {isLoading ? (
          <div className="text-gray-500">Loading multiplier...</div>
        ) : (
          <div className="flex items-center space-x-4">
            <span className="text-lg font-bold text-green-600">
              {currentMultiplier}x Multiplier Active
            </span>
            {currentMultiplier > 1 && (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                🚀 Boost Active!
              </span>
            )}
          </div>
        )}
      </div>

      {/* Points Calculator */}
      <div className="mb-4 p-4 bg-white rounded-lg shadow">
        <h4 className="font-semibold mb-2">Points Calculator</h4>
        <div className="flex items-center space-x-4 mb-4">
          <label className="font-medium">Base Points:</label>
          <input
            type="number"
            value={demoPoints}
            onChange={(e) => setDemoPoints(Number(e.target.value))}
            className="border rounded px-3 py-1 w-24"
            min="1"
            max="1000"
          />
        </div>

        {calculation && (
          <div className="space-y-2">
            <div className="text-sm text-gray-600">
              <div>Base Points: {calculation.basePoints}</div>
              <div>Multiplier: {calculation.multiplier}x</div>
              <div>Boost Amount: +{calculation.boostAmount}</div>
              <div className="font-bold text-lg">
                Total: {calculation.totalPoints}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Points Display Components */}
      <div className="space-y-4">
        <div className="p-4 bg-white rounded-lg shadow">
          <h4 className="font-semibold mb-2">
            Auto-calculating Points Display
          </h4>
          <PointsDisplay
            basePoints={demoPoints}
            showAnimation={true}
            size="lg"
          />
        </div>

        {calculation && (
          <div className="p-4 bg-white rounded-lg shadow">
            <h4 className="font-semibold mb-2">
              Pre-calculated Points Display
            </h4>
            <SimplePointsDisplay
              calculation={calculation}
              showAnimation={true}
              size="lg"
            />
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold mb-2 text-blue-800">
          How to Use in Your Components
        </h4>
        <div className="text-sm text-blue-700 space-y-1">
          <div>
            1. Import:{" "}
            <code className="bg-blue-100 px-1 rounded">
              import {`{PointsDisplay}`} from
              "@/components/common/PointsDisplay"
            </code>
          </div>
          <div>
            2. Use:{" "}
            <code className="bg-blue-100 px-1 rounded">{`<PointsDisplay basePoints={100} showAnimation={true} />`}</code>
          </div>
          <div>
            3. The component automatically fetches the current multiplier and
            displays the boost!
          </div>
        </div>
      </div>
    </div>
  );
};
