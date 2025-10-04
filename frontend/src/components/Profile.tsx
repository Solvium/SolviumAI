"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import type WebApp from "@twa-dev/sdk";
import { useAuth } from "@/app/contexts/AuthContext";
import { useToast } from "@/app/hooks/use-toast";
import { IoChevronBackSharp } from "react-icons/io5";
// import ProfileIcon from "@/components/icons/ProfileIcon";
// import Edit from "@/app/assets/icons/profile/edit.svg";
import profileImg from "@/app/assets/icons/profile/profile.png";
import coins from "@/app/assets/icons/profile/coin.png";
import task from "@/app/assets/icons/profile/tasks.png";
import trophy from "@/app/assets/icons/profile/trophy.png";

import { useNavigation } from "@/app/contexts/NavigationContext";

const UserProfile = ({ tg }: { tg: typeof WebApp | null }) => {
  const { goBack } = useNavigation();
  const { user: userDetails, logout, fetchUserProfile } = useAuth();

  // Fetch enhanced profile data when component mounts (only once)
  useEffect(() => {
    if (userDetails?.id) {
      fetchUserProfile();
    }
  }, []); // Empty dependency array - only run once on mount

  return (
    <div className="min-h-screen w-full pb-24 bg-gradient-to-b from-[#1a237e] via-[#283593] to-[#1a237e] relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-8">
        <button
          onClick={() => goBack()}
          className="flex items-center gap-2 text-white hover:text-blue-300 transition-colors"
        >
          {/* Back arrow icon */}
          <IoChevronBackSharp className="w-5 h-5 text-current" aria-hidden />
          <span className="text-lg font-medium">Back</span>
        </button>
        <button
          onClick={() => logout()}
          className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
          title="Logout"
        >
          Logout
        </button>
      </div>

      <div className="max-w-[630px] mx-auto px-6 space-y-6 ">
        {/* Profile Section */}
        <ProfileHeader userDetails={userDetails} />

        {/* Level Progress Section */}
        <LevelProgress userDetails={userDetails} />

        {/* Stats Section */}
        <StatsSection userDetails={userDetails} />

        {/* Invite Section */}
        <InviteSection userDetails={userDetails} />
      </div>
    </div>
  );
};

const ProfileHeader = ({ userDetails }: { userDetails: any }) => {
  const levelInfo = userDetails?.level_progress;

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Avatar */}
      <div className="relative">
        <img
          src={userDetails?.avatar_url || userDetails?.avatar || profileImg.src}
          className="w-24 h-24 rounded-full object-cover"
          alt="Profile"
          onError={(e) => {
            // Fallback to default image if avatar fails to load
            e.currentTarget.src = profileImg.src;
          }}
        />
      </div>

      {/* Username */}
      <h1 className="text-2xl font-bold text-white">
        {userDetails?.username || "User"}
      </h1>

      {/* Level Badge */}
      {levelInfo && (
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 rounded-full">
          <span className="text-white font-bold text-sm">
            Level {levelInfo.current_level} - {levelInfo.level_title}
          </span>
        </div>
      )}

      {/* Edit Profile Button */}
      <div className="relative">
        <button className="w-[fit] font-bold h-[40px] px-[44px] rounded-[40px] border-2 border-[rgba(23,61,231,1)] bg-transparent text-white font-medium text-sm hover:bg-blue-500/10 transition-all duration-200 flex items-center justify-center shadow-[5px_-1px_56.3px_0px_rgba(0,0,0,0.5)] sm:text-xs md:text-sm">
          Edit Profile
        </button>
      </div>
    </div>
  );
};

const LevelProgress = ({ userDetails }: { userDetails: any }) => {
  const levelInfo = userDetails?.level_progress;

  if (!levelInfo) return null;

  return (
    <div className="bg-blue-800/50 rounded-3xl p-6 border border-blue-600/30">
      <div className="flex items-center justify-between mb-4 w-full">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {levelInfo.current_level}
            </span>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">
              Level {levelInfo.current_level}
            </h3>
            <p className="text-blue-300 text-sm">
              {levelInfo.points_to_next} Points to next level
            </p>
          </div>
        </div>
      </div>

      {/* Real Progress Bar */}
      <div className="relative">
        <div className="relative flex items-center w-[100%] overflow-hidden justify-between bg-[rgba(243,177,78,0.7)] rounded-full h-8">
          <div
            className="bg-[rgba(243,177,78,1)] rounded-full h-full absolute transition-all duration-500"
            style={{ width: `${levelInfo.progress_percentage}%` }}
          />

          <div className="flex items-center justify-between z-10 w-full ">
            <span className="text-xs text-[#825C24] px-2 py-1 border-2 rounded-full bg-[#FFCE51] border-[#F3B14E] font-bold">
              {levelInfo.current_level}{" "}
            </span>

            <span className="text-yellow-900 z-10 font-bold text-sm">
              ★ {userDetails?.experience_points || 0}/
              {levelInfo.next_level_points}
            </span>

            <span className="text-xs text-[#825C24] px-2 py-1 border-2 rounded-full bg-[#FFCE51] border-[#F3B14E] font-bold">
              {levelInfo.current_level + 1}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatsSection = ({ userDetails }: { userDetails: any }) => {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* SOLV Points */}
      <div className="bg-blue-800/50 border-2 border-[#173DE7] flex flex-col items-center justify-center rounded-3xl p-6 text-center">
        <img src={coins.src} className="w-[30px]" alt="Coins" />
        <div className="text-[15px] font-bold text-white mb-1">
          {userDetails?.totalSOLV || userDetails?.totalPoints || 0}
        </div>
        <div className="text-blue-300 text-[10px] font-medium uppercase tracking-wider mt-2">
          SOLV
        </div>
      </div>

      {/* Contests */}
      <div className="bg-blue-800/50 border-2 border-[#173DE7] flex flex-col items-center justify-center rounded-3xl p-6 text-center">
        <img src={trophy.src} className="w-[30px]" alt="Trophy" />
        <div className="text-[15px] font-bold text-white mb-1">
          {userDetails?.contests_participated || 0}
        </div>
        <div className="text-blue-300 text-[10px] font-medium uppercase tracking-wider mt-2">
          CONTESTS
        </div>
      </div>

      {/* Tasks */}
      <div className="bg-blue-800/50 border-2 border-[#173DE7] flex flex-col items-center justify-center rounded-3xl p-6 text-center">
        <img src={task.src} className="w-[30px]" alt="Tasks" />
        <div className="text-[15px] font-bold text-white mb-1">
          {userDetails?.tasks_completed || 0}
        </div>
        <div className="text-blue-300 text-[10px] font-medium uppercase tracking-wider mt-2">
          TASKS
        </div>
      </div>
    </div>
  );
};

const InviteSection = ({ userDetails }: any) => {
  const [copyState, setCopyState] = useState("Copy");
  const [link, setLink] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    setLink(location.href);
  }, []);

  const handleCopy = async () => {
    const textToCopy = `${link}?ref=${userDetails?.username}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyState("Copied");
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard",
        variant: "default",
      });
      setTimeout(() => setCopyState("Copy"), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-blue-800/50 rounded-3xl p-6 border border-blue-600/30">
      <h3 className="text-white font-bold text-center flex justify-center  w-full mb-4">
        Invite friends and earn rewards
      </h3>

      <button
        onClick={handleCopy}
        className="w-fit bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-yellow-900 font-bold py-3 px-6 rounded-full transition-all duration-200 flex items-center justify-center gap-2 mx-auto"
      >
        <span>{copyState}</span>
        <Copy className="w-4 h-4" />
      </button>
    </div>
  );
};

export default UserProfile;
