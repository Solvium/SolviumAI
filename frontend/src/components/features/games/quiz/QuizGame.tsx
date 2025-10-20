"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

// Sample quiz questions
const QUESTIONS = [
  {
    id: "q1",
    question: "What is the capital of France?",
    options: ["Berlin", "Madrid", "Paris"],
    correctAnswer: "Paris",
    hint: 'This city is known as the "City of Light"',
    difficulty: "easy",
    image: "/mona-lisa-inspired.jpg",
  },
  {
    id: "q2",
    question: "Which planet is known as the Red Planet?",
    options: ["Jupiter", "Mars", "Venus"],
    correctAnswer: "Mars",
    hint: "Named after the Roman god of war",
    difficulty: "easy",
    image: "/mona-lisa-inspired.jpg",
  },
  {
    id: "q3",
    question: "What is the largest mammal in the world?",
    options: ["Elephant", "Blue Whale", "Giraffe"],
    correctAnswer: "Blue Whale",
    hint: "It lives in the ocean and can weigh up to 200 tons",
    difficulty: "easy",
    image: "/mona-lisa-inspired.jpg",
  },
  {
    id: "q4",
    question: 'Which element has the chemical symbol "O"?',
    options: ["Gold", "Oxygen", "Osmium"],
    correctAnswer: "Oxygen",
    hint: "We breathe this element to survive",
    difficulty: "medium",
    image: "/mona-lisa-inspired.jpg",
  },
  {
    id: "q5",
    question: "Who painted the Mona Lisa?",
    options: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci"],
    correctAnswer: "Leonardo da Vinci",
    hint: "This Italian Renaissance polymath also designed flying machines",
    difficulty: "medium",
    image: "/mona-lisa-inspired.png",
  },
  {
    id: "q6",
    question: "What is the name of the toy cowboy in Toy Story?",
    options: ["JACK", "WOODY", "BUZZ"],
    correctAnswer: "WOODY",
    hint: "He's the sheriff of Andy's toys",
    difficulty: "easy",
    image: "/mona-lisa-inspired.jpg",
  },
]

interface QuizGameProps {
  onEarnCoins?: (amount: number) => void
}

