"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, ChevronUp, ChevronDown } from "lucide-react";

const LeaderBoard = () => {
  const { user } = useAuth();
  const [leader, setLeader] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real leaderboard data
  const fetchLeaderboard = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      // Force fresh fetch by adding cache-busting timestamp
      const response = await fetch(`/api/leaderboard`);

      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard");
      }
      const data = await response.json();
      if (!data?.success) {
        throw new Error(data?.error || "Leaderboard API error");
      }
      const toNum = (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };
      const sorted = Array.isArray(data.leaderboard)
        ? [...data.leaderboard].sort((a: any, b: any) => {
            const aSolv = toNum(a.totalSOLV);
            const bSolv = toNum(b.totalSOLV);
            return bSolv - aSolv; // always sort by SOLV only
          })
        : [];
      setLeader(sorted);
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch leaderboard"
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Fetch on mount and set up auto-refresh
  useEffect(() => {
    fetchLeaderboard(true);
  }, []);

  // Use real data if available, otherwise show empty state or error
  const leaderboardData = leader.length > 0 ? leader : [];

  const myPos = leaderboardData?.findIndex((ele: any) => {
    return ele.username == user?.username;
  });

  const currentUserData = {
    username: user?.username ?? "You",
    name:
      // prefer explicit name-like fields if present
      (user as any)?.name ||
      (user as any)?.firstName ||
      user?.username ||
      "You",
    totalSOLV: (user as any)?.totalSOLV ?? 0,
    level: (user as any)?.level ?? 1,
  };
  const userPosition = myPos !== -1 ? myPos + 1 : 148;

  const stringToColour = (str: any) => {
    if (!str) return "#6366f1";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const value = (hash >> (str.length * 8)) & 0xff;
    const hue = value * 137.508;
    return `hsl(${hue},70%,65%)`;
  };

  const TopThreePodium = () => {
    const top3 = leaderboardData.slice(0, 3);
    const [first, second, third] = [top3[0], top3[1], top3[2]];

    return (
      <div className="flex items-end justify-center gap-4 mb-8 px-4">
        {/* 2nd Place */}
        {second && (
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="md:w-20 md:h-20 w-16 h-16 rounded-full border-4 border-white overflow-hidden bg-white">
                {second.avatar_url || second.avatar ? (
                  <img
                    src={
                      second.avatar_url || second.avatar || "/placeholder.svg"
                    }
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
            <p
              className="text-white font-semibold mt-3 text-sm truncate max-w-[80px]"
              title={second.name}
            >
              {second.name}
            </p>
            <p className="text-gray-400 text-xs">level {second.level ?? 1}</p>
          </div>
        )}

        {/* 1st Place */}
        {first && (
          <div className="flex flex-col items-center -mt-4">
            <div className="md:w-32 md:h-32 w-20 h-20 rounded-full border-4 border-yellow-400 overflow-hidden bg-white mb-2">
              {first.avatar_url || first.avatar ? (
                <img
                  src={first.avatar_url || first.avatar || "/placeholder.svg"}
                  alt={first.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  style={{ background: stringToColour(first.username) }}
                  className="w-full h-full flex items-center justify-center text-4xl font-bold text-white"
                >
                  {first.name?.slice(0, 1)?.toUpperCase()}
                </div>
              )}
            </div>
            <p
              className="text-white font-semibold text-base truncate max-w-[100px]"
              title={first.name}
            >
              {first.name}
            </p>
            <p className="text-gray-400 text-sm">level {first.level ?? 1}</p>
          </div>
        )}

        {/* 3rd Place */}
        {third && (
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="md:w-20 md:h-20 w-16 h-16 rounded-full border-4 border-white overflow-hidden bg-white">
                {third.avatar_url || third.avatar ? (
                  <img
                    src={third.avatar_url || third.avatar || "/placeholder.svg"}
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
            <p
              className="text-white font-semibold mt-3 text-sm truncate max-w-[80px]"
              title={third.name}
            >
              {third.name}
            </p>
            <p className="text-gray-400 text-xs">level {third.level ?? 1}</p>
          </div>
        )}
      </div>
    );
  };

  const RankingCard = ({ userData, position }: any) => {
    const isTop3 = position <= 3;
    let bgColor = "#1A1A3E";

    if (position === 1) bgColor = "#1E2875";
    if (position === 2) bgColor = "#F5F5F5";
    if (position === 3) bgColor = "#E91E8C";

    const textColor = position === 2 ? "#000000" : "#FFFFFF";
    const subTextColor = position === 2 ? "#666666" : "#A0A0C0";

    return (
      <div
        className="flex items-center px-6 py-4 rounded-full mb-3 mx-4"
        style={{ backgroundColor: bgColor }}
      >
        <div className="flex items-center gap-3 flex-1">
          {userData.trend === "up" && (
            <ChevronUp className="md:w-5 md:h-5 w-3 h-3 text-green-500" />
          )}
          {userData.trend === "down" && (
            <ChevronDown className="md:w-5 md:h-5 w-3 h-3 text-red-500" />
          )}
          {!userData.trend && (
            <span
              className="md:w-5 md:h-5 w-3 h-3 flex items-center justify-center"
              style={{ color: textColor }}
            >
              —
            </span>
          )}

          <span
            className="font-semibold md:text-lg text-sm"
            style={{ color: textColor }}
          >
            {position}
          </span>

          <div className="md:w-12 md:h-12 w-10 h-10 rounded-full overflow-hidden border-2 border-white">
            {userData.avatar_url || userData.avatar ? (
              <img
                src={
                  userData.avatar_url || userData.avatar || "/placeholder.svg"
                }
                alt={userData.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                style={{ background: stringToColour(userData.username) }}
                className="w-full h-full flex items-center justify-center md:text-lg text-sm font-bold text-white"
              >
                {userData.name?.slice(0, 1)?.toUpperCase()}
              </div>
            )}
          </div>

          <span
            className="font-semibold md:text-lg text-sm truncate max-w-[120px]"
            style={{ color: textColor }}
            title={userData.name}
          >
            {userData.name}
          </span>
        </div>

        <span
          className="font-semibold md:text-lg text-xs"
          style={{ color: textColor }}
        >
          {userData.totalSOLV || 0} SOLV
        </span>
      </div>
    );
  };

  const UserRankingCard = () => (
    <div className="flex items-center px-6 py-4 rounded-full mb-3 mx-4 bg-[#0F0F20]">
      <div className="flex items-center gap-3 flex-1">
        <ChevronUp className="md:w-5 md:h-5 w-3 h-3 text-green-500" />
        <span className="font-semibold md:text-lg text-sm text-white">
          {userPosition}
        </span>

        <div className="md:w-12 md:h-12 w-10 h-10 rounded-full overflow-hidden border-2 border-white">
          {user?.avatar_url || user?.avatar ? (
            <img
              src={user.avatar_url || user.avatar || "/placeholder.svg"}
              alt={currentUserData.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              style={{ background: stringToColour(user?.username || "user") }}
              className="w-full h-full flex items-center justify-center text-lg font-bold text-white"
            >
              {currentUserData.name?.slice(0, 1)?.toUpperCase()}
            </div>
          )}
        </div>

        <span
          className="font-semibold md:text-lg text-sm text-white truncate max-w-[120px]"
          title={currentUserData.name}
        >
          {(("name" in currentUserData) as any)
            ? currentUserData.name
            : currentUserData.username}
        </span>
      </div>

      <span className="font-semibold md:text-lg text-xs text-white">
        {currentUserData.totalSOLV} SOLV
      </span>
    </div>
  );

  // Show loading state
  if (loading) {
    return (
      <div className="w-full min-h-screen bg-[#040022] text-white pb-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-orange-400 mx-auto mb-4"></div>
          <p className="text-lg">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="w-full min-h-screen bg-[#040022] text-white pb-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-400 mb-4">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show empty state
  if (leaderboardData.length === 0) {
    return (
      <div className="w-full min-h-screen bg-[#040022] text-white pb-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-400">No leaderboard data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-[#040022] text-white overflow-y-auto">
      {/* Fixed Header with Background */}
      <div
        className="sticky top-0 z-30 bg-gradient-to-b from-[#040022] via-[#040022] to-[#040022]/95 backdrop-blur-sm px-4 pt-6 pb-1
      "
      >
        <div className="relative min-h-[40px] md:min-h-[50px]">
          <div className="absolute top-0 left-0 z-20">
            {/* <button
              className="flex items-center md:gap-2 gap-1 text-white hover:text-purple-300 transition-colors"
            >
              <ChevronLeft className="md:w-4 md:h-4 w-3 h-3" />
              <span className="md:text-sm text-xs font-semibold">Back</span>
            </button> */}
          </div>

          <div
            className="absolute top-0 md:right-4 
          left-16
           z-20"
          >
            <h1
              className="text-2xl md:text-4xl font-bold text-white tracking-[0.3em] drop-shadow-2xl whitespace-nowrap"
              style={{
                fontFamily: "'Pixelify Sans', monospace",
                letterSpacing: "0.1em",
              }}
            >
              LEADER BOARD
            </h1>
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <TopThreePodium />

        <div className="mt-8 pb-24">
          {leaderboardData.map((userData, index) => (
            <RankingCard
              key={`${userData.username}-${index}`}
              userData={userData}
              position={index + 1}
            />
          ))}

          {userPosition > 10 && (
            <div className="mt-6">
              <UserRankingCard />
            </div>
          )}

          <div className="flex justify-center mt-8">
            <button className="text-white font-semibold flex items-center gap-2 hover:text-gray-300 transition-colors">
              View All
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderBoard;
