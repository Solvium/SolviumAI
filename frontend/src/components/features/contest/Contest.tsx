"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trophy, ChevronLeft, Coins, Gift, Sparkles, Zap, Shield } from "lucide-react";
import { useNavigation } from "@/contexts/NavigationContext";
import { useAuth } from "@/contexts/AuthContext";

interface LeaderboardEntry {
  rank: number;
  username: string;
  name?: string;
  points: number;
  userId: number;
}

const Contest = () => {
  const router = useRouter();
  const { goBack } = useNavigation();
  const { user } = useAuth();
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Compute time remaining to next Sunday midnight (local time)
  useEffect(() => {
    function nextSundayMidnightUTC(): number {
      const now = new Date();
      const utcDay = now.getUTCDay(); // 0 = Sunday (UTC)
      const daysUntilSunday = (7 - utcDay) % 7 || 7; // always upcoming Sunday
      // Build a UTC midnight date
      const targetUTC = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
      ));
      targetUTC.setUTCDate(targetUTC.getUTCDate() + daysUntilSunday);
      return targetUTC.getTime();
    }

    const update = () => {
      const targetMs = nextSundayMidnightUTC();
      const nowMs = Date.now();
      let diff = Math.max(0, targetMs - nowMs);
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      diff -= days * 24 * 60 * 60 * 1000;
      const hours = Math.floor(diff / (60 * 60 * 1000));
      diff -= hours * 60 * 60 * 1000;
      const minutes = Math.floor(diff / (60 * 1000));
      diff -= minutes * 60 * 1000;
      const seconds = Math.floor(diff / 1000);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/contest?type=get%20leaderboard&userId=${user.id}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const data = await response.json();
          const weeklyScores = data.weeklyScore || [];
          
          // Transform to leaderboard format with ranks
          const ranked = weeklyScores.map((entry: any, index: number) => ({
            rank: index + 1,
            username: entry.user?.username || entry.user?.name || "Unknown",
            name: entry.user?.name || entry.user?.username || "Unknown",
            points: entry.points || 0,
            userId: entry.userId,
          }));

          setLeaderboard(ranked);

          // Find user's rank (normalize user.id which may be a string)
          const userIdNum = typeof user.id === "string" ? parseInt(user.id) : (user.id as number);
          const userEntry = ranked.find(
            (entry: LeaderboardEntry) => entry.userId === userIdNum
          );
          if (userEntry) {
            setUserRank(userEntry.rank);
            setUserPoints(userEntry.points);
          } else {
            // User not in top 50, need to find their rank
            const userWeeklyPoints = user.weeklyPoints || 0;
            setUserPoints(userWeeklyPoints);
            // Calculate approximate rank (users with same or more points)
            const rank = ranked.filter((e: LeaderboardEntry) => e.points > userWeeklyPoints).length + 1;
            setUserRank(rank);
          }
        }
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    // Refresh every 60 seconds; depend only on user id to avoid re-creating intervals
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Get top 3 for podium (display order: #2, #1, #3 so winner is centered)
  const rawTop = leaderboard.slice(0, 3);
  const displayTop = rawTop.length === 3
    ? [rawTop[1], rawTop[0], rawTop[2]]
    : rawTop.length === 2
    ? [rawTop[1], rawTop[0]]
    : rawTop;

  const topThree = displayTop.map((entry, idx) => {
    const initials = entry.username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || entry.username.slice(0, 2).toUpperCase();
    
    return {
      rank: entry.rank,
      username: entry.username,
      initials,
      points: entry.points,
      // idx === 1 is the center/winner slot in the layout below
      color: idx === 1 ? "border-[#FFDA47]" : idx === 0 ? "border-gray-400" : "border-orange-500",
      bgColor: idx === 1
        ? "bg-gradient-to-br from-[#FFDA42] to-[#FFA200]"
        : idx === 0
        ? "bg-gray-400/10"
        : "bg-orange-500/10",
      isWinner: idx === 1,
    };
  });

  // Fill with placeholder if less than 3
  while (topThree.length < 3) {
    const placeholderRank = topThree.length + 1;
    topThree.push({
      rank: placeholderRank,
      username: "---",
      initials: "--",
      points: 0,
      color: "border-gray-600",
      bgColor: "bg-gray-600/10",
      isWinner: false,
    });
  }

  // Get positions 4-8 for leaderboard
  const leaderboardEntries = leaderboard.slice(3, 8).map((entry) => {
    const initials = entry.username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || entry.username.slice(0, 2).toUpperCase();
    
    const colors = [
      "border-purple-400",
      "border-blue-400",
      "border-green-400",
      "border-yellow-400",
      "border-pink-400",
    ];
    const bgColors = [
      "bg-purple-400/10",
      "bg-blue-400/10",
      "bg-green-400/10",
      "bg-yellow-400/10",
      "bg-pink-400/10",
    ];

    return {
      rank: entry.rank,
      username: entry.username,
      initials,
      points: entry.points,
      color: colors[(entry.rank - 4) % colors.length],
      bgColor: bgColors[(entry.rank - 4) % bgColors.length],
    };
  });

  const isUserQualified = Boolean(user?.isOfficial);

  const rewardCards = [
    {
      icon: <Zap className="w-8 h-8" />,
      title: "x2 Multiplier",
      description: "Boost your earnings",
      gradient: "from-yellow-400 to-orange-500",
      borderColor: "border-yellow-400",
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Safe Play",
      description: "Your points are safe",
      gradient: "from-green-400 to-emerald-500",
      borderColor: "border-green-400",
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
          onClick={() => goBack()}
          className="flex items-center gap-2 text-white hover:text-cyan-400 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>

        {/* Timer Badge */}
        <div className="border-2 border-purple-500/50 rounded-2xl px-4 py-2 bg-purple-900/20">
          <div className="text-xs text-gray-400 text-center">Ends in</div>
          <div className="text-lg font-bold text-center">
            {timeLeft.days}d {timeLeft.hours.toString().padStart(2, '0')}:
            {timeLeft.minutes.toString().padStart(2, '0')}:
            {timeLeft.seconds.toString().padStart(2, '0')}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-2 pb-20">
        {!isUserQualified && (
          <div className="p-3 rounded-xl border border-yellow-400/30 bg-yellow-400/10 text-yellow-200 text-xs mb-4">
            <div className="font-semibold text-yellow-300 mb-1">Purchase a POWER UP to qualify</div>
            <div className="text-yellow-200/90">
              You need at least 2 NEAR in POWER UP to participate in this week's contest.
            </div>
          </div>
        )}

        {leaderboard.length === 0 && (
          <div className="p-3 rounded-xl border border-blue-400/30 bg-blue-400/10 text-blue-200 text-xs mb-4">
            <div className="font-semibold text-blue-300 mb-1">No participants yet</div>
            <div className="text-blue-200/90">
              Be the first! Purchase a POWER UP (2 NEAR min) and start earning SOLV to appear on the leaderboard.
            </div>
          </div>
        )}

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
        {loading ? (
          <div className="flex items-end justify-center gap-2 mb-6 px-2">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className={`flex flex-col items-center ${idx === 1 ? "flex-1" : "flex-1"} animate-pulse`}
              >
                <div className="w-14 h-14 rounded-full bg-gray-600/20 border-2 border-gray-600 flex items-center justify-center mb-2"></div>
                <div className="text-xs font-medium mb-1 text-gray-500">---</div>
                <div className="text-yellow-400 font-bold text-sm mb-2">---</div>
                <div className="text-xs text-gray-400 mb-2">SOLV</div>
                <div className={`w-full rounded-t-xl border-2 border-gray-600 bg-gray-600/20 ${
                  idx === 1 ? "h-32" : idx === 0 ? "h-24" : "h-20"
                }`}></div>
              </div>
            ))}
          </div>
        ) : (
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
              <div className="text-xs text-gray-400 mb-2">SOLV</div>

              {/* Podium bar */}
              <div
                className={`w-full rounded-t-xl border-2 ${player.color} ${player.bgColor} flex items-center justify-center transition-all ${
                  player.isWinner ? "h-32" : player.rank === 2 ? "h-24" : "h-20"
                }`}
              >
                <Trophy
                  className={`${player.isWinner ? "w-12 h-12" : "w-10 h-10"} ${
                    player.isWinner ? "text-yellow-400" : player.rank === 2 ? "text-gray-300" : "text-orange-400"
                  }`}
                />
              </div>
            </div>
          ))}
          </div>
        )}

        {/* Leaderboard */}
        <div className="space-y-2">
          {leaderboardEntries.map((player) => (
            <div key={player.rank} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${player.bgColor} border-2 ${player.color} flex items-center justify-center text-sm font-bold`}>
                  {player.initials}
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">#{player.rank} {player.username}</div>
                </div>
              </div>
              <div className="text-cyan-400 font-bold text-lg">
                {player.points.toLocaleString()} <span className="text-xs text-gray-400 ml-1">SOLV</span>
              </div>
            </div>
          ))}
        </div>

        {/* User rank */}
        <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="text-white/80 text-sm">Your Rank</div>
          <div className="text-white text-xl font-bold">#{userRank ?? '-'} <span className="text-sm text-gray-400 ml-1">({userPoints.toLocaleString()} SOLV)</span></div>
        </div>

        {/* Rewards */}
        <div className="mt-6 grid grid-cols-3 gap-2">
          {rewardCards.map((card, idx) => (
            <div key={idx} className={`rounded-xl p-3 border ${card.borderColor} bg-gradient-to-br ${card.gradient}/10 flex flex-col items-center text-center gap-2`}>
              {card.icon}
              <div className="text-xs font-bold">{card.title}</div>
              <div className="text-[10px] text-white/70">{card.description}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Contest;
