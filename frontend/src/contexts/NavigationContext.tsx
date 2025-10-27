"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { getCurrentRoute, getUrlParams } from "@/lib/telegramRouting";

export type AppPage =
  | "Home"
  | "Profile"
  | "Tasks"
  | "Contest"
  | "Wheel"
  | "Game"
  | "Leaderboard"
  | "Wallet"
  | "GameWordle"
  | "GameQuiz"
  | "GamePuzzle"
  | "GameNumGenius"
  | "GameCrossWord";

type NavigationContextValue = {
  currentPage: AppPage;
  navigate: (page: AppPage) => void;
  goBack: () => void;
  history: AppPage[];
  navigateToGame: (gameId: string) => void;
};

const NavigationContext = createContext<NavigationContextValue | undefined>(
  undefined
);

// Helper function to get initial page from URL
function getInitialPageFromUrl(): AppPage {
  if (typeof window === "undefined") return "Home";

  const urlParams = getUrlParams();
  const route = urlParams.get("route") || window.location.pathname;

  // Map routes to AppPage types
  if (route.includes("/game/wordle")) return "GameWordle";
  if (route.includes("/game/quiz")) return "GameQuiz";
  if (route.includes("/game/puzzle")) return "GamePuzzle";
  if (route.includes("/game/num-genius")) return "GameNumGenius";
  if (route.includes("/game/cross-word")) return "GameCrossWord";
  if (route.includes("/game")) return "Game";

  return "Home";
}

export function NavigationProvider({
  children,
  initialPage,
}: {
  children: React.ReactNode;
  initialPage?: AppPage;
}) {
  const [currentPage, setCurrentPage] = useState<AppPage>(
    () => initialPage || getInitialPageFromUrl()
  );
  const historyRef = useRef<AppPage[]>([currentPage]);

  const navigate = useCallback(
    (page: AppPage) => {
      if (page === currentPage) return;
      historyRef.current = [...historyRef.current, page];
      setCurrentPage(page);
    },
    [currentPage]
  );

  const goBack = useCallback(() => {
    if (historyRef.current.length <= 1) {
      setCurrentPage("Home");
      historyRef.current = ["Home"];
      return;
    }
    const newHistory = historyRef.current.slice(0, -1);
    const previous = newHistory[newHistory.length - 1] ?? "Home";
    historyRef.current = newHistory;
    setCurrentPage(previous);
  }, []);

  const navigateToGame = useCallback(
    (gameId: string) => {
      const gamePageMap: Record<string, AppPage> = {
        wordle: "GameWordle",
        quiz: "GameQuiz",
        puzzle: "GamePuzzle",
        "num-genius": "GameNumGenius",
        "cross-word": "GameCrossWord",
      };

      const gamePage = gamePageMap[gameId] || "Game";
      navigate(gamePage);
    },
    [navigate]
  );

  const value = useMemo(
    () => ({
      currentPage,
      navigate,
      goBack,
      history: historyRef.current,
      navigateToGame,
    }),
    [currentPage, navigate, goBack, navigateToGame]
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx)
    throw new Error("useNavigation must be used within a NavigationProvider");
  return ctx;
}
