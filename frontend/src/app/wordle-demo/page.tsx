"use client";

import { useState } from "react";
import WordleGame from "@/components/features/games/wordle/WordleGame";
import WordleRoomModal from "@/components/features/games/wordle/WordleRoomModal";

export default function WordleDemoPage() {
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#0A0146]">
      <div className="p-8">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          Wordle Multiplayer Demo
        </h1>

        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setShowRoomModal(true)}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Open Room Modal
          </button>

          <button
            onClick={() => setRoomCode("ABC123")}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Set Room Code: ABC123
          </button>
        </div>

        <div className="max-w-2xl mx-auto">
          <WordleGame
            roomCode={roomCode || undefined}
            isMultiplayer={!!roomCode}
          />
        </div>
      </div>

      <WordleRoomModal
        isOpen={showRoomModal}
        onClose={() => setShowRoomModal(false)}
        onStartGame={(roomId) => {
          setShowRoomModal(false);
          setRoomCode(roomId);
          console.log("Starting game with room:", roomId);
        }}
        roomCode={roomCode || undefined}
        isHost={true}
      />
    </div>
  );
}

