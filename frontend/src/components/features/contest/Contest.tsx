"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trophy, ChevronLeft, Coins, Gift, Sparkles } from "lucide-react";

const Contest = () => {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState({
    days: 3,
    hours: 12,
  });

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newHours = prev.hours - 1;
        const newDays = newHours < 0 ? prev.days - 1 : prev.days;

        return {
          days: newDays < 0 ? 7 : newDays,
          hours: newHours < 0 ? 23 : newHours,
        };
      });
    }, 3600000); // Update every hour

    return () => clearInterval(timer);
  }, []);

  // Top 3 podium data
  const topThree = [
    {
      rank: 2,
      username: "CyberNinja",
      initials: "CN",
      points: 8450,
      color: "border-gray-400",
      bgColor: "bg-gray-400/10",
    },
    {
      rank: 1,
      username: "Clinton2965",
      initials: "👤",
      points: 9875,
      color: "border-[#FFDA47]",
      bgColor: "bg-gradient-to-br from-[#FFDA42] to-[#FFA200]",
      isWinner: true,
    },
    {
      rank: 3,
      username: "ByteWarrior",
      initials: "BW",
      points: 7320,
      color: "border-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  // Leaderboard data (positions 4-8)
  const leaderboard = [
    { rank: 4, username: "PixelMaster", initials: "PM", points: 6890, color: "border-purple-400" },
    { rank: 5, username: "NeonDreamer", initials: "ND", points: 6245, color: "border-blue-400" },
    { rank: 6, username: "CodePhantom", initials: "CP", points: 5987, color: "border-cyan-400" },
    { rank: 7, username: "GlitchHero", initials: "GH", points: 5634, color: "border-green-400" },
    { rank: 8, username: "DataWizard", initials: "DW", points: 5321, color: "border-cyan-400" },
  ];

  // Rewards data
  const rewards = [
    {
      icon: <Coins className="w-8 h-8" />,
      title: "Bonus Coins",
      description: "1000+ coins for top 3",
      gradient: "from-pink-500 to-purple-600",
      borderColor: "border-pink-500",
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "More mining",
      description: "Rare digital collectibles",
      gradient: "from-blue-500 to-cyan-500",
      borderColor: "border-blue-500",
    },
    {
      icon: <Gift className="w-8 h-8" />,
      title: "Free Game",
      description: "Get lucky in your next game",
      gradient: "from-cyan-400 to-blue-500",
      borderColor: "border-cyan-400",
    },
  ];

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-[#0a0a1f] via-[#0f0f2e] to-[#1a1a3e] text-white overflow-hidden">
      {/* Header - Fixed */}
      <header className="sticky top-0 z-10 bg-gradient-to-b from-[#0a0a1f] to-[#0f0f2e] p-4 flex items-center justify-between border-b border-purple-500/20">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white hover:text-cyan-400 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>

        {/* Timer Badge */}
        <div className="border-2 border-purple-500/50 rounded-2xl px-4 py-2 bg-purple-900/20">
          <div className="text-xs text-gray-400 text-center">Ends in</div>
          <div className="text-lg font-bold text-center">
            {timeLeft.days}d {timeLeft.hours}h
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-2 pb-20">
        {/* Title */}
        <h1 className="text-4xl font-bold mb-2 tracking-wider" style={{ fontFamily: 'monospace' }}>
          <span className="text-[#1C97D8]">WEEKLY</span>
          <br />
          <span className="text-[#1C97D8]">CONTESTS</span>
        </h1>
        <p className="text-gray-400 text-xs mb-6">
          Compete in tasks & games. Reach the top. Win rewards!
        </p>

        {/* Top 3 Podium */}
        <div className="flex items-end justify-center gap-2 mb-6 px-2">
          {topThree.map((player, idx) => (
            <div
              key={player.rank}
              className={`flex flex-col items-center ${idx === 1 ? "flex-1" : "flex-1"}`}
            >
              {/* Avatar */}
              <div
                className={`w-14 h-14 rounded-full ${player.bgColor} border-2 ${player.color} flex items-center justify-center mb-2 text-lg font-bold`}
              >
                {player.initials}
              </div>

              {/* Username */}
              <div className="text-xs font-medium mb-1 text-center truncate w-full px-1">
                {player.username}
              </div>

              {/* Points */}
              <div className="text-yellow-400 font-bold text-sm mb-2">
                {player.points.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400 mb-2">points</div>

              {/* Podium */}
              <div
                className={`w-full rounded-t-xl border-2 ${player.color} ${player.bgColor} flex items-center justify-center transition-all ${
                  idx === 1 ? "h-32" : idx === 0 ? "h-24" : "h-20"
                }`}
              >
                <Trophy
                  className={`${idx === 1 ? "w-12 h-12" : "w-10 h-10"} ${
                    idx === 1 ? "text-yellow-400" : idx === 0 ? "text-gray-300" : "text-orange-400"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Leaderboard Positions 4-8 */}
        <div className="space-y-3 mb-6">
          {leaderboard.map((player) => (
            <div
              key={player.rank}
              className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-2 border-cyan-500/50 rounded-2xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="text-xl font-bold text-white">#{player.rank}</div>
                <div
                  className={`w-10 h-10 rounded-full border-2 ${player.color} bg-gray-800/50 flex items-center justify-center text-sm font-bold`}
                >
                  {player.initials}
                </div>
                <div className="font-medium">{player.username}</div>
              </div>
              <div className="text-cyan-400 font-bold text-lg">
                {player.points.toLocaleString()}
                <span className="text-xs text-gray-400 ml-1">pts</span>
              </div>
            </div>
          ))}
        </div>

        {/* Progress Section with Rank Badge */}
        <div className="bg-[#1a1a3e]/60 border-2 border-[#5555ff]/50 rounded-3xl p-6 mb-6 relative backdrop-blur-sm">
          {/* Your Rank Badge - Positioned at top */}
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-[#1C97D8] rounded-full px-5 py-2.5 text-center font-bold text-xs text-black whitespace-nowrap">
            Your Rank: #12 — Keep going!
          </div>

          <div className="flex items-start justify-between mb-5 mt-2">
            <div>
              <div className="text-[#00d4ff] text-[11px] font-bold mb-0.5 flex items-center gap-1.5" style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                <span className="text-green-400 text-sm">✓</span> YOUR CONTEST
              </div>
              <div className="text-[#00d4ff] text-[11px] font-bold" style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>PROGRESS</div>
            </div>
            <div className="text-3xl font-bold text-[#1C97D8]">68%</div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-[#0a0a1e] rounded-full overflow-hidden mb-6">
            <div className="h-full bg-[#1C97D8] rounded-full" style={{ width: "68%" }}></div>
          </div>

          {/* Stats */}
          <div className="flex justify-between items-center">
            <div className="text-left">
              <div className="text-2xl font-bold text-[#1C97D8] mb-1">1,245</div>
              <div className="text-[11px] text-gray-400">Solv Point Gained</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-[#1C97D8] mb-1">18/25</div>
              <div className="text-[11px] text-gray-400">Tasks Done</div>
            </div>
          </div>
        </div>

        {/* Top 3 Rewards Section */}
        <div className="mb-6">
          <h2 className="text-center text-xl font-bold mb-4 flex items-center justify-center gap-2" style={{ fontFamily: 'monospace' }}>
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="tracking-wider">TOP 3 REWARDS</span>
            <Trophy className="w-5 h-5 text-yellow-400" />
          </h2>

          <div className="grid grid-cols-3 gap-3">
            {/* Bonus Coins - Pink/Purple */}
            <div className="bg-gradient-to-br from-pink-500/20 to-purple-600/20 border-2 border-pink-500 rounded-2xl p-4 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-purple-600/5"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-full bg-pink-500/20 border-2 border-pink-500 flex items-center justify-center mb-3 mx-auto">
                  <Coins className="w-6 h-6 text-pink-400" />
                </div>
                <h3 className="font-bold text-sm mb-2 text-pink-300">Bonus<br/>Coins</h3>
                <p className="text-xs text-gray-300 leading-tight">1000+<br/>coins for<br/>top 3</p>
              </div>
            </div>

            {/* More Mining - Blue */}
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-2 border-blue-500 rounded-2xl p-4 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center mb-3 mx-auto">
                  <Sparkles className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="font-bold text-sm mb-2 text-blue-300">More<br/>mining</h3>
                <p className="text-xs text-gray-300 leading-tight">Rare digital<br/>collectibles</p>
              </div>
            </div>

            {/* Free Game - Cyan */}
            <div className="bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border-2 border-cyan-400 rounded-2xl p-4 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 to-blue-500/5"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-full bg-cyan-400/20 border-2 border-cyan-400 flex items-center justify-center mb-3 mx-auto">
                  <Gift className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="font-bold text-sm mb-2 text-cyan-300">Free<br/>Game</h3>
                <p className="text-xs text-gray-300 leading-tight">Get lucky in<br/>your next<br/>game</p>
              </div>
            </div>
          </div>
        </div>

        {/* Join Button */}
        <button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 rounded-2xl mb-4 flex items-center justify-center gap-2 text-sm transition-all shadow-lg shadow-blue-500/50">
          <Sparkles className="w-5 h-5" />
          JOIN MORE CONTESTS
        </button>

        {/* Footer Text */}
        <p className="text-center text-gray-400 text-xs px-4">
          Complete tasks, play games, earn points + Climb the leaderboard.
        </p>
      </main>
    </div>
  );
};

export default Contest;
