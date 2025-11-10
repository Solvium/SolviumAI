"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import type WebApp from "@twa-dev/sdk";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { IoChevronBackSharp } from "react-icons/io5";
// import ProfileIcon from "@/components/common/icons/ProfileIcon";
// import Edit from "@/app/assets/icons/profile/edit.svg";
import profileImg from "@/components/assets/icons/profile/profile.png";
import coins from "@/components/assets/icons/profile/coin.png";
import task from "@/components/assets/icons/profile/tasks.png";
import trophy from "@/components/assets/icons/profile/trophy.png";

import { useNavigation } from "@/contexts/NavigationContext";

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
    <div className="h-screen w-full  bg-gradient-to-b from-[#1a237e] via-[#283593] to-[#1a237e] relative overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-8">
        <button
          onClick={() => goBack()}
          className="flex items-center md:gap-2 gap-1 text-white hover:text-blue-300 transition-colors"
        >
          {/* Back arrow icon */}
          <IoChevronBackSharp
            className="md:w-5 md:h-5 w-3 h-3 text-current"
            aria-hidden
          />
          <span className="md:text-lg text-xs font-medium">Back</span>
        </button>
        <button
          onClick={() => logout()}
          className="md:px-4 px-2 md:py-2 py-1 rounded-full bg-red-500 hover:bg-red-600 text-white md:text-sm text-xs font-medium transition-colors"
          title="Logout"
        >
          Logout
        </button>
      </div>

      <div className="max-w-[630px] mx-auto px-6 md:space-y-4 space-y-2">
        {/* Profile Section */}
        <ProfileHeader userDetails={userDetails} />

        {/* Level Progress Section */}
        <LevelProgress userDetails={userDetails} />

        {/* Stats Section */}
        <StatsSection userDetails={userDetails} />

        {/* Farming Section */}
        <FarmingSection userDetails={userDetails} />

        {/* Invite Section */}
        <InviteSection userDetails={userDetails} />
      </div>
    </div>
  );
};

const ProfileHeader = ({ userDetails }: { userDetails: any }) => {
  const levelInfo = userDetails?.level_progress;

  return (
    <div className="flex flex-col items-center md:space-y-4 space-y-2">
      {/* Avatar */}
      <div className="relative">
        <img
          src={userDetails?.avatar_url || userDetails?.avatar || profileImg.src}
          className="w-16 md:w-24 md:h-24 h-16 rounded-full object-cover"
          alt="Profile"
          onError={(e) => {
            // Fallback to default image if avatar fails to load
            e.currentTarget.src = profileImg.src;
          }}
        />
      </div>

      {/* Username */}
      <h1 className="text-sm md:text-2xl font-bold text-white">
        {userDetails?.username || "User"}
      </h1>

      {/* Level Badge */}
      {levelInfo && (
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 rounded-full">
          <span className="text-white font-bold md:text-sm text-xs">
            Level {levelInfo.current_level} - {levelInfo.level_title}
          </span>
        </div>
      )}

      {/* Edit Profile Button */}
      <div className="relative">
        <button className="w-[fit] font-bold md:h-[40px] h-[25px] px-[44px] rounded-[40px] border-2 border-[rgba(23,61,231,1)] bg-transparent text-white font-medium md:text-sm text-xs hover:bg-blue-500/10 transition-all duration-200 flex items-center justify-center shadow-[5px_-1px_56.3px_0px_rgba(0,0,0,0.5)] sm:text-xs md:text-sm">
          Edit Profile
        </button>
      </div>
    </div>
  );
};

