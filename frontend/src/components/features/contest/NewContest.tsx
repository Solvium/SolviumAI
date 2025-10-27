import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Trophy, ChevronLeft } from "lucide-react";

const Contest = () => {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState({
    hours: 23,
    minutes: 59,
    seconds: 15,
  });

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const newSeconds = prev.seconds - 1;
        const newMinutes = newSeconds < 0 ? prev.minutes - 1 : prev.minutes;
        const newHours = newMinutes < 0 ? prev.hours - 1 : prev.hours;
        
        return {
          hours: newHours < 0 ? 23 : newHours,
          minutes: newMinutes < 0 ? 59 : newMinutes,
          seconds: newSeconds < 0 ? 59 : newSeconds,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Mock leaderboard data
  const leaderboard = [
    { id: 1, name: 'You', score: 12, isYou: true },
    { id: 2, name: 'CryptoKing', score: 42 },
    { id: 3, name: 'BlockMaster', score: 35 },
    { id: 4, name: 'NFTGuru', score: 28 },
    { id: 5, name: 'DeFiDegen', score: 22 },
  ];

  return (
    <div className="min-h-screen bg-[#0F0F1B] text-white">
      {/* Header */}
      <header className="p-4 border-b border-[#2A2A45] flex items-center">
        <button 
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-[#1E1E2D] mr-4"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">Contest</h1>
      </header>

      <main className="p-4">
        {/* Countdown Timer */}
        <div className="bg-[#1A1A2F] rounded-2xl p-4 mb-6 border border-[#2A2A45]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[#8E8EA8] text-sm">Time left</span>
            <span className="text-[#4C6FFF] text-sm font-medium">Daily Contest</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="text-center">
              <div className="text-2xl font-bold">{timeLeft.hours.toString().padStart(2, '0')}</div>
              <div className="text-xs text-[#8E8EA8]">HOURS</div>
            </div>
            <div className="text-2xl font-bold">:</div>
            <div className="text-center">
              <div className="text-2xl font-bold">{timeLeft.minutes.toString().padStart(2, '0')}</div>
              <div className="text-xs text-[#8E8EA8]">MIN</div>
            </div>
            <div className="text-2xl font-bold">:</div>
            <div className="text-center">
              <div className="text-2xl font-bold">{timeLeft.seconds.toString().padStart(2, '0')}</div>
              <div className="text-xs text-[#8E8EA8]">SEC</div>
            </div>
          </div>
        </div>

        {/* Contest Card */}
        <div className="bg-gradient-to-br from-[#4C6FFF] to-[#6B4BFF] rounded-2xl p-5 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">$100 Prize Pool</h2>
              <p className="text-sm opacity-80">Top 3 players win rewards</p>
            </div>
            <div className="bg-white/10 rounded-lg px-2 py-1 text-xs">
              Free Entry
            </div>
          </div>
          <button className="w-full bg-white text-[#4C6FFF] py-3 rounded-xl font-bold hover:bg-opacity-90 transition-all">
            Join Contest
          </button>
        </div>

        {/* How to Play Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">How to Play</h3>
          <div className="space-y-3">
            {[
              '1. Complete daily tasks to earn points',
              '2. Climb the leaderboard',
              '3. Win rewards based on your rank'
            ].map((step, index) => (
              <div key={index} className="flex items-center bg-[#1A1A2F] p-3 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-[#4C6FFF] flex items-center justify-center text-sm font-bold mr-3">
                  {index + 1}
                </div>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard Section */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">Leaderboard</h3>
            <button className="text-[#4C6FFF] text-sm font-medium">View All</button>
          </div>
          
          <div className="space-y-2">
            {leaderboard.map((user, index) => (
              <div 
                key={user.id}
                className={`flex items-center justify-between p-3 rounded-xl ${user.isYou ? 'bg-[#4C6FFF]' : 'bg-[#1A1A2F]'}`}
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold mr-3">
                    {index + 1}
                  </div>
                  <span className={user.isYou ? 'font-semibold' : ''}>
                    {user.name}
                    {user.isYou && <span className="ml-2 text-xs opacity-80">(You)</span>}
                  </span>
                </div>
                <div className="text-sm font-medium">{user.score} pts</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Contest;
