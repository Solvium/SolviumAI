"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import WordleGame from "./wordle/WordleGame"
import QuizGame from "./quiz/QuizGame"
import { PicturePuzzle } from "./puzzle/Game"
import { ChevronLeft } from "lucide-react"
import Image from "next/image"

const GamesPage = () => {
  const navigate = useRouter()
  const [activeGame, setActiveGame] = useState<Element | any>(null)

  const games = [
    {
      id: "wordle",
      title: "WORDLE",
      component: <WordleGame />,
      image: "/assets/games/wordle-button.svg",
    },
    {
      id: "quiz",
      title: "QUIZ",
      component: <QuizGame />,
      image: "/assets/games/quiz-button.svg",
    },
    {
      id: "puzzle",
      title: "PUZZLE",
      component: <PicturePuzzle />,
      image: "/assets/games/puzzle-button.svg",
    },
  ]

  const handleGameSelect = (game: any) => {
    setActiveGame(game.component)
  }

  return (
    <>
      {activeGame == null ? (
        <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-b from-[#0a0520] via-[#1a0f3e] to-[#0a0520]">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-20 left-10 w-16 h-16 bg-pink-500/30 rounded-full blur-xl animate-pulse" />
            <div className="absolute top-40 right-20 w-12 h-12 bg-purple-500/30 rounded-full blur-xl animate-pulse delay-100" />
            <div className="absolute bottom-40 left-20 w-20 h-20 bg-blue-500/30 rounded-full blur-xl animate-pulse delay-200" />
            <div className="absolute bottom-60 right-10 w-14 h-14 bg-pink-500/30 rounded-full blur-xl animate-pulse delay-300" />
            <div className="absolute top-1/2 left-1/4 w-10 h-10 bg-purple-500/20 rounded-full blur-lg animate-pulse delay-150" />
          </div>

          <div className="absolute top-6 left-4 z-20">
            <button
              onClick={() => navigate.back()}
              className="flex items-center gap-2 text-white hover:text-purple-300 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
              <span className="text-lg font-semibold">Back</span>
            </button>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 pt-20 pb-8">
            <h1
              className="text-5xl md:text-6xl font-bold text-white mb-16 text-center tracking-[0.3em] drop-shadow-2xl"
              style={{ fontFamily: "monospace", letterSpacing: "0.2em" }}
            >
              SELECT GAME
            </h1>

            <div className="flex flex-col gap-6 w-full max-w-md mb-8">
              {games.map((game) => (
                <button
                  key={game.id}
                  onClick={() => handleGameSelect(game)}
                  className="relative w-full h-24 transform transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none"
                >
                  <Image src={game.image || "/placeholder.svg"} alt={game.title} fill className="object-contain" />
                </button>
              ))}
            </div>

            <div className="absolute top-[60%] right-8 w-48 h-48 md:w-56 md:h-56">
              <Image
                src="/assets/games/mascot.svg"
                alt="Mascot"
                fill
                className="object-contain drop-shadow-2xl"
              />
            </div>

            <div className="relative z-10 mt-auto">
              <p className="text-white text-xl font-semibold drop-shadow-lg">Choose Your Adventure</p>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-blue-900/20 to-transparent">
              <div
                className="absolute bottom-0 left-0 right-0 h-24 opacity-20"
                style={{
                  backgroundImage: `
                       linear-gradient(to right, rgba(59, 130, 246, 0.3) 1px, transparent 1px),
                       linear-gradient(to bottom, rgba(59, 130, 246, 0.3) 1px, transparent 1px)
                     `,
                  backgroundSize: "40px 40px",
                  transform: "perspective(500px) rotateX(60deg)",
                  transformOrigin: "bottom",
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full pb-2 max-h-screen">
          <ChevronLeft
            className="absolute top-4 left-4 z-20 cursor-pointer text-white hover:text-yellow-400 transition-colors w-6 h-6 md:w-8 md:h-8 mt-3"
            onClick={() => setActiveGame(null)}
          />
          <div className="w-full max-h-screen">{activeGame}</div>
        </div>
      )}
    </>
  )
}

export default GamesPage
