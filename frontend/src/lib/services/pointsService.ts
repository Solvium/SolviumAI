export const ACTIVITY_POINTS = {
  GAME_WIN: 50,
  GAME_PARTICIPATION: 10,
  TASK_COMPLETION: 25,
  CONTEST_PARTICIPATION: 30,
  CONTEST_WIN: 100,
  DAILY_LOGIN: 5,
  SPIN_WHEEL: 15,
  REFERRAL: 100,
  ACHIEVEMENT_UNLOCK: 75,
} as const;

export type ActivityType = keyof typeof ACTIVITY_POINTS;

export const getPointsForActivity = (activityType: ActivityType): number => {
  return ACTIVITY_POINTS[activityType];
};
