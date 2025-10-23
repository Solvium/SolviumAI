import { useRouter } from "next/navigation";
import { GameId, getGameUrl } from "./gameUtils";

/**
 * Navigation utilities for handling both internal app navigation and external routes
 */

export interface NavigationOptions {
  replace?: boolean;
  scroll?: boolean;
}

/**
 * Hook for enhanced navigation that supports both internal pages and external routes
 */
export function useEnhancedNavigation() {
  const router = useRouter();

  const navigateToGame = (gameId: GameId, options?: NavigationOptions) => {
    const gameUrl = getGameUrl(gameId);
    if (options?.replace) {
      router.replace(gameUrl);
    } else {
      router.push(gameUrl);
    }
  };

  const navigateToPage = (path: string, options?: NavigationOptions) => {
    if (options?.replace) {
      router.replace(path);
    } else {
      router.push(path);
    }
  };

  const goBack = () => {
    router.back();
  };

  return {
    navigateToGame,
    navigateToPage,
    goBack,
  };
}

/**
 * Generate game URLs for sharing or direct access
 */
export function generateGameShareUrl(gameId: GameId, baseUrl?: string): string {
  const gameUrl = getGameUrl(gameId);
  return baseUrl ? `${baseUrl}${gameUrl}` : gameUrl;
}

/**
 * Check if a path is a game route
 */
export function isGameRoute(path: string): boolean {
  return path.startsWith("/game/");
}

/**
 * Extract game ID from a game route
 */
export function extractGameIdFromPath(path: string): string | null {
  const match = path.match(/^\/game\/([^\/]+)/);
  return match ? match[1] : null;
}