const QuizGame: React.FC<QuizGameProps> = ({ onEarnCoins = () => {} }) => {
  const router = useRouter()
  const [questions, setQuestions] = useState(QUESTIONS)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [userCoins, setUserCoins] = useState(150)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [timer, setTimer] = useState(5)

  useEffect(() => {
    const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5)
    setQuestions(shuffled.slice(0, 20))
  }, [])

  useEffect(() => {
    if (timer > 0 && !selectedAnswer) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [timer, selectedAnswer])

  const currentQuestion = questions[currentQuestionIndex]

  const handleAnswer = (answer: string) => {
    if (selectedAnswer !== null) return

    setSelectedAnswer(answer)
    const correct = answer === currentQuestion.correctAnswer
    setIsCorrect(correct)

    if (correct) {
      const pointsEarned = 10
      setScore((prev) => prev + pointsEarned)
      setUserCoins((prev) => prev + pointsEarned)
      onEarnCoins(pointsEarned)
      toast.success(`Correct! +${pointsEarned} Solv`)
    } else {
      toast.error("Incorrect answer")
    }

    setTimeout(() => {
      handleNextQuestion()
    }, 2000)
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
      setSelectedAnswer(null)
      setIsCorrect(null)
      setShowHint(false)
      setTimer(5)
    } else {
      setGameOver(true)
      toast.success(`Quiz completed! You earned ${score} coins!`)
    }
  }

  const handleUseHint = () => {
    if (userCoins >= 10) {
      setUserCoins((prev) => prev - 10)
      setHintsUsed((prev) => prev + 1)
      setShowHint(true)
      toast.info(currentQuestion.hint)
    } else {
      toast.error("Not enough coins for a hint!")
    }
  }

  const handlePlayAgain = () => {
    const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5)
    setQuestions(shuffled.slice(0, 20))
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setIsCorrect(null)
    setGameOver(false)
    setScore(0)
    setHintsUsed(0)
    setShowHint(false)
    setTimer(5)
  }

  return (
    <div className="h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float"
            style={{
              width: Math.random() * 6 + 2 + "px",
              height: Math.random() * 6 + 2 + "px",
              left: Math.random() * 100 + "%",
              top: Math.random() * 100 + "%",
              background: Math.random() > 0.5 ? "rgba(139, 92, 246, 0.3)" : "rgba(236, 72, 153, 0.3)",
              animationDelay: Math.random() * 5 + "s",
              animationDuration: Math.random() * 10 + 10 + "s",
              boxShadow: "0 0 20px currentColor",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 py-3 
      ">
        {/* <button onClick={() => router.back()} className="flex items-center gap-2 text-white">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs">Back</span>
        </button> */}

        <h1
          className="text-2xl font-bold text-white tracking-wider ml-16"
          style={{
            fontFamily: "monospace",
            textShadow: "0 0 10px rgba(255,255,255,0.5)",
          }}
        >
          QUIZ
        </h1>

        {!selectedAnswer && !gameOver && (
          <button onClick={handleUseHint} className="transition-transform hover:scale-105">
          <img 
            src="/assets/quiz/hint-button.svg"
            alt="Use Hint"
            className="w-24 h-auto"
          />
        </button>
        
        )}
        {(selectedAnswer || gameOver) && <div className="w-16" />}
      </div>

      {!gameOver ? (
        <div className="relative z-10 px-4 pb-8 overflow-y-auto max-h-[calc(100vh-120px)]">
          <div className="flex justify-center mb-3">
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.2)" strokeWidth="3" fill="none" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="white"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={`${(timer / 5) * 125.6} 125.6`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
                {String(timer).padStart(2, "0")}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <img
              src={currentQuestion.image || "/placeholder.svg"}
              alt="Question"
              className="w-full h-32 object-cover rounded-xl"
            />
          </div>

          <div className="mb-4">
            <p className="text-gray-400 text-xs mb-1">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
            <h2 className="text-white text-lg font-bold leading-tight">{currentQuestion.question}</h2>
          </div>

          <div className="space-y-2.5">
            {currentQuestion.options.map((option) => {
              const isSelected = selectedAnswer === option
              const isCorrectAnswer = option === currentQuestion.correctAnswer
              const showCorrect = isSelected && isCorrectAnswer
              const showIncorrect = isSelected && !isCorrectAnswer

              return (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  disabled={selectedAnswer !== null}
                  className={`w-full p-3 rounded-xl font-semibold text-base transition-all ${
                    showCorrect
                      ? "bg-white text-black"
                      : showIncorrect
                        ? "bg-red-500 text-white"
                        : "bg-white text-black hover:scale-105"
                  }`}
                  style={{
                    boxShadow: showCorrect ? "0 0 20px rgba(34, 197, 94, 0.5)" : "none",
                  }}
                >
                  <div className="flex items-center justify-between">
                    {showCorrect && (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mr-2">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <span className="flex-1 text-center">{option}</span>
                    {showCorrect && <div className="w-5" />}
                  </div>
                </button>
              )
            })}
          </div>

          {selectedAnswer && isCorrect && (
            <div className="mt-4 text-center space-y-2">
              <p className="text-white text-sm">That's the right Answer - +10 Solv</p>
              <div className="flex justify-center">
                <img src="/assets/games/Solvium-coin.svg" alt="Coin" className="w-10 h-10 animate-bounce" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative z-10 px-4 text-center space-y-4">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-white text-2xl font-bold">Quiz Complete!</h2>
          <p className="text-white text-lg">
            Your score: <span className="font-bold">{score}</span>
          </p>
          <p className="text-gray-400 text-sm">Hints used: {hintsUsed}</p>

          <button
            onClick={handlePlayAgain}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold text-base hover:scale-105 transition-transform"
          >
            Play Again
          </button>
        </div>
      )}

      <div
        className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(10, 14, 39, 0.8))",
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          transform: "perspective(500px) rotateX(60deg)",
          transformOrigin: "bottom",
        }}
      />
    </div>
  )
}

export default QuizGame
