export const ACTIVITY_POINTS = {
  GAME_WIN: 1,
  GAME_PARTICIPATION: 1,
  TASK_COMPLETION: 1,
  CONTEST_PARTICIPATION: 1,
  CONTEST_WIN: 1,
  DAILY_LOGIN: 1,
  SPIN_WHEEL: 1,
  REFERRAL: 1,
  ACHIEVEMENT_UNLOCK: 1,
  // Wordle specific activities
  WORDLE_WIN: 1, // 1 XP per win
  WORDLE_PARTICIPATION: 1,
} as const;

export type ActivityType = keyof typeof ACTIVITY_POINTS;

export const getPointsForActivity = (activityType: ActivityType): number => {
  return ACTIVITY_POINTS[activityType];
};
