"use client"
import Image from "next/image";
import { Montserrat } from "next/font/google"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
})

const HomePage = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  return (
    <div className="h-[calc(100vh-75px)] w-full bg-[#040022] flex flex-col">
      {/* Header */}
      <div className="px-4 py-5 pt-10">
        <div className="flex items-center justify-between mb-8">
          <button className="text-white text-xs sm:text-sm font-medium">Cancel</button>
          <h1 className="text-[#BDECFB] text-sm sm:text-lg font-medium">Welcome to Solvium</h1>
          <button className="text-white">
            <Image
              src="/assets/header/menu-dots.png"
              alt="Menu"
              width={24}
              height={24}
              className="w-5 h-5 sm:w-6 sm:h-6"
            />
          </button>
        </div>

        {/* Navigation row */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">
          {/* Tasks */}
          <button onClick={() => onNavigate("Tasks")} className="flex-1 max-w-[100px] sm:max-w-[120px]">
            <Image
              src="/assets/header/task-button.svg"
              alt="Tasks"
              width={120}
              height={48}
              className="h-10 sm:h-12 w-full object-contain"
            />
          </button>

          {/* Profile */}
          <button onClick={() => onNavigate("Profile")} className="flex flex-1 items-center justify-center gap-1 sm:gap-2 max-w-[120px] sm:max-w-[140px]">
            <Image
              src="/assets/header/profile-avatar.svg"
              alt="Profile"
              width={48}
              height={48}
              className="w-10 h-10 sm:w-12 sm:h-12"
            />
            <span className="text-white text-xs sm:text-sm font-bold tracking-wide">
              Clinton
            </span>
          </button>

          {/* Contest */}
          <button onClick={() => onNavigate("Contest")} className="flex-1 max-w-[100px] sm:max-w-[120px]">
            <Image
              src="/assets/header/contest-button.svg"
              alt="Contests"
              width={120}
              height={48}
              className="h-10 sm:h-12 w-full object-contain"
            />
          </button>
        </div>
      </div>

      {/* Body that grows/shrinks */}
      <div className="flex flex-col justify-center px-2 pt-10 space-y-4">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          {/* Motivational text */}
          <div className="space-y-0 pb-5">
            <h2 className={`${montserrat.className} text-[#FBBC05] text-[9px] sm:text-[10px] font-normal leading-relaxed`}>
              Your Journey to greatness starts here.
            </h2>
            <h3 className={`${montserrat.className} text-[#FBBC05] text-[9px] sm:text-[10px] font-normal`}>
              Are you ready to conquer Solvium?
            </h3>
          </div>

          {/* Progress bar */}
          <div className="w-[70%] sm:w-[80%] max-w-md mx-auto px-3 sm:px-5">
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
            <span className={`${montserrat.className} text-[#FDE92D] text-3xl sm:text-3xl md:text-3xl font-bold tracking-normal`}>
              1,034,900,000
            </span>
          </div>

          {/* Big home image */}
          <div className="flex items-center pt-6 justify-center">
            <Image
              src="/assets/background/home-image.svg"
              alt="Home"
              width={364}
              height={390}
              className="w-[97%] max-w-[364px] h-auto object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
