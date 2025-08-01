import React, { useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";

const LeaderBoard = () => {
  const { user } = useAuth();
  const [leader, setLeader] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("users");
  const myPos = leader?.findIndex((ele: any) => {
    return ele.username == user?.username;
  });

  let stringToColour = function (str: any) {
    if (!str) return;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let value = (hash >> (str.length * 8)) & 0xff;
    const hue = value * 137.508;
    return `hsl(${hue},70%,65%)`;
  };

  const UserRankCard = ({ userData, position }: any) => (
    <div className="flex items-center p-4 bg-[#0B0B14] border border-[#2A2A45] rounded-lg">
      <div
        style={{ background: stringToColour(userData?.username) }}
        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-black mr-2"
      >
        {userData?.name?.slice(0, 2)?.toUpperCase()}
      </div>
      <div className="flex-1 ml-4">
        <h3 className="font-semibold text-white">{userData?.name}</h3>
        <p className="text-sm text-[#8E8EA8]">{userData?.totalPoints} SOLV</p>
      </div>
      <div className="flex items-center space-x-2">
        <span className="font-semibold text-[#4C6FFF]">#{position}</span>
      </div>
    </div>
  );

  const TabButton = ({ label, isActive, onClick }: any) => (
    <button
      onClick={onClick}
      className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
        isActive
          ? "bg-[#4C6FFF] text-white"
          : "bg-[#0B0B14] text-[#8E8EA8] hover:bg-[#1E1E2E]"
      }`}
    >
      {label}
    </button>
  );

  const usersRanking = leader?.filter((item: any) => item.isUser);
  const generalRanking = leader?.filter((item: any) => !item.isUser);

  return (
    <div className="w-full p-6 bg-[#0B0B14] min-h-screen">
      <div className="bg-[#151524] border border-[#2A2A45] rounded-lg p-6 shadow-[0_0_15px_rgba(41,41,69,0.5)]">
        <h2 className="text-2xl font-bold text-[#4C6FFF] mb-6 text-center">
          Leaderboard
        </h2>

        {/* Tab Buttons */}
        <div className="flex space-x-4 mb-6 justify-center">
          <TabButton
            label="Users Ranking"
            isActive={activeTab === "users"}
            onClick={() => setActiveTab("users")}
          />
          <TabButton
            label="General Ranking"
            isActive={activeTab === "general"}
            onClick={() => setActiveTab("general")}
          />
        </div>

        {/* Rankings List */}
        <div className="space-y-4">
          {activeTab === "users" ? (
            <>
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Your Ranking
                </h3>
                <UserRankCard userData={user} position={myPos + 1} />
              </div>
            </>
          ) : (
            <>
              {generalRanking?.map((lead: any, i: number) => (
                <UserRankCard
                  key={`general-${lead.username}-${i}`}
                  userData={lead}
                  position={i + 1}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderBoard;
