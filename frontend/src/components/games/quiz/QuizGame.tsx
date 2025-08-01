import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Lightbulb,
  Trophy,
  Coins,
  Gift,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import HintSystem from "../monetization/HintSystem";

// Sample quiz questions
const QUESTIONS = [
  {
    id: "q1",
    question: "What is the capital of France?",
    options: ["Berlin", "Madrid", "Paris", "Rome"],
    correctAnswer: "Paris",
    hint: 'This city is known as the "City of Light"',
    difficulty: "easy",
  },
  {
    id: "q2",
    question: "Which planet is known as the Red Planet?",
    options: ["Jupiter", "Mars", "Venus", "Saturn"],
    correctAnswer: "Mars",
    hint: "Named after the Roman god of war",
    difficulty: "easy",
  },
  {
    id: "q3",
    question: "What is the largest mammal in the world?",
    options: ["Elephant", "Blue Whale", "Giraffe", "Polar Bear"],
    correctAnswer: "Blue Whale",
    hint: "It lives in the ocean and can weigh up to 200 tons",
    difficulty: "easy",
  },
  {
    id: "q4",
    question: 'Which element has the chemical symbol "O"?',
    options: ["Gold", "Oxygen", "Osmium", "Oganesson"],
    correctAnswer: "Oxygen",
    hint: "We breathe this element to survive",
    difficulty: "medium",
  },
  {
    id: "q5",
    question: "Who painted the Mona Lisa?",
    options: [
      "Vincent van Gogh",
      "Pablo Picasso",
      "Leonardo da Vinci",
      "Michelangelo",
    ],
    correctAnswer: "Leonardo da Vinci",
    hint: "This Italian Renaissance polymath also designed flying machines",
    difficulty: "medium",
  },
];

interface QuizGameProps {
  onEarnCoins?: (amount: number) => void;
}

const QuizGame: React.FC<QuizGameProps> = ({ onEarnCoins = () => {} }) => {
  const [questions, setQuestions] = useState(QUESTIONS);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [userCoins, setUserCoins] = useState(150);
  const [hintsUsed, setHintsUsed] = useState(0);

  // Shuffle questions on initial load
  useEffect(() => {
    const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5);
    setQuestions(shuffled.slice(0, 5)); // Take first 5 questions
  }, []);

  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswer = (answer: string) => {
    if (selectedAnswer !== null) return;

    setSelectedAnswer(answer);
    const correct = answer === currentQuestion.correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      const pointsEarned = currentQuestion.difficulty === "easy" ? 10 : 20;
      setScore((prev) => prev + pointsEarned);
      toast.success(`Correct! +${pointsEarned} points`);
    } else {
      toast.error("Incorrect answer");
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsCorrect(null);
    } else {
      setGameOver(true);

      // Calculate rewards based on score
      const coinReward = Math.floor(score / 10);
      setUserCoins((prev) => prev + coinReward);
      onEarnCoins(coinReward);

      toast.success(`Quiz completed! You earned ${coinReward} coins!`);
    }
  };

  const handleUseHint = () => {
    setUserCoins((prev) => prev - 10); // Deduct coins
    setHintsUsed((prev) => prev + 1);
  };

  const handlePlayAgain = () => {
    const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5);
    setQuestions(shuffled.slice(0, 5));
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setGameOver(false);
    setScore(0);
    setHintsUsed(0);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center flex justify-between items-center">
          <span>Quiz Game</span>
          {!gameOver && (
            <div className="text-sm font-normal flex items-center gap-2">
              <span className="bg-primary/10 px-2 py-1 rounded-md">
                Score: {score}
              </span>
              <HintSystem
                hintCost={10}
                hint={currentQuestion?.hint || ""}
                userCoins={userCoins}
                onUseHint={handleUseHint}
              />
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!gameOver ? (
          <>
            <div className="mb-6">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <span>Difficulty: {currentQuestion.difficulty}</span>
              </div>
              <h3 className="text-lg font-medium mb-4">
                {currentQuestion.question}
              </h3>

              <div className="space-y-3">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedAnswer === option
                        ? option === currentQuestion.correctAnswer
                          ? "bg-green-100 border-green-300"
                          : "bg-red-100 border-red-300"
                        : "hover:bg-secondary border-border"
                    }`}
                    onClick={() => handleAnswer(option)}
                    disabled={selectedAnswer !== null}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option}</span>
                      {selectedAnswer === option && (
                        <>
                          {option === currentQuestion.correctAnswer ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedAnswer && (
              <div className="flex justify-end">
                <Button onClick={handleNextQuestion}>
                  {currentQuestionIndex < questions.length - 1
                    ? "Next Question"
                    : "See Results"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center space-y-6">
            <div className="text-3xl mb-2">🎉</div>
            <h3 className="text-xl font-bold">Quiz Complete!</h3>
            <p className="text-lg">
              Your score: <span className="font-bold">{score}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Hints used: {hintsUsed}
            </p>

            <div className="grid grid-cols-3 gap-2 my-6">
              <div className="bg-primary/10 rounded p-3 text-center">
                <Trophy className="w-5 h-5 mx-auto mb-1 text-game-accent" />
                <span className="text-xs block">+{score} pts</span>
              </div>
              <div className="bg-primary/10 rounded p-3 text-center">
                <Coins className="w-5 h-5 mx-auto mb-1 text-game-accent" />
                <span className="text-xs block">
                  +{Math.floor(score / 10)} coins
                </span>
              </div>
              <div className="bg-primary/10 rounded p-3 text-center">
                <Gift className="w-5 h-5 mx-auto mb-1 text-game-accent" />
                <span className="text-xs block">🧠 Badge</span>
              </div>
            </div>

            <Button onClick={handlePlayAgain} className="w-full">
              Play Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuizGame;
