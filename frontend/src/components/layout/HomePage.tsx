"use client";
import Image from "next/image";
import { TaskIcon } from "@/components/common/icons/TaskIcon";
import ProfileIcon from "@/components/common/icons/ProfileIcon";
import { ContestIcon } from "@/components/common/icons/ContestIcon";
import { Montserrat } from "next/font/google";
import { useNavigation } from "@/contexts/NavigationContext";
import { useAuth } from "@/contexts/AuthContext";
import profilepng from "@/components/assets/icons/home/profile.png";
import Profilebot from "@/components/assets/icons/home/profileBot.svg";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const HomePage = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  const { navigate } = useNavigation();
  const { user } = useAuth();
  return (
    <div className="h-[calc(100vh-75px)] w-full bg-[#040022] flex flex-col">
      {/* Header */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between mb-3">
          {/* <button className="text-white text-xs sm:text-sm font-medium">Cancel</button> */}
          <h1 className="text-[#BDECFB] text-center text-sm sm:text-lg w-full font-medium">
            Welcome to Solvium
          </h1>
        </div>

        {/* Navigation row */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">
          {/* Tasks */}
          <button
            onClick={() => navigate("Tasks")}
            className="flex-1 max-w-[100px] sm:max-w-[120px] hover:scale-105 transition-transform"
          >
            <TaskIcon className="h-10 sm:h-12 w-full object-contain text-white" />
          </button>

          {/* Profile */}
          <button
            onClick={() => navigate("Profile")}
            className="flex flex-1 items-center justify-center gap-1 sm:gap-2 max-w-[120px] sm:max-w-[140px] hover:scale-105 transition-transform"
          >
            {user?.avatar_url || user?.avatar ? (
              <img
                src={user.avatar_url || user.avatar}
                alt="Profile Avatar"
                className="w-12 h-12 rounded-full object-cover border-2 border-[#BDECFB]"
                onError={(e) => {
                  // Fallback to default image if avatar fails to load
                  e.currentTarget.src = profilepng.src;
                  e.currentTarget.className =
                    "w-12 h-12 object-contain object-cover";
                }}
              />
            ) : (
              <img
                src={profilepng.src}
                alt="Profile Bot"
                className="w-12 h-12 object-contain object-cover"
              />
            )}
            {/* <ProfileIcon className="w-12 h-12 text-white" />
            <Profilebot className="w-12 h-12 text-white" /> */}
          </button>

          {/* Contest */}
          <button
            onClick={() => {
              /* Contest disabled for now */
            }}
            aria-disabled
            className="flex-1 max-w-[100px] sm:max-w-[120px] opacity-60 cursor-not-allowed"
          >
            <ContestIcon className="h-10 sm:h-12 w-full object-contain text-white" />
          </button>
        </div>
      </div>

      {/* Body that grows/shrinks */}
      <div className="flex flex-col justify-center px-2 pt-4 space-y-4 ">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          {/* Motivational text */}
          <div className="space-y-0 pb-3">
            <h2
              className={`${montserrat.className} text-[#FBBC05] text-[9px] sm:text-[10px] font-normal leading-relaxed`}
            >
              Your Journey to greatness starts here.
            </h2>
            <h3
              className={`${montserrat.className} text-[#FBBC05] text-[9px] sm:text-[10px] font-normal`}
            >
              Are you ready to conquer Solvium?
            </h3>
          </div>

          {/* Progress bar */}
          <div className="w-[70%] sm:w-[80%] max-w-[630px] mx-auto px-3 sm:px-5">
            <div className="h-2 sm:h-3 bg-[#B2D9FF] rounded-full overflow-hidden flex items-center">
              <div
                className="h-[70%] sm:h-[80%] ml-1 bg-[#0080FF] rounded-full shadow-lg"
                style={{
                  width: "75%",
                  boxShadow: "0 0 15px rgba(34, 211, 238, 0.6)",
                }}
              />
            </div>
          </div>

          {/* Coin + number */}
          <div className="flex items-center justify-center pt-0 gap-2 sm:gap-3 px-2 sm:px-6 md:px-10">
            <Image
              src="/assets/coins/golden-coin.svg"
              alt="Golden Coin"
              width={68}
              height={63}
              className="w-[69px] h-[68px] object-contain"
            />
            <span
              className={`${montserrat.className} text-[#FDE92D] text-3xl sm:text-3xl md:text-3xl font-bold tracking-normal`}
            >
              1,034,900,000
            </span>
          </div>

          {/* Big home image */}
          <div className="flex items-center pt-1 justify-center">
            <Image
              src="/assets/background/home-image.svg"
              alt="Home"
              width={364}
              height={390}
              className="w-[97%] max-w-[630px] h-auto object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
