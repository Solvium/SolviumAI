"use client";
import { useEffect, useState } from "react";
import LeaderBoard from "@/components/features/leaderboard/LeaderBoard";
import type WebApp from "@twa-dev/sdk";
import UserProfile from "@/components/features/profile/Profile";
import Contest from "@/components/features/contest/Contest";
import WalletPage from "@/components/common/WalletPage";
import LoginModule from "@/components/features/auth/LoginModule";
import { useAuth } from "@/contexts/AuthContext";
import GamesPage from "@/components/features/games/GamesPage";
import WordleGame from "@/components/features/games/wordle/WordleGame";
import QuizGame from "@/components/features/games/quiz/QuizGame";
import { PicturePuzzle } from "@/components/features/games/puzzle/Game";
import { WheelOfFortune } from "@/components/features/wheel/Wheel";
import HomePage from "@/components/layout/HomePage";
import {
  NavigationProvider,
  useNavigation,
} from "@/contexts/NavigationContext";
import Image from "next/image";
import HomeIcon from "@/components/common/icons/HomeIcon";
import GameIcon from "@/components/common/icons/GameIcon";
import RankIcon from "@/components/common/icons/RankIcon";
import WalletIcon from "@/components/common/icons/WalletIcon";
import SpinIcon from "@/components/common/icons/SpinIcon";
import TasksPage from "@/components/features/tasks/TasksPage";
import { getUrlParams } from "@/lib/telegramRouting";

// Force dynamic rendering since this page uses client-side features
export const dynamic = "force-dynamic";

