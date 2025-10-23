"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import WordleGame from "@/components/features/games/wordle/WordleGame";
import QuizGame from "@/components/features/games/quiz/QuizGame";
import { PicturePuzzle } from "@/components/features/games/puzzle/Game";
import { useAuth } from "@/contexts/AuthContext";
import { getGameInfo, isValidGameId } from "@/lib/gameUtils";

// Game components mapping
const gameComponents = {
  wordle: WordleGame,
  quiz: QuizGame,
  puzzle: PicturePuzzle,
  "picture-puzzle": PicturePuzzle,
  "num-genius": PicturePuzzle, // Placeholder - you can create a separate component
  "cross-word": PicturePuzzle, // Placeholder - you can create a separate component
};

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const gameId = params.gameId as string;

  useEffect(() => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      router.push("/");
      return;
    }

    // Check if game exists
    if (
      !isValidGameId(gameId) ||
      !gameComponents[gameId as keyof typeof gameComponents]
    ) {
      router.push("/");
      return;
    }

    setIsLoading(false);
  }, [gameId, isAuthenticated, router]);

  // Show loading while checking authentication and game validity
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center tropical-gradient">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  // Get the game component and info
  const GameComponent = gameComponents[gameId as keyof typeof gameComponents];
  const gameInfo = getGameInfo(gameId);

  if (!GameComponent) {
    return (
      <div className="h-screen flex items-center justify-center tropical-gradient">
        <div className="text-white text-xl">Game not found</div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden tropical-gradient">
      <div className="max-w-[630px] no-scrollbar mx-auto relative h-screen">
        <div className="flex flex-col no-scrollbar h-full">
          {/* Header with back button and game title */}
          <div className="flex items-center justify-between p-4 bg-black/20 backdrop-blur-sm">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-white hover:text-yellow-400 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
              <span className="text-sm">Back</span>
            </button>
            <div className="text-center">
              <h1 className="text-white text-lg font-bold">
                {gameInfo?.title || "Game"}
              </h1>
              <p className="text-white/70 text-xs">
                {gameInfo?.description || ""}
              </p>
            </div>
            <div className="w-16" /> {/* Spacer for centering */}
          </div>

          {/* Game content */}
          <div className="flex-1 overflow-hidden">
            <GameComponent />
          </div>
        </div>
      </div>
    </div>
  );
}
