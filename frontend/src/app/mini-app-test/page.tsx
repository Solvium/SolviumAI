"use client";

import React from "react";
import { MiniAppIntegration } from "@/components/features/MiniAppIntegration";

export default function MiniAppTestPage() {
  const handleSuccess = (response: any) => {
    console.log("Mini app API success:", response);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0520] via-[#1a0f3e] to-[#0a0520] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Mini App API Integration Test
          </h1>
          <p className="text-gray-300">
            Test the integration with the mini app wallet/get-or-create endpoint
          </p>
        </div>

        <MiniAppIntegration onSuccess={handleSuccess} />

        <div className="mt-8 text-center">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-white mb-4">
              API Endpoint Details
            </h2>
            <div className="text-left text-gray-300 space-y-2">
              <p>
                <strong>Endpoint:</strong>{" "}
                https://quiz.solviumgame.xyz/wallet/get-or-create
              </p>
              <p>
                <strong>Method:</strong> POST
              </p>
              <p>
                <strong>Headers:</strong> X-API-Secret: [MINI_APP_API_SECRET]
              </p>
              <p>
                <strong>Body:</strong>{" "}
                {`{ "telegram_user_id": number, "username": string, "first_name": string }`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
