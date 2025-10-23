"use client";

import { useState } from "react";
import GameLink from "@/components/common/GameLink";
import { getAllGames } from "@/lib/gameUtils";
import { useEnhancedNavigation } from "@/lib/navigationUtils";

export default function GameTestPage() {
  const [selectedGame, setSelectedGame] = useState<string>("");
  const { navigateToGame } = useEnhancedNavigation();
  const games = getAllGames();

  const handleDirectNavigation = () => {
    if (selectedGame) {
      navigateToGame(selectedGame as any);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0520] via-[#1a0f3e] to-[#0a0520] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          Game Routing Test Page
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Game Links Section */}
          <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Direct Game Links
            </h2>
            <div className="space-y-3">
              {games.map((game) => (
                <GameLink
                  key={game.id}
                  gameId={game.id}
                  className="block w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-center"
                >
                  {game.title} - {game.description}
                </GameLink>
              ))}
            </div>
          </div>

          {/* Programmatic Navigation Section */}
          <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Programmatic Navigation
            </h2>
            <div className="space-y-4">
              <select
                value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value)}
                className="w-full p-3 bg-white/10 text-white rounded-lg border border-white/20"
              >
                <option value="">Select a game...</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.title}
                  </option>
                ))}
              </select>

              <button
                onClick={handleDirectNavigation}
                disabled={!selectedGame}
                className="w-full p-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Navigate to {selectedGame || "Game"}
              </button>
            </div>
          </div>
        </div>

        {/* URL Examples */}
        <div className="mt-8 bg-black/20 backdrop-blur-sm rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Direct URL Examples
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {games.map((game) => (
              <div key={game.id} className="bg-white/5 rounded-lg p-4">
                <div className="text-white font-medium">{game.title}</div>
                <div className="text-blue-400 text-sm font-mono">
                  {game.route}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