function HomeShell() {
  const { currentPage, navigate, navigateToGame } = useNavigation();
  const [tg, setTg] = useState<any>(null);
  const [hasCheckedInitialRoute, setHasCheckedInitialRoute] = useState(false);

  const { user, isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    if (tg) return;
    let count = 0;
    const getTg = setInterval(() => {
      // Check if we're in browser environment

      const _tg = window?.Telegram?.WebApp;
      if (_tg) {
        setTg(_tg);
        clearInterval(getTg);
      }

      if (count > 10) {
        clearInterval(getTg);
      }
      count++;
    }, 10000);
  }, []);

  // Handle initial route from Telegram start_param
  useEffect(() => {
    if (hasCheckedInitialRoute || !isAuthenticated) return;

    const urlParams = getUrlParams();
    const route = urlParams.get("route");

    if (route) {
      console.log("Initial route detected:", route);

      // Extract game ID from route (e.g., "/game/quiz" -> "quiz")
      const gameIdMatch = route.match(/^\/game\/([a-z0-9-]+)$/i);
      if (gameIdMatch && gameIdMatch[1]) {
        const gameId = gameIdMatch[1];
        console.log("Navigating to game:", gameId);
        navigateToGame(gameId);
      }
    }

    setHasCheckedInitialRoute(true);
  }, [isAuthenticated, hasCheckedInitialRoute, navigateToGame]);

  const handlePageChange = (page: string) => navigate(page as any);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen tropical-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-4 border-b-4 border-orange-400"></div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginModule />;
  }
  return (
    <div className="h-screen overflow-hidden tropical-gradient">
      <div>
        <div className="max-w-[630px] no-scrollbar mx-auto relative h-screen">
          <div className="flex flex-col no-scrollbar h-full">
            {/* <button
              onClick={() => logout()}
              className="absolute top-6 mt-10 right-6 z-50 w-12 h-12 bg-cover bg-center bg-no-repeat hover:scale-110 transition-all duration-200 shadow-lg"
              style={{
                backgroundImage: "url('/assets/buttons/power-button.png')",
              }}
              title="Logout"
            ></button> */}

            <div className="flex-1 overflow-hidden no-scrollbar">
              {currentPage === "Home" && (
                <HomePage onNavigate={handlePageChange} />
              )}
              {currentPage === "Profile" && <UserProfile tg={tg} />}
              {currentPage === "Tasks" && <TasksPage tg={tg} />}
              {currentPage === "Contest" && <Contest />}
              {currentPage === "Wheel" && <WheelOfFortune />}
              {currentPage === "Game" && <GamesPage />}
              {currentPage === "GameWordle" && <WordleGame />}
              {currentPage === "GameQuiz" && <QuizGame />}
              {currentPage === "GamePuzzle" && <PicturePuzzle />}
              {currentPage === "GameNumGenius" && <PicturePuzzle />}
              {currentPage === "GameCrossWord" && <PicturePuzzle />}
              {currentPage === "Leaderboard" && <LeaderBoard />}
              {currentPage === "Wallet" && <WalletPage />}
            </div>

            <div className=" bottom-0 left-0 right-0 z-50">
              <div className="max-w-[630px] mx-auto px-2 pb-2">
                <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-3xl shadow-2xl border border-purple-700/50">
                  <div className="flex justify-around items-center px-2 py-2">
                    <button
                      onClick={() => handlePageChange("Home")}
                      className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 min-w-[40px] ${
                        currentPage === "Home"
                          ? "bg-pink-500/20 scale-110"
                          : "hover:bg-white/10 hover:scale-105"
                      }`}
                    >
                      <HomeIcon
                        className={`mb-1 transition-all duration-300 ${
                          currentPage === "Home"
                            ? "text-white"
                            : "text-white/50"
                        }`}
                        isActive={currentPage === "Home"}
                        activeColor="#FF309B"
                        color="currentColor"
                        width={16}
                        height={16}
                      />
                      <span
                        className={`text-[9px] font-semibold transition-all duration-300 ${
                          currentPage === "Home"
                            ? "text-white"
                            : "text-white/50"
                        }`}
                      >
                        Home
                      </span>
                    </button>

                    <button
                      onClick={() => handlePageChange("Wheel")}
                      className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 min-w-[40px] ${
                        currentPage === "Wheel"
                          ? "bg-pink-500/20 scale-110"
                          : "hover:bg-white/10 hover:scale-105"
                      }`}
                    >
                      <SpinIcon
                        className={`mb-1 transition-all duration-300 ${
                          currentPage === "Wheel"
                            ? "text-white"
                            : "text-white/50"
                        }`}
                        isActive={currentPage === "Wheel"}
                        activeColor="#FF309B"
                        color="currentColor"
                        width={16}
                        height={16}
                      />
                      <span
                        className={`text-[9px] font-semibold transition-all duration-300 ${
                          currentPage === "Wheel"
                            ? "text-white"
                            : "text-white/50"
                        }`}
                      >
                        Spin
                      </span>
                    </button>

                    <button
                      onClick={() => handlePageChange("Game")}
                      className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 min-w-[40px] ${
                        currentPage === "Game"
                          ? "bg-pink-500/20 scale-110"
                          : "hover:bg-white/10 hover:scale-105"
                      }`}
                    >
                      <GameIcon
                        className={`mb-1 transition-all duration-300 ${
                          currentPage === "Game"
                            ? "text-white"
                            : "text-white/50"
                        }`}
                        isActive={currentPage === "Game"}
                        activeColor="#FF309B"
                        color="currentColor"
                        width={16}
                        height={16}
                      />
                      <span
                        className={`text-[9px] font-semibold transition-all duration-300 ${
                          currentPage === "Game"
                            ? "text-white"
                            : "text-white/50"
                        }`}
                      >
                        Game
                      </span>
                    </button>

                    <button
                      onClick={() => handlePageChange("Leaderboard")}
                      className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 min-w-[40px] ${
                        currentPage === "Leaderboard"
                          ? "bg-pink-500/20 scale-110"
                          : "hover:bg-white/10 hover:scale-105"
                      }`}
                    >
                      <RankIcon
                        className={`mb-1 transition-all duration-300 ${
                          currentPage === "Leaderboard"
                            ? "text-white"
                            : "text-white/50"
                        }`}
                        isActive={currentPage === "Leaderboard"}
                        activeColor="#FF309B"
                        color="currentColor"
                        width={16}
                        height={16}
                      />
                      <span
                        className={`text-[9px] font-semibold transition-all duration-300 ${
                          currentPage === "Leaderboard"
                            ? "text-white"
                            : "text-white/50"
                        }`}
                      >
                        Rank
                      </span>
                    </button>

                    <button
                      onClick={() => handlePageChange("Wallet")}
                      className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 min-w-[40px] ${
                        currentPage === "Wallet"
                          ? "bg-pink-500/20 scale-110"
                          : "hover:bg-white/10 hover:scale-105"
                      }`}
                    >
                      <WalletIcon
                        className={`mb-1 transition-all duration-300 ${
                          currentPage === "Wallet"
                            ? "text-white"
                            : "text-white/50"
                        }`}
                        isActive={currentPage === "Wallet"}
                        activeColor="#FF309B"
                        color="currentColor"
                        width={16}
                        height={16}
                      />
                      <span
                        className={`text-[9px] font-semibold transition-all duration-300 ${
                          currentPage === "Wallet"
                            ? "text-white"
                            : "text-white/50"
                        }`}
                      >
                        Wallet
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <NavigationProvider>
      <HomeShell />
    </NavigationProvider>
  );
}
