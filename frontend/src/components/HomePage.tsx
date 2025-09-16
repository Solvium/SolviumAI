"use client"

const HomePage = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  return (
    <div
      className="min-h-screen w-full py-3 px-3 md:py-4 relative overflow-hidden"
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
        <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-20 flex flex-col gap-4">
          <button
            onClick={() => onNavigate("Profile")}
            className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 shadow-lg border-2 border-cyan-300/30"
            style={{
              boxShadow:
                "0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 0 rgba(0,0,0,0.2)",
            }}
          >
            <img src="/assets/nav/profile.webp" alt="Profile" className="w-8 h-8" />
          </button>

          <button
            onClick={() => onNavigate("Tasks")}
            className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 shadow-lg border-2 border-purple-300/30"
            style={{
              boxShadow:
                "0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 0 rgba(0,0,0,0.2)",
            }}
          >
            <img src="/key.png" alt="Tasks" className="w-8 h-8" />
          </button>

          <button
            onClick={() => onNavigate("Contest")}
            className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 shadow-lg border-2 border-amber-300/30"
            style={{
              boxShadow:
                "0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 0 rgba(0,0,0,0.2)",
            }}
          >
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2.7-2h8.6l.9-5.4-2.1 1.8L12 8l-3.1 2.4-2.1-1.8L7.7 14z" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
          <div className="relative">
            <div className="w-32 h-32 mx-auto bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shadow-2xl">
              <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/30 to-blue-500/30 rounded-full blur-xl animate-pulse"></div>
          </div>

          <div className="space-y-6 max-w-lg">
            <h1 className="text-4xl font-black text-cyan-100 uppercase tracking-wider drop-shadow-lg">
              Welcome to Solvium
            </h1>

            <div className="space-y-4 text-cyan-100">
              <p className="text-lg font-bold leading-relaxed">
                Embark on an epic adventure in the world of Solvium, where strategy meets fortune!
              </p>

              <p className="text-base leading-relaxed">
                Mine SOLV tokens, complete challenging tasks, spin the wheel of fortune, and compete with players
                worldwide. Build your empire, unlock powerful multipliers, and climb the leaderboards to become the
                ultimate Solvium champion.
              </p>

              <p className="text-sm font-semibold text-amber-300">
                Your journey to greatness starts here. Are you ready to conquer Solvium?
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 mt-8">
              <div className="flex items-center gap-2">
                <img src="/assets/profile/coins.webp" alt="Coins" className="w-8 h-8" />
                <span className="text-amber-300 font-bold">Mine Tokens</span>
              </div>
              <div className="flex items-center gap-2">
                <img src="/key.png" alt="Tasks" className="w-8 h-8" />
                <span className="text-purple-300 font-bold">Complete Tasks</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-8 h-8 text-orange-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V7C19 10.31 16.31 13 13 13H11C7.69 13 5 10.31 5 7V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V7C7 9.21 8.79 11 11 11H13C15.21 11 17 9.21 17 7V6H7ZM9 15H15L14 17H10L9 15ZM8 19H16V21H8V19Z" />
                </svg>
                <span className="text-orange-300 font-bold">Win Contests</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
