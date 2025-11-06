"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trophy, ChevronLeft, Coins, Gift, Sparkles } from "lucide-react";
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
    function nextSundayMidnight(): number {
      const now = new Date();
      const day = now.getDay(); // 0=Sun
      // If today is Sunday and before midnight next day, we want upcoming Sunday
      const daysUntilSunday = (7 - day) % 7 || 7; // 1..7
      const target = new Date(now);
      target.setDate(now.getDate() + daysUntilSunday);
      target.setHours(0, 0, 0, 0);
      return target.getTime();
    }

    const update = () => {
      const targetMs = nextSundayMidnight();
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
        const response = await fetch(
          `/api/contest?type=get%20leaderboard&userId=${user.id}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );

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
          const userIdNum =
            typeof user.id === "string"
              ? parseInt(user.id)
              : (user.id as number);
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
            const rank =
              ranked.filter(
                (e: LeaderboardEntry) => e.points > userWeeklyPoints
              ).length + 1;
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
  const displayTop =
    rawTop.length === 3
      ? [rawTop[1], rawTop[0], rawTop[2]]
      : rawTop.length === 2
      ? [rawTop[1], rawTop[0]]
      : rawTop;

  const topThree = displayTop.map((entry, idx) => {
    const initials =
      entry.username
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
      color:
        idx === 1
          ? "border-[#FFDA47]"
          : idx === 0
          ? "border-gray-400"
          : "border-orange-500",
      bgColor:
        idx === 1
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
    const initials =
      entry.username
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || entry.username.slice(0, 2).toUpperCase();

    const colors = [
      "border-purple-400",
      "border-blue-400",
      "border-cyan-400",
      "border-green-400",
      "border-cyan-400",
    ];

    return {
      rank: entry.rank,
      username: entry.username,
      initials,
      points: entry.points,
      color: colors[(entry.rank - 4) % colors.length],
    };
  });

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
            {timeLeft.days}d {timeLeft.hours.toString().padStart(2, "0")}:
            {timeLeft.minutes.toString().padStart(2, "0")}:
            {timeLeft.seconds.toString().padStart(2, "0")}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-2 pb-20">
        {/* Eligibility banner */}
        {!Boolean(user?.isOfficial) && (
          <div className="p-2 rounded-lg border border-yellow-400/30 bg-yellow-400/10 text-[11px] text-yellow-200 mb-4">
            Purchase a POWER UP multiplier (min 2 NEAR) to join this week's
            contest.
          </div>
        )}
        {/* Title */}
        <h1
          className="text-4xl font-bold mb-2 tracking-wider"
          style={{ fontFamily: "monospace" }}
        >
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
                className={`flex flex-col items-center ${
                  idx === 1 ? "flex-1" : "flex-1"
                } animate-pulse`}
              >
                <div className="w-14 h-14 rounded-full bg-gray-600/20 border-2 border-gray-600 flex items-center justify-center mb-2"></div>
                <div className="text-xs font-medium mb-1 text-gray-500">
                  ---
                </div>
                <div className="text-yellow-400 font-bold text-sm mb-2">
                  ---
                </div>
                <div className="text-xs text-gray-400 mb-2">SOLV</div>
                <div
                  className={`w-full rounded-t-xl border-2 border-gray-600 bg-gray-600/20 ${
                    idx === 1 ? "h-32" : idx === 0 ? "h-24" : "h-20"
                  }`}
                ></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-end justify-center gap-2 mb-6 px-2">
            {topThree.map((player, idx) => (
              <div
                key={player.rank}
                className={`flex flex-col items-center ${
                  idx === 1 ? "flex-1" : "flex-1"
                }`}
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

                {/* Podium */}
                <div
                  className={`w-full rounded-t-xl border-2 ${player.color} ${
                    player.bgColor
                  } flex items-center justify-center transition-all ${
                    idx === 1 ? "h-32" : idx === 0 ? "h-24" : "h-20"
                  }`}
                >
                  <Trophy
                    className={`${idx === 1 ? "w-12 h-12" : "w-10 h-10"} ${
                      idx === 1
                        ? "text-yellow-400"
                        : idx === 0
                        ? "text-gray-300"
                        : "text-orange-400"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Leaderboard Positions 4-8 */}
        {loading ? (
          <div className="space-y-3 mb-6">
            {[4, 5, 6, 7, 8].map((rank) => (
              <div
                key={rank}
                className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-2 border-cyan-500/50 rounded-2xl p-4 flex items-center justify-between animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="text-xl font-bold text-white">#{rank}</div>
                  <div className="w-10 h-10 rounded-full border-2 border-gray-600 bg-gray-800/50 flex items-center justify-center text-sm font-bold">
                    --
                  </div>
                  <div className="font-medium text-gray-500">Loading...</div>
                </div>
                <div className="text-cyan-400 font-bold text-lg">---</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {leaderboardEntries.length > 0 ? (
              leaderboardEntries.map((player) => (
                <div
                  key={player.rank}
                  className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-2 border-cyan-500/50 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-bold text-white">
                      #{player.rank}
                    </div>
                    <div
                      className={`w-10 h-10 rounded-full border-2 ${player.color} bg-gray-800/50 flex items-center justify-center text-sm font-bold`}
                    >
                      {player.initials}
                    </div>
                    <div className="font-medium">{player.username}</div>
                  </div>
                  <div className="text-cyan-400 font-bold text-lg">
                    {player.points.toLocaleString()}
                    <span className="text-xs text-gray-400 ml-1">SOLV</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-8">
                No participants yet. Be the first!
              </div>
            )}
          </div>
        )}

        {/* Progress Section with Rank Badge */}
        <div className="bg-[#1a1a3e]/60 border-2 border-[#5555ff]/50 rounded-3xl p-6 mb-6 relative backdrop-blur-sm">
          {/* Your Rank Badge - Positioned at top */}
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-[#1C97D8] rounded-full px-5 py-2.5 text-center font-bold text-xs text-black whitespace-nowrap">
            {loading
              ? "Loading..."
              : userRank
              ? `Your Rank: #${userRank} ${
                  userRank <= 3 ? "🏆" : "— Keep going!"
                }`
              : "Join the contest!"}
          </div>

          <div className="flex items-start justify-between mb-5 mt-2">
            <div>
              <div
                className="text-[#00d4ff] text-[11px] font-bold mb-0.5 flex items-center gap-1.5"
                style={{ fontFamily: "monospace", letterSpacing: "0.1em" }}
              >
                <span className="text-green-400 text-sm">✓</span> YOUR CONTEST
              </div>
              <div
                className="text-[#00d4ff] text-[11px] font-bold"
                style={{ fontFamily: "monospace", letterSpacing: "0.1em" }}
              >
                PROGRESS
              </div>
            </div>
            {leaderboard.length > 0 && topThree[0]?.points > 0 && (
              <div className="text-3xl font-bold text-[#1C97D8]">
                {Math.round((userPoints / topThree[0].points) * 100)}%
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {leaderboard.length > 0 && topThree[0]?.points > 0 && (
            <div className="w-full h-2.5 bg-[#0a0a1e] rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-[#1C97D8] rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    (userPoints / topThree[0].points) * 100,
                    100
                  )}%`,
                }}
              ></div>
            </div>
          )}

          {/* Stats */}
          <div className="flex justify-between items-center">
            <div className="text-left">
              <div className="text-2xl font-bold text-[#1C97D8] mb-1">
                {userPoints.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-400">SOLV Gained</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-[#1C97D8] mb-1">
                {userRank || "—"}
              </div>
              <div className="text-[11px] text-gray-400">Your Rank</div>
            </div>
          </div>
        </div>

        {/* Top 3 Rewards Section */}
        <div className="mb-6">
          <h2
            className="text-center text-xl font-bold mb-4 flex items-center justify-center gap-2"
            style={{ fontFamily: "monospace" }}
          >
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
                <h3 className="font-bold text-sm mb-2 text-pink-300">
                  Bonus
                  <br />
                  Coins
                </h3>
                <p className="text-xs text-gray-300 leading-tight">
                  1000+
                  <br />
                  coins for
                  <br />
                  top 3
                </p>
              </div>
            </div>

            {/* More Mining - Blue */}
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-2 border-blue-500 rounded-2xl p-4 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center mb-3 mx-auto">
                  <Sparkles className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="font-bold text-sm mb-2 text-blue-300">
                  More
                  <br />
                  mining
                </h3>
                <p className="text-xs text-gray-300 leading-tight">
                  Rare digital
                  <br />
                  collectibles
                </p>
              </div>
            </div>

            {/* Free Game - Cyan */}
            <div className="bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border-2 border-cyan-400 rounded-2xl p-4 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 to-blue-500/5"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-full bg-cyan-400/20 border-2 border-cyan-400 flex items-center justify-center mb-3 mx-auto">
                  <Gift className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="font-bold text-sm mb-2 text-cyan-300">
                  Free
                  <br />
                  Game
                </h3>
                <p className="text-xs text-gray-300 leading-tight">
                  Get lucky in
                  <br />
                  your next
                  <br />
                  game
                </p>
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