const LevelProgress = ({ userDetails }: { userDetails: any }) => {
  const [levelInfo, setLevelInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  console.log("userDetails", userDetails);
  useEffect(() => {
    const calculateLevelProgress = async () => {
      if (!userDetails?.experience_points) {
        setLevelInfo({
          currentLevel: userDetails?.level || 1,
          pointsToNext: 200,
          progressPercentage: 0,
          nextLevelPoints: 200,
          levelTitle: "Beginner",
        });
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/level/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            experiencePoints: userDetails.experience_points,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setLevelInfo(data);
        } else {
          // Fallback if API fails
          setLevelInfo({
            currentLevel: userDetails?.level || 1,
            pointsToNext: 200,
            progressPercentage: 0,
            nextLevelPoints: 200,
            levelTitle: "Beginner",
          });
        }
      } catch (error) {
        console.error("Error calculating level progress:", error);
        // Fallback if API fails
        setLevelInfo({
          currentLevel: userDetails?.level || 1,
          pointsToNext: 200,
          progressPercentage: 0,
          nextLevelPoints: 200,
          levelTitle: "Beginner",
        });
      } finally {
        setLoading(false);
      }
    };

    calculateLevelProgress();
  }, [userDetails?.experience_points]);

  if (loading) {
    return (
      <div className="bg-blue-800/50 rounded-3xl p-6 border border-blue-600/30">
        <div className="animate-pulse">
          <div className="h-4 bg-blue-700 rounded w-1/2 mb-2"></div>
          <div className="h-8 bg-blue-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!levelInfo) {
    return null;
  }

  return (
    <div className="bg-blue-800/50 rounded-3xl md:p-6 p-3 border border-blue-600/30">
      <div className="flex items-center justify-between mb-4 w-full">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {levelInfo.currentLevel}
            </span>
          </div>
          <div>
            <h3 className="text-white font-bold md:text-lg text-xs">
              Level {levelInfo.currentLevel} - {levelInfo.levelTitle}
            </h3>
            <p className="text-blue-300 md:text-sm text-xs">
              {levelInfo.pointsToNext} Points to next level
            </p>
          </div>
        </div>
      </div>

      {/* Real Progress Bar */}
      <div className="relative">
        <div className="relative flex items-center w-[100%] overflow-hidden justify-between bg-[rgba(243,177,78,0.7)] rounded-full lg:h-8 h-6">
          <div
            className="bg-[rgba(243,177,78,1)] rounded-full h-full absolute transition-all duration-500"
            style={{ width: `${levelInfo.progressPercentage}%` }}
          />

          <div className="flex items-center justify-between z-10 w-full ">
            <span className="text-xs text-[#825C24] px-2 py-1 border-2 rounded-full bg-[#FFCE51] border-[#F3B14E] font-bold">
              {levelInfo.currentLevel}{" "}
            </span>

            <span className="text-yellow-900 z-10 font-bold md:text-sm text-xs">
              ★ {userDetails?.experience_points || 0}/
              {levelInfo.nextLevelPoints}
            </span>

            <span className="text-xs text-[#825C24] px-2 py-1 border-2 rounded-full bg-[#FFCE51] border-[#F3B14E] font-bold">
              {levelInfo.currentLevel + 1}
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
      <div className="bg-blue-800/50 border-2 border-[#173DE7] flex flex-col items-center justify-center rounded-3xl md:p-6 p-3 text-center">
        <img src={coins.src} className="md:w-[30px] w-[20px]" alt="Coins" />
        <div className="md:text-[15px] text-[10px] font-bold text-white mb-1">
          {userDetails?.totalSOLV || 0}
        </div>
        <div className="text-blue-300 md:text-[10px] text-[8px] font-medium uppercase tracking-wider mt-2">
          SOLV
        </div>
      </div>

      {/* Contests */}
      <div className="bg-blue-800/50 border-2 border-[#173DE7] flex flex-col items-center justify-center rounded-3xl md:p-6 p-3 text-center">
        <img src={trophy.src} className="md:w-[30px] w-[20px]" alt="Trophy" />
        <div className="md:text-[15px] text-[10px] font-bold text-white mb-1">
          {userDetails?.contests_participated || 0}
        </div>
        <div className="text-blue-300 md:text-[10px] text-[8px] font-medium uppercase tracking-wider mt-2">
          CONTESTS
        </div>
      </div>

      {/* Tasks */}
      <div className="bg-blue-800/50 border-2 border-[#173DE7] flex flex-col items-center justify-center rounded-3xl md:p-6 p-3 text-center">
        <img src={task.src} className="md:w-[30px] w-[20px]" alt="Tasks" />
        <div className="md:text-[15px] text-[10px] font-bold text-white mb-1">
          {userDetails?.tasks_completed || 0}
        </div>
        <div className="text-blue-300 md:text-[10px] text-[8px] font-medium uppercase tracking-wider mt-2">
          TASKS
        </div>
      </div>
    </div>
  );
};

const FarmingSection = ({ userDetails }: { userDetails: any }) => {
  const [isMining, setIsMining] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [accumulatedSOLV, setAccumulatedSOLV] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const { toast } = useToast();
  const { fetchUserProfile } = useAuth();
  const [isStarting, setIsStarting] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Constants
  const MAX_SOLV = 63;
  const MINING_DURATION_MS = 5 * 60 * 60 * 1000; // 5 hours
  const SOLV_PER_SECOND = MAX_SOLV / (MINING_DURATION_MS / 1000); // 63 / 18000 = 0.0035 SOLV per second

  // Initialize mining state from userDetails
  useEffect(() => {
    if (userDetails?.isMining) {
      setIsMining(true);
    } else {
      setIsMining(false);
      setTimeRemaining(null);
      setAccumulatedSOLV(0);
      setProgress(0);
    }
  }, [userDetails?.isMining]);

  // Calculate accumulated SOLV and time remaining based on lastClaim
  useEffect(() => {
    if (!userDetails?.lastClaim || !userDetails?.isMining) {
      return;
    }

    const updateMiningStatus = () => {
      if (!userDetails.isMining) {
        setIsMining(false);
        setTimeRemaining(null);
        setAccumulatedSOLV(0);
        setProgress(0);
        return;
      }

      const miningStartTime = new Date(userDetails.lastClaim);
      const currentTime = new Date();
      const timeElapsedMs = currentTime.getTime() - miningStartTime.getTime();
      const timeElapsedSeconds = timeElapsedMs / 1000;

      // Calculate accumulated SOLV (up to max of 63)
      const accumulated = Math.min(
        timeElapsedSeconds * SOLV_PER_SECOND,
        MAX_SOLV
      );
      setAccumulatedSOLV(accumulated);

      // Calculate progress percentage
      const progressPercent = (accumulated / MAX_SOLV) * 100;
      setProgress(progressPercent);

      // Calculate time remaining
      const remaining = MINING_DURATION_MS - timeElapsedMs;

      if (remaining <= 0) {
        setTimeRemaining(0);
      } else {
        setTimeRemaining(remaining);
      }
    };

    updateMiningStatus();
    const interval = setInterval(updateMiningStatus, 1000); // Update every second

    return () => clearInterval(interval);
  }, [userDetails?.isMining, userDetails?.lastClaim]);

  const handleStartMining = async () => {
    if (isStarting) return;

    setIsStarting(true);
    try {
      const response = await fetch("/api/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: userDetails?.username,
          type: "start farming",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsMining(true);
        toast({
          title: "Mining Started!",
          description:
            "Your farming session has begun. Come back in 5 hours to claim!",
          variant: "default",
        });
        await fetchUserProfile();
      } else {
        const error = await response.json();
        toast({
          title: "Failed to Start Mining",
          description: error.error || "Please try again",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error starting mining:", error);
      toast({
        title: "Error",
        description: "Failed to start mining. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleClaimReward = async () => {
    if (
      isClaiming ||
      accumulatedSOLV <= 0 ||
      (timeRemaining !== null && timeRemaining > 0)
    )
      return;

    setIsClaiming(true);
    try {
      // Only allow claiming after 5 hours, send full 63 SOLV
      const response = await fetch("/api/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: userDetails?.username,
          type: `farm claim--${MAX_SOLV}`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const multiplierText =
          data.multiplier > 1
            ? ` (${data.multiplier}x multiplier applied!)`
            : "";
        toast({
          title: "Reward Claimed!",
          description: `You earned ${
            data.pointsAwarded || MAX_SOLV
          } SOLV!${multiplierText}`,
          variant: "default",
        });
        setIsMining(false);
        setTimeRemaining(null);
        setAccumulatedSOLV(0);
        setProgress(0);
        await fetchUserProfile();
      } else {
        const error = await response.json();
        toast({
          title: "Failed to Claim",
          description: error.error || "Please try again",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error claiming reward:", error);
      toast({
        title: "Error",
        description: "Failed to claim reward. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-blue-800/50 rounded-2xl md:p-6 p-3 border border-blue-600/30">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold md:text-xl text-sm">Farming</h3>

          {!isMining && (
            <button
              onClick={handleStartMining}
              disabled={isStarting}
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 
                         disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed
                         text-yellow-900 font-bold md:py-3 py-2 md:px-6 px-4 rounded-full 
                         transition-all duration-200 shadow-lg hover:shadow-xl
                         transform hover:scale-105 active:scale-95
                         md:text-base text-xs"
            >
              {isStarting ? "Starting..." : "Start Mining"}
            </button>
          )}
        </div>

        {isMining && (
          <div className="space-y-3">
            {/* Accumulated SOLV */}
            <div className="bg-blue-900/50 rounded-xl p-4 border border-blue-700/50">
              <div className="flex items-center justify-between mb-2">
                <div className="text-blue-300 text-xs">Mining Progress</div>
                <div className="text-blue-300 text-xs">
                  {progress.toFixed(1)}%
                </div>
              </div>
              <div className="text-white font-bold text-2xl mb-2">
                {accumulatedSOLV.toFixed(4)} / {MAX_SOLV} SOLV
              </div>

              {/* Progress bar */}
              <div className="w-full bg-blue-800/50 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Claim button - only available after 5 hours */}
            {accumulatedSOLV > 0 && (
              <button
                onClick={handleClaimReward}
                disabled={
                  isClaiming || (timeRemaining !== null && timeRemaining > 0)
                }
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 
                           disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed
                           text-white font-bold md:py-3 py-2 md:px-6 px-4 rounded-full 
                           transition-all duration-200 shadow-lg hover:shadow-xl
                           transform hover:scale-105 active:scale-95
                           md:text-base text-xs"
              >
                {isClaiming
                  ? "Claiming..."
                  : timeRemaining !== null && timeRemaining > 0
                  ? `Claim after ${formatTime(timeRemaining)}`
                  : `Claim ${MAX_SOLV} SOLV`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const InviteSection = ({ userDetails }: any) => {
  const [copyState, setCopyState] = useState("Copy");
  const { toast } = useToast();

  // Generate Telegram bot referral link
  const referralLink = userDetails?.username
    ? `t.me/solviumquizbot?ref=${userDetails.username}`
    : "";

  const handleCopy = async () => {
    if (!referralLink) {
      toast({
        title: "Error",
        description: "Username not found. Cannot generate referral link.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopyState("Copied!");
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
        variant: "default",
      });
      setTimeout(() => setCopyState("Copy"), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-blue-800/50 rounded-2xl md:p-6 p-3 border border-blue-600/30">
      <h3 className="text-white font-bold text-center flex justify-center w-full mb-4 md:text-lg text-sm">
        Invite friends and earn rewards
      </h3>

      {/* Display the referral link */}
      {referralLink && (
        <div className="mb-4 p-3 bg-blue-900/50 rounded-xl border border-blue-700/50">
          <div className="text-blue-300 text-xs mb-2">Your referral link:</div>
          <div className="text-white font-mono text-xs md:text-sm break-all select-all">
            {referralLink}
          </div>
        </div>
      )}

      <button
        onClick={handleCopy}
        disabled={!referralLink}
        className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 
                   disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed
                   text-yellow-900 font-bold md:py-3 py-2 md:px-6 px-4 rounded-full 
                   transition-all duration-200 flex items-center justify-center gap-2 mx-auto
                   transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
      >
        <span>{copyState}</span>
        <Copy className="w-4 h-4" />
      </button>
    </div>
  );
};

export default UserProfile;
