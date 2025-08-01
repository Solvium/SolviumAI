interface UserProfile {
  id: number;
  username: string;
  name: string;
  wallet: string;
  referredBy: string | null;
  chain: string | null;
  level: number;
  difficulty: number;
  puzzleCount: number;
  referralCount: number;
  chatId: string;
  spinCount: number;
  claimCount: number;
  totalPoints: number;
  isOfficial: boolean;
  isMining: boolean;
  isPremium: boolean;
  lastClaim: string | Date; // ISO timestamp format
  weeklyPoints: number;
}

// For stricter type checking with string dates:
type UserProfileStrict = Omit<UserProfile, "lastClaim"> & {
  lastClaim: Date;
};

// Optional: Type for API response wrapper
interface ApiUserResponse {
  data: UserProfile;
  timestamp: number;
  status: "success" | "error";
}

type UserData = {
  id: number;
  username: string;
  name: string | null;
  wallet: string | null;
  email: string | null;
  referredBy: string;
  chain: string | null;
  level: number;
  difficulty: number;
  puzzleCount: number;
  referralCount: number;
  chatId: string | null;
  spinCount: number;
  dailySpinCount: number;
  claimCount: number;
  lastSpinClaim: Date;
  totalPoints: number;
  isOfficial: boolean;
  isMining: boolean;
  isPremium: boolean;
  lastClaim: Date;
  UserTasks: UserTask[];
  weeklyPoints: number;
  WeeklyScores: WeeklyScore[];

  // New fields
  telegramId: string | null;
  wallets: Wallet[];
  linkedAccounts: LoginMethod[];
};

type Wallet = {
  id: number;
  chain: string;
  address: string;
  userId: number;
  user: UserData;
};

type LoginMethod = {
  id: number;
  type: string;
  value: string;
  userId: number;
  user: UserData;
};

// Assuming these exist in your system
type UserTask = {
  // UserTask properties
};

type WeeklyScore = {
  // WeeklyScore properties
};
