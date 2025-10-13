import React, { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Lightbulb,
  Trophy,
  Coins,
  Gift,
  Brain,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import HintSystem from "../monetization/HintSystem";

// Logic and reasoning questions that require deduction
const LOGIC_QUESTIONS = [
  {
    id: "l1",
    question:
      "If all roses are flowers and some flowers fade quickly, which statement must be true?",
    options: [
      "All roses fade quickly",
      "Some roses fade quickly",
      "No roses fade quickly",
      "Roses never fade quickly",
    ],
    correctAnswer: "Some roses fade quickly",
    explanation:
      "Since roses are a subset of flowers, and some flowers fade quickly, it's possible (but not necessary) that some roses are among those flowers that fade quickly.",
    hint: "Think about the relationship between sets and subsets",
    difficulty: "hard",
  },
  {
    id: "l2",
    question:
      "A doctor has three patients: Alex, Blake, and Casey. One has the flu, one has a cold, and one has allergies. Using the clues below, determine who has allergies:\n- The patient with the cold is not Alex\n- Blake does not have the flu\n- Casey does not have allergies",
    options: [
      "Alex has allergies",
      "Blake has allergies",
      "Casey has allergies",
      "Cannot be determined",
    ],
    correctAnswer: "Blake has allergies",
    explanation:
      "Casey doesn't have allergies (given). If Blake doesn't have the flu, and the patient with the cold is not Alex, then Alex must have the flu, and Blake must have allergies.",
    hint: "Make a table with all possibilities and eliminate them one by one",
    difficulty: "hard",
  },
  {
    id: "l3",
    question:
      "Four friends (Alex, Blair, Casey, and Drew) each ordered a different dessert (cake, ice cream, pie, and cookies). From the clues below, determine who ordered the pie:\n- Alex ordered either the cake or the cookies\n- Drew did not order ice cream\n- Blair ordered cookies\n- Casey did not order cake",
    options: [
      "Alex ordered pie",
      "Blair ordered pie",
      "Casey ordered pie",
      "Drew ordered pie",
    ],
    correctAnswer: "Drew ordered pie",
    explanation:
      "Blair ordered cookies (given). Alex ordered either cake or cookies, but since Blair has cookies, Alex must have cake. Casey didn't order cake, and we know about cookies and cake, so Casey must have ordered ice cream. Since all other desserts are accounted for, Drew must have ordered pie.",
    hint: "Write out all four people and all four desserts, then use the process of elimination",
    difficulty: "hard",
  },
  {
    id: "l4",
    question:
      "If I have 10 socks in a drawer (5 black, 3 blue, 2 red), how many socks must I pull out to guarantee I have a matching pair?",
    options: ["2 socks", "3 socks", "4 socks", "5 socks"],
    correctAnswer: "4 socks",
    explanation:
      "In the worst case, I might pull out 1 black, 1 blue, and 1 red sock. The 4th sock must match one of these colors, giving me a pair.",
    hint: "Consider the worst-case scenario: pulling one of each color before getting a match",
    difficulty: "medium",
  },
  {
    id: "l5",
    question:
      "A farmer needs to take a fox, a chicken, and a bag of grain across a river. The boat can only carry the farmer and one item at a time. If left alone, the fox will eat the chicken, and the chicken will eat the grain. How many river crossings will the farmer need to make (including returns)?",
    options: ["3 crossings", "5 crossings", "7 crossings", "9 crossings"],
    correctAnswer: "7 crossings",
    explanation:
      "The farmer must: 1) Take chicken across, 2) Return alone, 3) Take fox across, 4) Return with chicken, 5) Take grain across, 6) Return alone, 7) Take chicken across.",
    hint: "Think about which item can be safely left with which other item",
    difficulty: "hard",
  },
];

interface LogicQuizGameProps {
  onEarnCoins?: (amount: number) => void;
}

const LogicQuizGame: React.FC<LogicQuizGameProps> = ({
  onEarnCoins = () => {},
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [userCoins, setUserCoins] = useState(150);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  const currentQuestion = LOGIC_QUESTIONS[currentQuestionIndex];

  const handleAnswer = (answer: string) => {
    if (selectedAnswer !== null) return;

    setSelectedAnswer(answer);
    const correct = answer === currentQuestion.correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      const pointsEarned = currentQuestion.difficulty === "medium" ? 25 : 50;
      setScore((prev) => prev + pointsEarned);
      toast.success(`Correct! +${pointsEarned} points`);
    } else {
      toast.error("Incorrect answer");
    }

    setShowExplanation(true);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < LOGIC_QUESTIONS.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setShowExplanation(false);
    } else {
      setGameOver(true);

      // Calculate rewards based on score
      const coinReward = Math.floor(score / 5); // More generous reward for harder questions
      setUserCoins((prev) => prev + coinReward);
      onEarnCoins(coinReward);

      toast.success(`Logic Quiz completed! You earned ${coinReward} coins!`);
    }
  };

  const handleUseHint = () => {
    setUserCoins((prev) => prev - 15); // Higher cost for logic hints
    setHintsUsed((prev) => prev + 1);
  };

  const handlePlayAgain = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setGameOver(false);
    setScore(0);
    setHintsUsed(0);
    setShowExplanation(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center flex justify-between items-center">
          <span className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-game-accent" />
            Logic Challenge
          </span>
          {!gameOver && (
            <div className="text-sm font-normal flex items-center gap-2">
              <span className="bg-primary/10 px-2 py-1 rounded-md">
                Score: {score}
              </span>
              <HintSystem
                hintCost={15}
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
                  Challenge {currentQuestionIndex + 1} of{" "}
                  {LOGIC_QUESTIONS.length}
                </span>
                <span>Difficulty: {currentQuestion.difficulty}</span>
              </div>
              <div className="bg-muted/30 p-3 rounded-lg mb-4 whitespace-pre-line">
                <h3 className="text-lg font-medium">
                  {currentQuestion.question}
                </h3>
              </div>

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

              {showExplanation && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-sm font-medium mb-1">Explanation:</p>
                  <p className="text-sm">{currentQuestion.explanation}</p>
                </div>
              )}
            </div>

            {selectedAnswer && (
              <div className="flex justify-end">
                <Button onClick={handleNextQuestion}>
                  {currentQuestionIndex < LOGIC_QUESTIONS.length - 1
                    ? "Next Challenge"
                    : "See Results"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center space-y-6">
            <div className="text-3xl mb-2">🧠</div>
            <h3 className="text-xl font-bold">Logic Challenge Complete!</h3>
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
                  +{Math.floor(score / 5)} coins
                </span>
              </div>
              <div className="bg-primary/10 rounded p-3 text-center">
                <Brain className="w-5 h-5 mx-auto mb-1 text-game-accent" />
                <span className="text-xs block">Logic Master</span>
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

export default LogicQuizGame;
