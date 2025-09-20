"use client";
import { GoHome } from "react-icons/go";
import { MdOutlineLeaderboard } from "react-icons/md";



import ContestBoard from "@/components/Contest";
import { useEffect, useState } from "react"
import LeaderBoard from "@/components/LeaderBoard"
import type WebApp from "@twa-dev/sdk"
import UserProfile from "@/components/Profile"
import Contest from "@/components/Contest"
import WalletPage from "@/components/WalletPage"
import LoginModule from "@/components/auth/LoginModule"
import { useAuth } from "./contexts/AuthContext"
import GamesPage from "@/components/games/GamesPage"
import { WheelOfFortune } from "@/components/Wheel"
import HomePage from "@/components/HomePage"
import { LogOut } from "lucide-react";
import Image from "next/image";
import TasksPage from "@/components/TasksPage"

// Force dynamic rendering since this page uses client-side features
export const dynamic = "force-dynamic";

function Home() {
  const [selectedTab, setSelectedTab]: any = useState("Home");
  const [tg, setTg] = useState<typeof WebApp | null>(null);

  const { user, isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    if (tg) return;
    let count = 0;
    const getTg = setInterval(() => {
      // Check if we're in browser environment

      const _tg = window?.Telegram?.WebApp;
      if (_tg) {
        setTg(_tg);
        clearInterval(getTg);
      }

      if (count > 10) {
        clearInterval(getTg);
      }
      count++;
    }, 10000);
  }, []);

  const handlePageChange = (page: string) => {
    setSelectedTab(page);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen tropical-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-4 border-b-4 border-orange-400"></div>
      </div>
    );
  }

  // Show login if not authenticated
  // if (!isAuthenticated) {


    return <LoginModule />;
  // }
//   return (
//     <div className="max-h-screen tropical-gradient">
//       <div>
//         <div className="max-w-[430px] no-scrollbar mx-auto relative min-h-screen">
//           <div className="flex flex-col no-scrollbar h-screen">
//           {/* <button
//                 onClick={() => logout()}
//                 className="absolute top-6 mt-10 right-6 z-50 w-12 h-12 bg-cover bg-center bg-no-repeat hover:scale-110 transition-all duration-200 shadow-lg"
//                 style={{
//                   backgroundImage: "url('/assets/buttons/power-button.png')",
//                 }}
//                 title="Logout"
//               ></button> */}

//             <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
//             {selectedTab === "Home" && <HomePage onNavigate={handlePageChange} />}
//               {selectedTab === "Profile" && <UserProfile tg={tg} />}
//               {selectedTab === "Tasks" && <TasksPage tg={tg} />}
//               {selectedTab === "Contest" && <Contest />}
//               {selectedTab === "Wheel" && <WheelOfFortune />}
//               {selectedTab === "Game" && <GamesPage />}
//               {selectedTab === "Leaderboard" && <LeaderBoard />}
//               {selectedTab === "Wallet" && <WalletPage />}
//             </div>

//             <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
//               <div className="max-w-[430px] mx-auto">
//                 <div className="flex justify-around items-center px-2 py-2">
//                   <button
//                     onClick={() => handlePageChange("Home")}
//                     className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ${
//                       selectedTab === "Home" ? "bg-orange-100 scale-105" : "hover:bg-gray-50 hover:scale-105"
//                     }`}
//                   >
//                     <Image
//   src="/assets/nav/profile.png"
//   alt="Profile"
//   width={32}
//   height={32}
//   className="w-8 h-8 mb-1"
// />
//                     <span
//                       className={`text-xs font-semibold ${
//                         selectedTab === "Home" ? "text-orange-600" : "text-gray-600"
//                       }`}
//                     >
//                       Profile
//                     </span>
//                   </button>

//                   <button
//                     onClick={() => handlePageChange("Wheel")}
//                     className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ${
//                       selectedTab === "Wheel" ? "bg-orange-100 scale-105" : "hover:bg-gray-50 hover:scale-105"
//                     }`}
//                   >
//                     <Image
//   src="/assets/nav/wheel.webp"
//   alt="Wheel"
//   width={32}
//   height={32}
//   className="w-8 h-8 mb-1"
// />
//                     <span
//                       className={`text-xs font-semibold ${
//                         selectedTab === "Wheel" ? "text-orange-600" : "text-gray-600"
//                       }`}
//                     >
//                       Wheel
//                     </span>
//                   </button>

//                   <button
//                     onClick={() => handlePageChange("Game")}
//                     className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ${
//                       selectedTab === "Game" ? "bg-orange-100 scale-105" : "hover:bg-gray-50 hover:scale-105"
//                     }`}
//                   >
//                     <Image
//   src="/assets/nav/games.webp"
//   alt="Games"
//   width={32}
//   height={32}
//   className="w-8 h-8 mb-1"
// />
//                     <span
//                      className={`text-xs font-semibold ${
//                         selectedTab === "Game" ? "text-orange-600" : "text-gray-600"
//                       }`}
//                     >
//                       Game
//                     </span>
//                   </button>

//                   <button
//                     onClick={() => handlePageChange("Leaderboard")}
//                     className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ${
//                       selectedTab === "Leaderboard" ? "bg-orange-100 scale-105" : "hover:bg-gray-50 hover:scale-105"
//                     }`}
//                   >
//                     <Image
//   src="/assets/nav/rank.png"
//   alt="Ranks"
//   width={32}
//   height={32}
//   className="w-8 h-8 mb-1"
// />
//                     <span
//                       className={`text-xs font-semibold ${
//                         selectedTab === "Leaderboard" ? "text-orange-600" : "text-gray-600"
//                       }`}
//                     >
//                       Ranks
//                     </span>
//                   </button>

//                   <button
//                     onClick={() => handlePageChange("Wallet")}
//                     className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ${
//                       selectedTab === "Wallet" ? "bg-orange-100 scale-105" : "hover:bg-gray-50 hover:scale-105"
//                     }`}
//                   >
//                     <Image
//   src="/assets/nav/wallet.webp"
//   alt="Wallet"
//   width={32}
//   height={32}
//   className="w-8 h-8 mb-1"
// />
//                     <span
//                       className={`text-xs font-semibold ${
//                         selectedTab === "Wallet" ? "text-orange-600" : "text-gray-600"
//                       }`}
//                     >
//                       Wallet
//                     </span>
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
}

export default Home;
