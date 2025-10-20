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
    {
      id: "puzzle",
      title: "PUZZLE",
      component: <PicturePuzzle />,
      image: "/assets/games/num-genius.svg",
    },
    {
      id: "puzzle",
      title: "PUZZLE",
      component: <PicturePuzzle />,
      image: "/assets/games/cross-word.svg",
    },
  ]

  const handleGameSelect = (game: any) => {
    setActiveGame(game.component)
  }

  return (
    <>
      {activeGame == null ? (
        <div className="h-screen w-screen flex flex-col relative overflow-hidden bg-gradient-to-b from-[#0a0520] via-[#1a0f3e] to-[#0a0520]">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-20 left-10 w-16 h-16 bg-pink-500/30 rounded-full blur-xl animate-pulse" />
            <div className="absolute top-40 right-20 w-12 h-12 bg-purple-500/30 rounded-full blur-xl animate-pulse delay-100" />
            <div className="absolute bottom-40 left-20 w-20 h-20 bg-blue-500/30 rounded-full blur-xl animate-pulse delay-200" />
            <div className="absolute bottom-60 right-10 w-14 h-14 bg-pink-500/30 rounded-full blur-xl animate-pulse delay-300" />
            <div className="absolute top-1/2 left-1/4 w-10 h-10 bg-purple-500/20 rounded-full blur-lg animate-pulse delay-150" />
          </div>

          <div className="absolute top-6 left-4 z-20 mt-1">
            <button
              onClick={() => navigate.back()}
              className="flex items-center md:gap-2 gap-1 text-white hover:text-purple-300 transition-colors"
            >
              <ChevronLeft className="md:w-4 md:h-4 w-3 h-3" />
              <span className="text-xs md:text-sm font-semibold">Back</span>
            </button>
          </div>

          <div className="absolute top-5 md:right-8 right-4 z-20">
            <h1
              className="text-3xl md:text-4xl font-bold text-white tracking-[0.3em] drop-shadow-2xl"
              style={{ fontFamily: "'Pixelify Sans', monospace", letterSpacing: "0.2em" }}
            >
              SELECT GAME
            </h1>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 pt-24 pb-8">
            <div className="grid grid-cols-2 md:gap-6 gap-3 w-full max-w-md mb-8">
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

            <div className="absolute md:top-[70%] top-[62%] md:-right-4 -right-12 w-48 h-48 md:w-56 md:h-56">
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
          </div>
        </div>
      ) : (
        <div className="relative w-full pb-2 max-h-screen">
          <ChevronLeft
            className="absolute top-2 left-4 z-20 cursor-pointer text-white hover:text-yellow-400 transition-colors w-6 h-6 md:w-8 md:h-8 mt-3"
            onClick={() => setActiveGame(null)}
          />
          <div className="w-full max-h-screen">{activeGame}</div>
        </div>
      )}
    </>
  )
}

export default GamesPage
