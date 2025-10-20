export interface WordleConfig {
  level: number;
  difficulty: "Easy" | "Medium" | "Hard";
  autoStart: boolean;
  showHints: boolean;
  soundEnabled: boolean;
  // Rewards and costs
  hintCost: number;
  baseWinSOLV: number;
  difficultyMultiplier: {
    Easy: number;
    Medium: number;
    Hard: number;
  };
  levelMultiplier: number;
  guessBonusPerRemaining: number;
  hintPenalty: number;
  // Daily limits and timers
  dailyHintsPerDifficulty: {
    Easy: number;
    Medium: number;
    Hard: number;
  };
  timeLimitPerDifficulty: {
    Easy: number; // seconds
    Medium: number;
    Hard: number;
  };
  fastCompletionBonus: {
    under30s: number;
    under60s: number;
    under120s: number;
  };
  // Progression tracking
  dailyResetTime: string; // "00:00" format
  streakBonus: number; // bonus per streak day
  maxStreakBonus: number; // cap on streak bonus
}

export interface QuizConfig {
  enabled: boolean;
  dailyLimit: number;
  timeLimit: number; // milliseconds
  categories: string[];
  pointsPerCorrect: number;
  speedBonusMultiplier: number;
  // Rewards and costs (same logic as wordle)
  baseWinSOLV: number;
  difficultyMultiplier: {
    Easy: number;
    Medium: number;
    Hard: number;
  };
  levelMultiplier: number;
  fastCompletionBonus: {
    under30s: number;
    under60s: number;
    under120s: number;
  };
  // Daily limits
  dailyQuizzesPerDifficulty: {
    Easy: number;
    Medium: number;
    Hard: number;
  };
  // Progression tracking
  dailyResetTime: string; // "00:00" format
  streakBonus: number;
  maxStreakBonus: number;
}

export interface GameConfig {
  wordle: WordleConfig;
  quiz: QuizConfig;
  // Future games will be added here
  // puzzle: PuzzleConfig;
  // wheel: WheelConfig;
}

export const DEFAULT_WORDLE_CONFIG: WordleConfig = {
  level: 1,
  difficulty: "Easy",
  autoStart: false,
  showHints: true,
  soundEnabled: true,
  // Rewards and costs
  hintCost: 15,
  baseWinSOLV: 20,
  difficultyMultiplier: {
    Easy: 1.0,
    Medium: 1.5,
    Hard: 2.0,
  },
  levelMultiplier: 0.1, // 10% bonus per level
  guessBonusPerRemaining: 5,
  hintPenalty: 5,
  // Daily limits and timers
  dailyHintsPerDifficulty: {
    Easy: 3,
    Medium: 2,
    Hard: 1,
  },
  timeLimitPerDifficulty: {
    Easy: 300, // 5 minutes
    Medium: 600, // 10 minutes
    Hard: 900, // 15 minutes
  },
  fastCompletionBonus: {
    under30s: 50,
    under60s: 30,
    under120s: 15,
  },
  // Progression tracking
  dailyResetTime: "00:00", // midnight reset
  streakBonus: 10, // 10 points per streak day
  maxStreakBonus: 100, // cap at 10 days
};

export interface DailyProgress {
  date: string; // YYYY-MM-DD format
  hintsUsed: {
    Easy: number;
    Medium: number;
    Hard: number;
  };
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  bestStreak: number;
  totalSOLVEarned: number;
  fastestCompletion?: number; // seconds
}

export const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  enabled: true,
  dailyLimit: 50,
  timeLimit: 60000, // 1 minute in milliseconds
  categories: [
    "science",
    "history",
    "geography",
    "sports",
    "entertainment",
    "technology",
    "literature",
    "art",
    "music",
    "general",
  ],
  pointsPerCorrect: 10,
  speedBonusMultiplier: 1.5, // 50% bonus for fast completion
  // Rewards and costs (same logic as wordle)
  baseWinSOLV: 20,
  difficultyMultiplier: {
    Easy: 1.0,
    Medium: 1.5,
    Hard: 2.0,
  },
  levelMultiplier: 0.1, // 10% bonus per level
  fastCompletionBonus: {
    under30s: 50,
    under60s: 30,
    under120s: 15,
  },
  // Daily limits
  dailyQuizzesPerDifficulty: {
    Easy: 20,
    Medium: 20,
    Hard: 10,
  },
  // Progression tracking
  dailyResetTime: "00:00", // midnight reset
  streakBonus: 10, // 10 points per streak day
  maxStreakBonus: 100, // cap at 10 days
};

export const DEFAULT_GAME_CONFIG: GameConfig = {
  wordle: DEFAULT_WORDLE_CONFIG,
  quiz: DEFAULT_QUIZ_CONFIG,
};
