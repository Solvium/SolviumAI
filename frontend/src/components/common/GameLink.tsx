"use client";

import Link from "next/link";
import { GameId, getGameInfo } from "@/lib/gameUtils";
import { ReactNode } from "react";

interface GameLinkProps {
  gameId: GameId;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function GameLink({
  gameId,
  children,
  className = "",
  onClick,
}: GameLinkProps) {
  const gameInfo = getGameInfo(gameId);

  if (!gameInfo) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link href={gameInfo.route} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

/**
 * Hook for programmatic game navigation
 */
export function useGameNavigation() {
  const navigateToGame = (gameId: GameId) => {
    const gameInfo = getGameInfo(gameId);
    if (gameInfo) {
      window.location.href = gameInfo.route;
    }
  };

  return { navigateToGame };
}
