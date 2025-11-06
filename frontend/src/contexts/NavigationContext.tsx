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

  // Check URL params first (for Telegram start_param)
  const urlParams = getUrlParams();
  let route = urlParams.get("route");
  
  // If no route param, check window.location.pathname
  if (!route) {
    route = window.location.pathname;
  }
  
  // Also check Telegram's start_param directly if available
  if (!route && typeof window !== "undefined") {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.start_param) {
      const startParam = tg.initDataUnsafe.start_param;
      // Handle compact formats like "game-wordle" or "game_wordle"
      const compactMatch = startParam.match(/^game[-_]([a-z0-9-]+)$/i);
      if (compactMatch && compactMatch[1]) {
        const gameId = compactMatch[1].toLowerCase().replace(/_/g, "-");
        route = `/game/${gameId}`;
      } else if (/^[a-z0-9-]+$/i.test(startParam)) {
        // Plain game id provided (e.g., "wordle")
        const normalizedGameId = startParam.toLowerCase().replace(/_/g, "-");
        route = `/game/${normalizedGameId}`;
      } else {
        // Try to parse as URL parameters
        try {
          const startParams = new URLSearchParams(startParam);
          route = startParams.get("route") || route;
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
  }

  // Map routes to AppPage types
  if (route && route.includes("/game/wordle")) return "GameWordle";
  if (route && route.includes("/game/quiz")) return "GameQuiz";
  if (route && route.includes("/game/puzzle")) return "GamePuzzle";
  if (route && route.includes("/game/num-genius")) return "GameNumGenius";
  if (route && route.includes("/game/cross-word")) return "GameCrossWord";
  if (route && route.includes("/game")) return "Game";

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
