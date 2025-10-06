"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Users, Trophy, Send, Play } from "lucide-react";

interface WordleRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGame: (roomId: string) => void;
  roomCode?: string;
  isHost?: boolean;
}

interface Player {
  id: string;
  username: string;
  avatar?: string;
  isReady: boolean;
}

const WordleRoomModal: React.FC<WordleRoomModalProps> = ({
  isOpen,
  onClose,
  onStartGame,
  roomCode,
  isHost = false,
}) => {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([
    {
      id: user?.id || "1",
      username: user?.username || "You",
      isReady: true,
    },
  ]);
  const [waitingForPlayers, setWaitingForPlayers] = useState(true);
  const [gameRoomCode, setGameRoomCode] = useState(
    roomCode || generateRoomCode()
  );
  const [bonusAmount, setBonusAmount] = useState(25);

  // Generate a 6-character room code
  function generateRoomCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Simulate adding a friend (for demo purposes)
  const addFriend = () => {
    const newPlayer: Player = {
      id: `player_${Date.now()}`,
      username: "Friend",
      isReady: false,
    };
    setPlayers([...players, newPlayer]);
    setWaitingForPlayers(false);
  };

  // Toggle ready status
  const toggleReady = () => {
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === (user?.id || "1") ? { ...p, isReady: !p.isReady } : p
      )
    );
  };

  // Start the game
  const handleStartGame = () => {
    onStartGame(gameRoomCode);
  };

  // Share the game
  const shareGame = () => {
    const shareText = `@solvium Wordle Room ${gameRoomCode}`;
    if (navigator.share) {
      navigator.share({
        title: "Join my Wordle game!",
        text: shareText,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(shareText);
      // You could show a toast notification here
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-blue-500 to-blue-700 rounded-3xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <button
            onClick={onClose}
            className="text-white hover:text-blue-200 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">Wordle Challenge</h2>
            <p className="text-blue-100 text-sm mt-1">
              Solve first and get a bonus!
            </p>
          </div>
          <div className="w-6" /> {/* Spacer for centering */}
        </div>

        {/* Room Code */}
        <div className="px-6 pb-4">
          <div className="bg-blue-600/50 rounded-2xl p-4 text-center">
            <p className="text-blue-100 text-sm mb-2">Room Code</p>
            <p className="text-3xl font-bold text-white tracking-wider">
              {gameRoomCode}
            </p>
            <p className="text-blue-200 text-xs mt-1">
              Share this code with friends
            </p>
          </div>
        </div>

        {/* Players Section */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-center space-x-8 mb-6">
            {/* You */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mb-2">
                <span className="text-white font-bold text-lg">
                  {user?.username?.charAt(0).toUpperCase() || "Y"}
                </span>
              </div>
              <p className="text-white text-sm font-medium">You</p>
              <div className="flex items-center justify-center mt-1">
                {players[0]?.isReady ? (
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                ) : (
                  <div className="w-2 h-2 bg-gray-400 rounded-full" />
                )}
              </div>
            </div>

            {/* VS Icon */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-blue-600/50 rounded-full flex items-center justify-center">
                <Trophy className="w-6 h-6 text-yellow-400" />
              </div>
            </div>

            {/* Friend/Waiting */}
            <div className="text-center">
              {waitingForPlayers ? (
                <>
                  <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mb-2">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-white text-sm font-medium">Waiting</p>
                  <p className="text-blue-200 text-xs">for friend</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mb-2">
                    <span className="text-white font-bold text-lg">F</span>
                  </div>
                  <p className="text-white text-sm font-medium">Friend</p>
                  <div className="flex items-center justify-center mt-1">
                    {players[1]?.isReady ? (
                      <div className="w-2 h-2 bg-green-400 rounded-full" />
                    ) : (
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bonus Information */}
          <div className="bg-blue-800/50 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">First solve bonus</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-yellow-400 font-bold text-lg">
                  +{bonusAmount}
                </span>
                <div className="w-6 h-6 bg-yellow-400 rounded flex items-center justify-center">
                  <span className="text-yellow-800 font-bold text-xs">S</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Send Game Button */}
            <button
              onClick={shareGame}
              className="w-full bg-blue-600/50 border border-blue-400 rounded-2xl py-4 px-6 flex items-center justify-center space-x-3 hover:bg-blue-600/70 transition-colors"
            >
              <Send className="w-5 h-5 text-white" />
              <span className="text-white font-semibold">SEND GAME</span>
            </button>

            {/* Play Button */}
            <button
              onClick={handleStartGame}
              className="w-full bg-green-500 hover:bg-green-600 rounded-2xl py-4 px-6 flex items-center justify-center space-x-3 transition-colors"
            >
              <Play className="w-5 h-5 text-white" />
              <span className="text-white font-semibold">PLAY</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordleRoomModal;

