// Game utilities for routing and navigation

export type GameId = 
  | "wordle" 
  | "quiz" 
  | "puzzle" 
  | "picture-puzzle" 
  | "num-genius" 
  | "cross-word";

export interface GameInfo {
  id: GameId;
  title: string;
  description: string;
  route: string;
}

export const GAME_ROUTES: Record<GameId, GameInfo> = {
  wordle: {
    id: "wordle",
    title: "WORDLE",
    description: "Guess the word in 6 tries",
    route: "/game/wordle",
  },
  quiz: {
    id: "quiz",
    title: "QUIZ",
    description: "Test your knowledge",
    route: "/game/quiz",
  },
  puzzle: {
    id: "puzzle",
    title: "PUZZLE",
    description: "Solve the picture puzzle",
    route: "/game/puzzle",
  },
  "picture-puzzle": {
    id: "picture-puzzle",
    title: "PICTURE PUZZLE",
    description: "Arrange the pieces",
    route: "/game/picture-puzzle",
  },
  "num-genius": {
    id: "num-genius",
    title: "NUM GENIUS",
    description: "Number puzzle challenge",
    route: "/game/num-genius",
  },
  "cross-word": {
    id: "cross-word",
    title: "CROSSWORD",
    description: "Word puzzle game",
    route: "/game/cross-word",
  },
};

/**
 * Get game information by ID
 */
export function getGameInfo(gameId: string): GameInfo | null {
  return GAME_ROUTES[gameId as GameId] || null;
}

/**
 * Generate game URL
 */
export function getGameUrl(gameId: GameId): string {
  return GAME_ROUTES[gameId]?.route || "/";
}

/**
 * Check if a game ID is valid
 */
export function isValidGameId(gameId: string): gameId is GameId {
  return gameId in GAME_ROUTES;
}

/**
 * Get all available games
 */
export function getAllGames(): GameInfo[] {
  return Object.values(GAME_ROUTES);
}
