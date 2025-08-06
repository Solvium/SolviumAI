"use client";
import { GoHome } from "react-icons/go";
import { MdOutlineLeaderboard } from "react-icons/md";
import { useEffect, useState } from "react";
import LeaderBoard from "@/components/LeaderBoard";
import type WebApp from "@twa-dev/sdk";
import UserProfile from "@/components/Profile";
import ContestBoard from "@/components/Contest";
import { Wallet } from "lucide-react";
import WalletPage from "@/components/WalletPage";
import LoginModule from "@/components/auth/LoginModule";
import { useAuth } from "./contexts/AuthContext";
import { SolWheelOfFortune } from "@/components/SolWheel";
import GamesPage from "@/components/games/GamesPage";

function Home() {
  const [selectedTab, setSelectedTab]: any = useState("Home");
  const [tg, setTg] = useState<typeof WebApp | null>(null);

  const { user, isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    if (tg) return;
    let count = 0;
    const getTg = setInterval(() => {
      const _tg = window?.Telegram?.WebApp;
      if (_tg) {
        setTg(_tg);
        clearInterval(getTg);
      }

    

      if (count > 10) {
        clearInterval(getTg);
      }
      count++;
    }, 10000)
  }, []);

  const handlePageChange = (page: string) => {
    setSelectedTab(page);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }



  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginModule />;
  }
  console.log(user);
  return (
    <div className="min-h-screen bg-[#0B0B14]">
      <div>
        <div className="max-w-[430px] no-scrollbar mx-auto relative min-h-screen">
          <div className="flex flex-col no-scrollbar h-screen">
            <button onClick={() => logout()}>Logout</button>
            <div className="flex-1 overflow-y-auto no-scrollbar pb-20 h-[90vh]">
              {selectedTab === "Home" && <UserProfile tg={tg} />}
              {selectedTab === "Contest" && <ContestBoard />}
              {selectedTab === "Wheel" && <SolWheelOfFortune />}
              {selectedTab === "Game" && <GamesPage />}
              {selectedTab === "Leaderboard" && <LeaderBoard />}
              {selectedTab === "Wallet" && <WalletPage />}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-[#151524] border-t border-[#2A2A45] shadow-glow-blue">
              <div className="max-w-[430px] mx-auto">
                <div className="flex justify-around items-center px-4 py-2">
                  <button
                    onClick={() => handlePageChange("Home")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                      selectedTab === "Home"
                        ? "text-[#4C6FFF] bg-[#1A1A2F] shadow-glow-sm"
                        : "text-[#8E8EA8] hover:text-[#4C6FFF] hover:bg-[#1A1A2F]/50"
                    }`}
                  >
                    <GoHome className="text-2xl mb-1" />
                    <span className="text-xs">Profile</span>
                  </button>

                  <button
                    onClick={() => handlePageChange("Wheel")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                      selectedTab === "Wheel"
                        ? "text-[#4C6FFF] bg-[#1A1A2F] shadow-glow-sm"
                        : "text-[#8E8EA8] hover:text-[#4C6FFF] hover:bg-[#1A1A2F]/50"
                    }`}
                  >
                    <svg
                      className="w-6 h-6 mb-1"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 3V12L17 15"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="text-xs">Wheel</span>
                  </button>

                  <button
                    onClick={() => handlePageChange("Game")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                      selectedTab === "Game"
                        ? "text-[#4C6FFF] bg-[#1A1A2F] shadow-glow-sm"
                        : "text-[#8E8EA8] hover:text-[#4C6FFF] hover:bg-[#1A1A2F]/50"
                    }`}
                  >
                    <svg
                      className="w-6 h-6 mb-1"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6 11H10M8 9V13"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <circle cx="15" cy="11" r="1" fill="currentColor" />
                      <circle cx="18" cy="13" r="1" fill="currentColor" />
                      <path
                        d="M3 7C3 4.79086 4.79086 3 7 3H17C19.2091 3 21 4.79086 21 7V17C21 19.2091 19.2091 21 17 21H7C4.79086 21 3 19.2091 3 17V7Z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                    <span className="text-xs">Game</span>
                  </button>

                  <button
                    onClick={() => handlePageChange("Leaderboard")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                      selectedTab === "Leaderboard"
                        ? "text-[#4C6FFF] bg-[#1A1A2F] shadow-glow-sm"
                        : "text-[#8E8EA8] hover:text-[#4C6FFF] hover:bg-[#1A1A2F]/50"
                    }`}
                  >
                    <MdOutlineLeaderboard className="text-2xl mb-1" />
                    <span className="text-xs">Ranks</span>
                    </button>
                    <button
                    onClick={() => handlePageChange("Wallet")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                      selectedTab === "Wallet"
                        ? "text-[#4C6FFF] bg-[#1A1A2F] shadow-glow-sm"
                        : "text-[#8E8EA8] hover:text-[#4C6FFF] hover:bg-[#1A1A2F]/50"
                    }`}
                  >
                    <Wallet className="text-2xl mb-1" />
                    <span className="text-xs">Wallet</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
