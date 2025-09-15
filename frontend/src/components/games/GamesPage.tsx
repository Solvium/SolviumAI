"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import WordleGame from "./wordle/WordleGame"
import QuizGame from "./quiz/QuizGame"
import { PicturePuzzle } from "./puzzle/Game"
import { ArrowLeft } from "lucide-react"

const GamesPage = () => {
  const navigate = useRouter()
  const [activeGame, setActiveGame] = useState<Element | any>(null)

  const games = [
    {
      id: "wordle",
      title: "WORDLE",
      component: <WordleGame />,
    },
    {
      id: "quiz",
      title: "QUIZ",
      component: <QuizGame />,
    },
    {
      id: "puzzle",
      title: "PUZZLE",
      component: <PicturePuzzle />,
    },
  ]

  const handleGameSelect = (game: any) => {
    setActiveGame(game.component)
  }

  return (
    <>
      {activeGame == null ? (
        <div
          className="max-h-screen flex flex-col items-center justify-center pb-32 pt-20 p-6 bg-cover bg-center bg-no-repeat relative"
          style={{
            backgroundImage: "url('/tropical-adventure-bg.jpg')",
          }}
        >
          <div className="absolute inset-0 bg-black/30" />

          <div className="relative z-10 flex flex-col items-center">
            {/* Select Game Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-12 text-center tracking-wide drop-shadow-2xl">
              SELECT GAME
            </h1>

            {/* Game Selection Buttons */}
            <div className="flex flex-col gap-6 w-full max-w-sm">
              {games.map((game) => (
                <button
                  key={game.id}
                  onClick={() => handleGameSelect(game)}
                  className="relative w-full h-20 bg-cover bg-center bg-no-repeat transform transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-yellow-400/50"
                  style={{
                    backgroundImage: "url('/assets/buttons/wooden-button.png')",
                  }}
                >
                  {/* Button Text Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl md:text-3xl font-bold text-amber-900 drop-shadow-lg tracking-wider">
                      {game.title}
                    </span>
                  </div>

                  {/* Subtle glow effect on hover */}
                  <div className="absolute inset-0 bg-yellow-400/0 hover:bg-yellow-400/10 transition-all duration-200 rounded-lg" />
                </button>
              ))}
            </div>

            {/* Decorative elements */}
            <div className="mt-12 text-center">
              <p className="text-white/90 text-lg drop-shadow-lg">Choose your adventure</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full pb-2 max-h-screen">
          {/* Back arrow positioned absolutely within the game area */}
          <ArrowLeft
            className="absolute top-4 left-4 z-20 cursor-pointer text-white hover:text-yellow-400 transition-colors w-6 h-6 md:w-8 md:h-8 mt-3"
            onClick={() => setActiveGame(null)}
          />
          <div className="w-full mmax-h-screen">{activeGame}</div>
        </div>
      )}
    </>
  )
}

export default GamesPage
