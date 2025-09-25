"use client"
import Image from "next/image";
import { Montserrat } from "next/font/google"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "700"], // include all you need (regular + bold)
  display: "swap",        // prevents layout shift
})

const HomePage = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  return (
    <div className="min-h-[calc(100vh-75px)] w-full" 
    style={{
      backgroundImage: "url('/assets/background/profile-background.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }}>
      <div className=" px-4 py-6 pt-10">
        {/* Header row with Cancel, Welcome text, and menu */}
        <div className="flex items-center justify-between mb-8">
          <button className="text-white text-sm font-medium">Cancel</button>
          <h1 className="text-[#BDECFB] text-lg font-medium">Welcome to Solvium</h1>
          <button className="text-white">
            <Image src="/assets/header/menu-dots.png" alt="Menu" width={24} height={24} className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation buttons row */}
        <div className="flex items-center justify-between gap-4">
          <button onClick={() => onNavigate("Tasks")} className="flex-shrink-0">
            <Image
              src="/assets/header/task-button.png"
              alt="Tasks"
              width={120}
              height={48}
              className="h-12 w-auto"
            />
          </button>

          <button 
  onClick={() => onNavigate("Profile")} 
  className="flex items-center gap-2 flex-shrink-0"
>
  <Image
    src="/assets/header/profile-avatar.png"
    alt="Profile"
    width={48}
    height={48}
    className="w-12 h-12"
  />
  <span className="text-white text-sm font-bold tracking-wider">
    Clinton
  </span>
</button>


          <button onClick={() => onNavigate("Contest")} className="flex-shrink-0">
            <Image
              src="/assets/header/contest-button.png"
              alt="Contests"
              width={120}
              height={48}
              className="h-12 w-auto"
            />
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 py-1">
        <div className="max-w-2xl mt-5 mx-auto text-center space-y-6">
          {/* Golden motivational text */}
          <div className="space-y-0">
  <h2 className={`${montserrat.className} text-[#FBBC05] text-xs font-normal leading-relaxed`}>
    Your Journey to greatness starts here.
  </h2>
  <h3 className={`${montserrat.className} text-[#FBBC05] text-xs font-normal`}>
    Are you ready to conquer Solvium?
  </h3>
</div>



          {/* Progress bar */}
          <div className="w-[80%] max-w-md mx-auto px-5">
            <div className="h-3 bg-[#B2D9FF] rounded-full overflow-hidden">
              <div
                className="h-[45%] mx-1 my-1 bg-[#0080FF] rounded-full shadow-lg"
                style={{
                  width: "75%",
                  boxShadow: "0 0 20px rgba(34, 211, 238, 0.6)",
                }}
              />
            </div>
          </div>

          {/* Coin and number display */}
          <div className="flex items-center justify-center gap-2 px-10">
            <Image
              src="/assets/coins/golden-coin.png"
              alt="Golden Coin"
              width={68}
              height={63}
              className="w-[68px] h-[63px]"
            />
            <span className={`${montserrat.className} text-yellow-400 text-4xl font-bold tracking-normal`}>
      1,034,900,000
    </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
