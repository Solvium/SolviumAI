"use client"
import { useEffect, useState } from "react"
import LeaderBoard from "@/components/LeaderBoard"
import type WebApp from "@twa-dev/sdk"
import UserProfile from "@/components/Profile"
import Contest from "@/components/Contest"
import WalletPage from "@/components/WalletPage"
import LoginModule from "@/components/auth/LoginModule"
import { useAuth } from "./contexts/AuthContext"
import GamesPage from "@/components/games/GamesPage"
import { WheelOfFortune } from "@/components/Wheel"
import HomePage from "@/components/HomePage"
import Image from "next/image"
import TasksPage from "@/components/TasksPage"

// Force dynamic rendering since this page uses client-side features
export const dynamic = "force-dynamic"

function Home() {
  const [selectedTab, setSelectedTab]: any = useState("Home")
  const [tg, setTg] = useState<typeof WebApp | null>(null)

  const { user, isAuthenticated, isLoading, logout } = useAuth()

  useEffect(() => {
    if (tg) return
    let count = 0
    const getTg = setInterval(() => {
      // Check if we're in browser environment

      const _tg = window?.Telegram?.WebApp
      if (_tg) {
        setTg(_tg)
        clearInterval(getTg)
      }

      if (count > 10) {
        clearInterval(getTg)
      }
      count++
    }, 10000)
  }, [])

  const handlePageChange = (page: string) => {
    setSelectedTab(page)
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen tropical-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-4 border-b-4 border-orange-400"></div>
      </div>
    )
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginModule />
  }
  return (
    <div className="max-h-screen tropical-gradient">
      <div>
        <div className="max-w-[430px] no-scrollbar mx-auto relative min-h-screen">
          <div className="flex flex-col no-scrollbar h-screen">
            {/* <button
              onClick={() => logout()}
              className="absolute top-6 mt-10 right-6 z-50 w-12 h-12 bg-cover bg-center bg-no-repeat hover:scale-110 transition-all duration-200 shadow-lg"
              style={{
                backgroundImage: "url('/assets/buttons/power-button.png')",
              }}
              title="Logout"
            ></button> */}

            <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
              {selectedTab === "Home" && <HomePage onNavigate={handlePageChange} />}
              {selectedTab === "Profile" && <UserProfile tg={tg} />}
              {selectedTab === "Tasks" && <TasksPage tg={tg} />}
              {selectedTab === "Contest" && <Contest />}
              {selectedTab === "Wheel" && <WheelOfFortune />}
              {selectedTab === "Game" && <GamesPage />}
              {selectedTab === "Leaderboard" && <LeaderBoard />}
              {selectedTab === "Wallet" && <WalletPage />}
            </div>

            <div className="fixed bottom-0 left-0 right-0">
              <div className="max-w-[430px] mx-auto px-4 pb-4">
                <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-3xl shadow-2xl border border-purple-700/50">
                  <div className="flex justify-around items-center px-4 py-3">
                    <button
                      onClick={() => handlePageChange("Home")}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 min-w-[60px] ${
                        selectedTab === "Home" ? "bg-pink-500/20 scale-110" : "hover:bg-white/10 hover:scale-105"
                      }`}
                    >
                      <Image
                        src={
                          selectedTab === "Home"
                            ? "/assets/navigation/home-active.svg"
                            : "/assets/navigation/home-inactive.svg"
                        }
                        alt="Home"
                        width={28}
                        height={28}
                        className="w-7 h-7 mb-1 transition-all duration-300"
                      />
                      <span
                        className={`text-xs font-semibold transition-all duration-300 ${
                          selectedTab === "Home" ? "text-pink-400" : "text-white/70"
                        }`}
                      >
                        Home
                      </span>
                    </button>

                    <button
                      onClick={() => handlePageChange("Wheel")}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 min-w-[60px] ${
                        selectedTab === "Wheel" ? "bg-pink-500/20 scale-110" : "hover:bg-white/10 hover:scale-105"
                      }`}
                    >
                      <Image
                        src={
                          selectedTab === "Wheel"
                            ? "/assets/navigation/spin-active.png"
                            : "/assets/navigation/spin-inactive.png"
                        }
                        alt="Spin"
                        width={28}
                        height={28}
                        className="w-7 h-7 mb-1 transition-all duration-300"
                      />
                      <span
                        className={`text-xs font-semibold transition-all duration-300 ${
                          selectedTab === "Wheel" ? "text-pink-400" : "text-white/70"
                        }`}
                      >
                        Spin
                      </span>
                    </button>

                    <button
                      onClick={() => handlePageChange("Game")}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 min-w-[60px] ${
                        selectedTab === "Game" ? "bg-pink-500/20 scale-110" : "hover:bg-white/10 hover:scale-105"
                      }`}
                    >
                      <Image
                        src={
                          selectedTab === "Game"
                            ? "/assets/navigation/game-active.png"
                            : "/assets/navigation/game-inactive.png"
                        }
                        alt="Game"
                        width={28}
                        height={28}
                        className="w-7 h-7 mb-1 transition-all duration-300"
                      />
                      <span
                        className={`text-xs font-semibold transition-all duration-300 ${
                          selectedTab === "Game" ? "text-pink-400" : "text-white/70"
                        }`}
                      >
                        Game
                      </span>
                    </button>

                    <button
                      onClick={() => handlePageChange("Leaderboard")}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 min-w-[60px] ${
                        selectedTab === "Leaderboard" ? "bg-pink-500/20 scale-110" : "hover:bg-white/10 hover:scale-105"
                      }`}
                    >
                      <Image
                        src={
                          selectedTab === "Leaderboard"
                            ? "/assets/navigation/rank-active.png"
                            : "/assets/navigation/rank-inactive.png"
                        }
                        alt="Rank"
                        width={28}
                        height={28}
                        className="w-7 h-7 mb-1 transition-all duration-300"
                      />
                      <span
                        className={`text-xs font-semibold transition-all duration-300 ${
                          selectedTab === "Leaderboard" ? "text-pink-400" : "text-white/70"
                        }`}
                      >
                        Rank
                      </span>
                    </button>

                    <button
                      onClick={() => handlePageChange("Wallet")}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 min-w-[60px] ${
                        selectedTab === "Wallet" ? "bg-pink-500/20 scale-110" : "hover:bg-white/10 hover:scale-105"
                      }`}
                    >
                      <Image
                        src="/assets/navigation/wallet-active.png"
                        alt="Wallet"
                        width={28}
                        height={28}
                        className="w-7 h-7 mb-1 transition-all duration-300"
                      />
                      <span
                        className={`text-xs font-semibold transition-all duration-300 ${
                          selectedTab === "Wallet" ? "text-pink-400" : "text-white/70"
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
  )
}

export default Home
