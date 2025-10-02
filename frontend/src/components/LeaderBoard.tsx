"use client"

import { useState } from "react"
import { useAuth } from "@/app/contexts/AuthContext"
import { ChevronLeft, ChevronUp, ChevronDown } from "lucide-react"

const LeaderBoard = () => {
  const { user } = useAuth()
  const [leader, setLeader] = useState<any[]>([])

  const mockLeaderboard = [
    {
      username: "Iman",
      name: "Iman",
      totalPoints: 2019,
      level: 67,
      avatar:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Group%20427320572%20%281%29-NPYGoTXVwnq0OZUZH98F4K6Zif1m0d.png",
      trend: null,
    },
    {
      username: "Vatani",
      name: "Vatani",
      totalPoints: 1932,
      level: 6,
      avatar:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Profile%20%283%29-WZPFlfUDkroTDHebxd7DJflTbq8tEn.png",
      trend: "down",
    },
    {
      username: "Jonathan",
      name: "Jonathan",
      totalPoints: 1431,
      level: 64,
      avatar:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Profile%20%284%29-Mk5AX2qudgAhCe4v16HXWhVTL9ItDT.png",
      trend: null,
    },
    { username: "Paul", name: "Paul", totalPoints: 1241, level: 45, avatar: null, trend: null },
    { username: "Robert", name: "Robert", totalPoints: 1051, level: 32, avatar: null, trend: null },
    { username: "Gwen", name: "Gwen", totalPoints: 953, level: 28, avatar: null, trend: "up" },
    { username: "Emma", name: "Emma", totalPoints: 943, level: 27, avatar: null, trend: null },
    { username: "Sophia", name: "Sophia", totalPoints: 914, level: 25, avatar: null, trend: "down" },
    { username: "Mia", name: "Mia", totalPoints: 896, level: 24, avatar: null, trend: "down" },
    { username: "John", name: "John", totalPoints: 848, level: 22, avatar: null, trend: "down" },
  ]

  const leaderboardData = leader.length > 0 ? leader : mockLeaderboard

  const myPos = leaderboardData?.findIndex((ele: any) => {
    return ele.username == user?.username
  })

  const currentUserData = user || { username: "You", name: "You", totalPoints: 432, level: 10 }
  const userPosition = myPos !== -1 ? myPos + 1 : 148

  const stringToColour = (str: any) => {
    if (!str) return "#6366f1"
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const value = (hash >> (str.length * 8)) & 0xff
    const hue = value * 137.508
    return `hsl(${hue},70%,65%)`
  }

  const TopThreePodium = () => {
    const top3 = leaderboardData.slice(0, 3)
    const [first, second, third] = [top3[0], top3[1], top3[2]]

    return (
      <div className="flex items-end justify-center gap-4 mb-8 px-4">
        {/* 2nd Place */}
        {second && (
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-white overflow-hidden bg-white">
                {second.avatar ? (
                  <img
                    src={second.avatar || "/placeholder.svg"}
                    alt={second.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    style={{ background: stringToColour(second.username) }}
                    className="w-full h-full flex items-center justify-center text-2xl font-bold text-white"
                  >
                    {second.name?.slice(0, 1)?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm font-bold border-2 border-[#0A0A1F]">
                2
              </div>
            </div>
            <p className="text-white font-semibold mt-3 text-sm">{second.name}</p>
            <p className="text-gray-400 text-xs">level {second.level}</p>
          </div>
        )}

        {/* 1st Place */}
        {first && (
          <div className="flex flex-col items-center -mt-4">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Group%20427320572%20%281%29-NPYGoTXVwnq0OZUZH98F4K6Zif1m0d.png"
              alt="Winner"
              className="w-32 h-32 mb-2"
            />
            <p className="text-white font-semibold text-base">{first.name}</p>
            <p className="text-gray-400 text-sm">level {first.level}</p>
          </div>
        )}

        {/* 3rd Place */}
        {third && (
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-white overflow-hidden bg-white">
                {third.avatar ? (
                  <img
                    src={third.avatar || "/placeholder.svg"}
                    alt={third.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    style={{ background: stringToColour(third.username) }}
                    className="w-full h-full flex items-center justify-center text-2xl font-bold text-white"
                  >
                    {third.name?.slice(0, 1)?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm font-bold border-2 border-[#0A0A1F]">
                3
              </div>
            </div>
            <p className="text-white font-semibold mt-3 text-sm">{third.name}</p>
            <p className="text-gray-400 text-xs">level {third.level}</p>
          </div>
        )}
      </div>
    )
  }

  const RankingCard = ({ userData, position }: any) => {
    const isTop3 = position <= 3
    let bgColor = "#1A1A3E"

    if (position === 1) bgColor = "#1E2875"
    if (position === 2) bgColor = "#F5F5F5"
    if (position === 3) bgColor = "#E91E8C"

    const textColor = position === 2 ? "#000000" : "#FFFFFF"
    const subTextColor = position === 2 ? "#666666" : "#A0A0C0"

    return (
      <div className="flex items-center px-6 py-4 rounded-full mb-3 mx-4" style={{ backgroundColor: bgColor }}>
        <div className="flex items-center gap-3 flex-1">
          {userData.trend === "up" && <ChevronUp className="w-5 h-5 text-green-500" />}
          {userData.trend === "down" && <ChevronDown className="w-5 h-5 text-red-500" />}
          {!userData.trend && (
            <span className="w-5 h-5 flex items-center justify-center" style={{ color: textColor }}>
              —
            </span>
          )}

          <span className="font-semibold text-lg" style={{ color: textColor }}>
            {position}
          </span>

          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white">
            {userData.avatar ? (
              <img
                src={userData.avatar || "/placeholder.svg"}
                alt={userData.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                style={{ background: stringToColour(userData.username) }}
                className="w-full h-full flex items-center justify-center text-lg font-bold text-white"
              >
                {userData.name?.slice(0, 1)?.toUpperCase()}
              </div>
            )}
          </div>

          <span className="font-semibold text-lg" style={{ color: textColor }}>
            {userData.name}
          </span>
        </div>

        <span className="font-semibold text-lg" style={{ color: textColor }}>
          {userData.totalPoints} pts.
        </span>
      </div>
    )
  }

  const UserRankingCard = () => (
    <div className="flex items-center px-6 py-4 rounded-full mb-3 mx-4 bg-[#0F0F20]">
      <div className="flex items-center gap-3 flex-1">
        <ChevronUp className="w-5 h-5 text-green-500" />
        <span className="font-semibold text-lg text-white">{userPosition}</span>

        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white bg-blue-500 flex items-center justify-center">
          <span className="text-2xl">🤖</span>
        </div>

        <span className="font-semibold text-lg text-white">{currentUserData.name}</span>
      </div>

      <span className="font-semibold text-lg text-white">{currentUserData.totalPoints} pts.</span>
    </div>
  )

  return (
    <div className="w-full min-h-screen bg-[#0A0A1F] text-white pb-8">
      <div className="flex items-center justify-between px-6 py-6">
        <button className="flex items-center gap-2 text-white">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
      </div>

      <h1
        className="text-center text-3xl font-bold tracking-wider mb-8"
        style={{ fontFamily: "monospace", letterSpacing: "0.2em" }}
      >
        LEADER BOARD
      </h1>

      <TopThreePodium />

      <div className="mt-8">
        {leaderboardData.map((userData, index) => (
          <RankingCard key={`${userData.username}-${index}`} userData={userData} position={index + 1} />
        ))}

        {userPosition > 10 && (
          <div className="mt-6">
            <UserRankingCard />
          </div>
        )}
      </div>

      <div className="flex justify-center mt-8">
        <button className="text-white font-semibold flex items-center gap-2 hover:text-gray-300 transition-colors">
          View All
          <ChevronLeft className="w-4 h-4 rotate-180" />
        </button>
      </div>
    </div>
  )
}

export default LeaderBoard
