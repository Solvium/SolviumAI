"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type AppPage =
  | "Home"
  | "Profile"
  | "Tasks"
  | "Contest"
  | "Wheel"
  | "Game"
  | "Leaderboard"
  | "Wallet";

type NavigationContextValue = {
  currentPage: AppPage;
  navigate: (page: AppPage) => void;
  goBack: () => void;
  history: AppPage[];
};

const NavigationContext = createContext<NavigationContextValue | undefined>(
  undefined
);

export function NavigationProvider({
  children,
  initialPage = "Home",
}: {
  children: React.ReactNode;
  initialPage?: AppPage;
}) {
  const [currentPage, setCurrentPage] = useState<AppPage>(initialPage);
  const historyRef = useRef<AppPage[]>([initialPage]);

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

  const value = useMemo(
    () => ({
      currentPage,
      navigate,
      goBack,
      history: historyRef.current,
    }),
    [currentPage, navigate, goBack]
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

