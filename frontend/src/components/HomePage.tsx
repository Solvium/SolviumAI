"use client"
import Image from "next/image"

const HomePage = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  return (
    <div
    className="max-h-screen w-full py-24 px-4 md:py-32 relative overflow-hidden"

      style={{
        backgroundImage: "url('/tropical-adventure-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-none-transparent pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.1),transparent_50%)] pointer-events-none"></div>

      <div className="max-w-2xl mx-auto space-y-4 relative z-10">
        <div className="fixed right-1 mt-5 top transform -translate-y-1/2 z-20 flex flex-col gap-4">
          <button
            onClick={() => onNavigate("Profile")}
            className="w-16 h-16 bg-none"
           
          >
            <Image
  src="/assets/nav/profile.png"
  alt="Profile"
  width={48}   // same as w-12 (12 * 4px = 48px)
  height={48}  // same as h-12
  className="rounded-full" // you can still style with Tailwind
/>
          </button>

          <button
            onClick={() => onNavigate("Tasks")}
            className="w-16 h-16 bg-none"
           
          >
           <Image
  src="/assets/nav/Tasks.png"
  alt="Tasks"
  width={32}   // w-8 → 8 * 4px = 32px
  height={48}  // h-12 → 12 * 4px = 48px
  className="object-contain" // optional, keeps proportions if needed
/>
          </button>

          <button
            onClick={() => onNavigate("Contest")}
            className="w-16 h-16 bg-none"
           
          >
             <Image
  src="/assets/nav/Contest.png"
  alt="Tasks"
  width={40}   // w-10 → 10 * 4px = 40px
  height={56}  // h-14 → 14 * 4px = 56px
  className="object-contain"
/>
          </button>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
          <div className="relative">
            <div className="w-32 h-32 mx-auto bg-none">
            <Image
  src="/assets/logo/solvium_logo.jpg"  // ✅ replace with your image path
  alt="Star"
  width={160}       // ✅ same as w-16 (16 * 4px = 64px)
  height={160}      // ✅ same as h-16
  className="w-40 h-40 object-contain"
  priority
/>

            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/30 to-blue-500/30 rounded-full blur-xl animate-pulse"></div>
          </div>

          <div className="space-y-6 max-w-lg">
  {/* ✅ Digitalt for heading */}
  <h1 className="font-digitalt text-4xl font-black text-white uppercase tracking-wider drop-shadow-lg">
    Welcome to Solvium
  </h1>

  {/* ✅ Sans-serif for body text */}
  <div className="space-y-6 text-white font-sans">
    <p className="text-sm text-justify font-bold leading-relaxed">
      Embark on an epic adventure in the world of Solvium, where strategy meets fortune!
    </p>

    <p className="text-sm text-justify font-bold leading-relaxed">
      Mine SOLV tokens, complete challenging tasks, spin the wheel of fortune, and compete with players
      worldwide. Build your empire, unlock powerful multipliers, and climb the leaderboards to become the
      ultimate Solvium champion.
    </p>

    <p className="text-sm mb-8 text-justify font-bold text-amber-300">
      Your journey to greatness starts here. Are you ready to conquer Solvium?
    </p>
  </div>

  {/* ✅ Sans-serif for action labels */}
  <div className="flex items-center justify-center gap-4 mt-20 font-sans">
    <div className="flex flex-col items-center gap-2">
    <Image
  src="/assets/profile/coins.webp"
  alt="Coins"
  width={32}   // w-8 → 8 * 4px = 32px
  height={32}  // h-8 → 8 * 4px = 32px
  className="object-contain"
/>
      <span className="text-white text-sm  font-bold">Mine Tokens</span>
    </div>
    <div className="flex flex-col items-center gap-2">
    <Image
  src="/key.png"
  alt="Tasks"
  width={32}   // w-8 → 8 * 4px = 32px
  height={32}  // h-8 → 8 * 4px = 32px
  className="object-contain"
/>
      <span className="text-white font-bold text-sm">Complete Tasks</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <svg className="w-8 h-8 text-orange-300" fill="currentColor" viewBox="0 0 24 24">
        <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V7C19 10.31 16.31 13 13 13H11C7.69 13 5 10.31 5 7V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V7C7 9.21 8.79 11 11 11H13C15.21 11 17 9.21 17 7V6H7ZM9 15H15L14 17H10L9 15ZM8 19H16V21H8V19Z" />
      </svg>
      <span className="text-white text-sm font-bold">Win Contests</span>
    </div>
  </div>
</div>

        </div>
      </div>
    </div>
  )
}

export default HomePage
