"use client";

import React from "react";
import { MultiplierDemo } from "@/components/common/MultiplierDemo";

export default function MultiplierDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🚀 Multiplier System Demo
          </h1>
          <p className="text-gray-600">
            See how the centralized multiplier system works across all
            point-awarding features
          </p>
        </div>

        <MultiplierDemo />

        <div className="mt-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">System Overview</h2>
          <div className="space-y-3 text-gray-700">
            <div>
              <strong>✅ Centralized Service:</strong> All point calculations go
              through one service
            </div>
            <div>
              <strong>✅ Contract Integration:</strong> Multiplier is fetched
              from the NEAR contract
            </div>
            <div>
              <strong>✅ Transparent Display:</strong> Users see both base
              points and boost amount
            </div>
            <div>
              <strong>✅ Flashy UI:</strong> Animated boost indicators with
              hover tooltips
            </div>
            <div>
              <strong>✅ Scalable:</strong> Easy to add new multiplier sources
              in the future
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
