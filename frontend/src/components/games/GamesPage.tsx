"use client";
import React, { useState, useEffect } from "react";
// import { toast } from "sonner";
import { useRouter } from "next/navigation";
import GameTabs from "./GameTabs";
import GameGrid from "./GameGrid";
import WordleGame from "./wordle/WordleGame";
import LogicQuizGame from "./quiz/LogicQuizGame";
import QuizGame from "./quiz/QuizGame";
import { PicturePuzzle } from "./puzzle/Game";
import { ArrowLeft } from "lucide-react";

// Layout Components

// Mock data - using the same data structure as the Index page
const getGamesForCategory = (category: string) => {
  const allGames = {
    wordle: [
      {
        id: "wordle",
        title: "Wordle",
        description:
          "Guess the 5-letter word in 6 tries. A new puzzle each day!",
        emoji: "🧠",
      },
    ],
    puzzles: [
      {
        id: "picture_puzzle",
        title: "Picture Puzzle",
        description:
          "Arrange the image tiles in the correct order by matching them.",
        emoji: "🧩",
      },
      //   {
      //     id: "memory-match",
      //     title: "Memory Match",
      //     description:
      //       "Find matching pairs of cards in the least number of moves.",
      //     emoji: "🔍",
      //   },
      //   {
      //     id: "sudoku",
      //     title: "Sudoku",
      //     description: "Fill the grid so each row, column, and box contains 1-9.",
      //     emoji: "🔢",
      //   },
    ],

    daily: [
      {
        id: "daily-wordle",
        title: "Today's Wordle",
        description:
          "The official daily word challenge that everyone is playing.",
        emoji: "📅",
      },
      {
        id: "daily-puzzle",
        title: "Daily Brain Teaser",
        description: "A new logic puzzle every day to keep your mind sharp.",
        emoji: "🧠",
      },
      {
        id: "daily-bonus",
        title: "Daily Bonus Game",
        description: "Play for extra points and rewards. Changes every day!",
        emoji: "🎁",
      },
    ],
    quiz: [
      {
        id: "quiz-trivia",
        title: "Trivia Quiz",
        description:
          "Test your knowledge with trivia questions from various topics.",
        emoji: "❓",
      },
      {
        id: "quiz-logic",
        title: "Logic Challenge",
        description:
          "Advanced puzzles that test your reasoning and deduction skills.",
        emoji: "🧩",
      },
      // {
      //   id: "quiz-daily",
      //   title: "Daily Quiz",
      //   description:
      //     "New set of questions every day with bonus rewards for completion.",
      //   emoji: "🏆",
      // },
    ],
  };

  return allGames[category as keyof typeof allGames] || [];
};

const GamesPage = () => {
  // State
  const navigate = useRouter();
  const [activeTab, setActiveTab] = useState("wordle");
  const [activeGame, setActiveGame] = useState<Element | any>(null);
  const [games, setGames] = useState(getGamesForCategory("wordle"));
  const [currentSection, setCurrentSection] = useState("Games");
  const [coinBalance, setCoinBalance] = useState(150);

  // Update games when tab changes
  useEffect(() => {
    setGames(getGamesForCategory(activeTab));

    // Update the current section based on active tab
    const tabLabels: Record<string, string> = {
      wordle: "Wordle",
      puzzles: "Puzzle",
      // daily: "Daily Challenges",
      quiz: "Quizzes",
    };

    setCurrentSection(tabLabels[activeTab] || "Games");
  }, [activeTab]);

  // Handle play game
  const handlePlayGame = (id: string) => {
    // Route to the appropriate game page based on the game id
    if (id === "wordle") {
      //   navigate.push("/wordle");
      setActiveGame(<WordleGame />);
      return;
    } else if (id.startsWith("quiz-")) {
      if (id.includes("logic")) {
        setActiveGame(<LogicQuizGame />);
      }
      if (id.includes("trivia")) {
        setActiveGame(<QuizGame />);
      }
      //   navigate.push("/quiz");
      return;
    } else if (id.startsWith("picture")) {
      setActiveGame(<PicturePuzzle />);
    }
  };

  // Handle page change
  const handleTabChange = (page: string) => {
    setActiveTab(page);
  };

  console.log(activeGame);
  return (
    <>
      {activeGame == null ? (
        <div className="min-h-screen bg-background pb-16 animate-fade-in">
          {/* Top Navigation Bar */}
          {/* <TopNavBar currentSection={currentSection}>
        <CoinBalance
          balance={coinBalance}
          onAddCoins={() => navigate.push("/store")}
        />
      </TopNavBar> */}

          {/* Game Category Tabs */}
          <GameTabs activeTab={activeTab} onTabChange={handleTabChange} />

          {/* Main Content Area */}
          <main className="pb-4">
            <GameGrid games={games} onPlayGame={handlePlayGame} />
          </main>

          {/* Floating Action Button */}
          {/* <FloatingActionButton onClick={handlePlayRandom} /> */}

          {/* Bottom Navigation Bar */}
          {/* <BottomNavBar activePage={activePage} onPageChange={handlePageChange} /> */}
        </div>
      ) : (
        <div className="block">
          <ArrowLeft
            className="cursor-pointer mb-2"
            onClick={() => setActiveGame(null)}
          />
          <div className="w-full">{activeGame}</div>
        </div>
      )}
    </>
  );
};

export default GamesPage;
