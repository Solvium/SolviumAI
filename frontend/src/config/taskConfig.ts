export type TaskKey =
  | "daily_login"
  | "first_game_completed"
  | "weekly_champion";

export const taskConfig: Record<
  TaskKey,
  { displayName: string; solvReward: number }
> = {
  daily_login: {
    displayName: "Daily Login Streak",
    solvReward: 10,
  },
  first_game_completed: {
    displayName: "Play Your First Game",
    solvReward: 50,
  },
  weekly_champion: {
    displayName: "Weekly Champion",
    solvReward: 1000, // display-only for now
  },
};

export const DAILY_LOGIN_SOLV = taskConfig.daily_login.solvReward;
export const FIRST_GAME_SOLV = taskConfig.first_game_completed.solvReward;
