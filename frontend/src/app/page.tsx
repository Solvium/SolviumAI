"use client"
import { GoHome } from "react-icons/go"
import { MdOutlineLeaderboard } from "react-icons/md"
import { useEffect, useState } from "react"
import LeaderBoard from "@/components/LeaderBoard"
import type WebApp from "@twa-dev/sdk"
import UserProfile from "@/components/Profile"
import ContestBoard from "@/components/Contest"
import { Wallet } from "lucide-react"
import WalletPage from "@/components/WalletPage"
import LoginModule from "@/components/auth/LoginModule"
import { useAuth } from "./contexts/AuthContext"
import GamesPage from "@/components/games/GamesPage"
import { WheelOfFortune } from "@/components/Wheel"
import { LogOut } from "lucide-react"

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
    <div className="min-h-screen tropical-gradient">
      <div>
        <div className="max-w-[430px] no-scrollbar mx-auto relative min-h-screen">
          <div className="flex flex-col no-scrollbar h-screen">
            <button
              onClick={() => logout()}
              className="absolute top-6 right-6 z-50 p-3 bg-blue-500/90 backdrop-blur-sm text-white rounded-full hover:bg-red-600 transition-all duration-200 shadow-lg border-2 border-white/20"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-20 h-[90vh]">
              {selectedTab === "Home" && <UserProfile tg={tg} />}
              {selectedTab === "Contest" && <ContestBoard />}
              {selectedTab === "Wheel" && <WheelOfFortune />}
              {selectedTab === "Game" && <GamesPage />}
              {selectedTab === "Leaderboard" && <LeaderBoard />}
              {selectedTab === "Wallet" && <WalletPage />}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white/20 backdrop-blur-md border-t-2 border-blue-200/30">
              <div className="max-w-[430px] mx-auto">
                <div className="flex justify-around items-center px-2 py-3">
                  <button
                    onClick={() => handlePageChange("Home")}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 ${
                      selectedTab === "Home"
                        ? "bg-orange-400 text-white shadow-lg scale-110"
                        : "text-blue-800 hover:bg-white/20 hover:scale-105"
                    }`}
                  >
                    <GoHome className="text-2xl mb-1" />
                    <span className="text-xs font-semibold">Profile</span>
                  </button>

                  <button
                    onClick={() => handlePageChange("Wheel")}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 ${
                      selectedTab === "Wheel"
                        ? "bg-orange-400 text-white shadow-lg scale-110"
                        : "text-blue-800 hover:bg-white/20 hover:scale-105"
                    }`}
                  >
                    <svg className="w-6 h-6 mb-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                      <path d="M12 3V12L17 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className="text-xs font-semibold">Wheel</span>
                  </button>

                  <button
                    onClick={() => handlePageChange("Game")}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 ${
                      selectedTab === "Game"
                        ? "bg-orange-400 text-white shadow-lg scale-110"
                        : "text-blue-800 hover:bg-white/20 hover:scale-105"
                    }`}
                  >
                    <svg className="w-6 h-6 mb-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 11H10M8 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="15" cy="11" r="1" fill="currentColor" />
                      <circle cx="18" cy="13" r="1" fill="currentColor" />
                      <path
                        d="M3 7C3 4.79086 4.79086 3 7 3H17C19.2091 3 21 4.79086 21 7V17C21 19.2091 19.2091 21 17 21H7C4.79086 21 3 19.2091 3 17V7Z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                    <span className="text-xs font-semibold">Game</span>
                  </button>

                  <button
                    onClick={() => handlePageChange("Leaderboard")}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 ${
                      selectedTab === "Leaderboard"
                        ? "bg-orange-400 text-white shadow-lg scale-110"
                        : "text-blue-800 hover:bg-white/20 hover:scale-105"
                    }`}
                  >
                    <MdOutlineLeaderboard className="text-2xl mb-1" />
                    <span className="text-xs font-semibold">Ranks</span>
                  </button>

                  <button
                    onClick={() => handlePageChange("Wallet")}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 ${
                      selectedTab === "Wallet"
                        ? "bg-orange-400 text-white shadow-lg scale-110"
                        : "text-blue-800 hover:bg-white/20 hover:scale-105"
                    }`}
                  >
                    <Wallet className="text-2xl mb-1" />
                    <span className="text-xs font-semibold">Wallet</span>
                  </button>
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
