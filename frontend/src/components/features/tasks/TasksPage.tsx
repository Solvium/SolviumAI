"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type WebApp from "@twa-dev/sdk";
import axios from "axios";
import { FaXTwitter, FaTelegram } from "react-icons/fa6";
import {
  Gamepad2,
  Target,
  Trophy,
  Users,
  Star,
  ArrowLeft,
  Info,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSolviumContract } from "@/hooks/useSolviumContract";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { useTaskProgress } from "@/hooks/useTaskProgress";
import { useBalanceCache } from "@/hooks/useBalanceCache";
import { useToast } from "@/hooks/use-toast";
import { throttleApiCall } from "@/lib/requestThrottler";
import { taskConfig } from "@/config/taskConfig";

const Tasks = ({ tg }: { tg: typeof WebApp | null }) => {
  const [loading, setLoading] = useState({ id: "", status: false });
  const router = useRouter();
  const [onGoing, setOnGoing] = useState(false);
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [nearAmount, setNearAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [nearBalance, setNearBalance] = useState<string>("0.00");
  const [userDepositSummary, setUserDepositSummary] = useState<any>(null);
  const [spinsAvailable, setSpinsAvailable] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [contractMultiplierFactor, setContractMultiplierFactor] =
    useState<number>(1);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    remaining: number;
    resetIn: number;
  } | null>(null);
  const [gamingLoadingId, setGamingLoadingId] = useState<string | null>(null);

  const { user: userDetails, refreshUser, trackLogin } = useAuth();
  const {
    depositToGame,
    isConnected,
    isLoading: contractLoading,
    getUserDepositSummary,
    getSpinsAvailable,
    getMultiplierFactor,
  } = useSolviumContract();
  const { account, accountId } = usePrivateKeyWallet();
  const {
    taskProgress,
    completeDailyLogin,
    completeFirstGame,
    checkFirstGameStatus,
  } = useTaskProgress();
  const { fetchBalance, getCachedBalance } = useBalanceCache();
  const { toast } = useToast();

  // Refs to control effect executions
  // Derived flags from userTasks
  const firstGameClaimed = userTasks?.some(
    (ut: any) => ut?.task?.name === "First Game Reward" && ut?.isCompleted
  );

  // Daily login availability (disable button if already logged today)
  const alreadyLoggedToday = (() => {
    const last = userDetails?.lastClaim
      ? new Date(String(userDetails.lastClaim))
      : null;
    if (!last) return false;
    const today = new Date();
    return last.toDateString() === today.toDateString();
  })();
  const didInitialFetchRef = useRef<string | null>(null); // tracks by user id
  const didLoginTrackRef = useRef<string | null>(null); // tracks by user id
  const lastWalletKeyRef = useRef<string | null>(null); // tracks by `${isConnected}:${accountId}`
  const trackLoginRef = useRef(trackLogin);
  useEffect(() => {
    trackLoginRef.current = trackLogin;
  }, [trackLogin]);

  const gamingTasks = [
    {
      id: "daily-login",
      name: taskConfig.daily_login.displayName,
      description: "Login 7 days in a row for bonus rewards",
      points: taskConfig.daily_login.solvReward,
      icon: <Gamepad2 className="w-6 h-6" />,
      progress: taskProgress.dailyLoginStreak,
      maxProgress: taskProgress.maxStreak,
      category: "gaming",
      // Completed only when streak target reached (keeps green style for true completion)
      completed: taskProgress.dailyLoginStreak >= taskProgress.maxStreak,
    },
    {
      id: "first-game",
      name: taskConfig.first_game_completed.displayName,
      description: "Complete a game session to unlock achievements",
      points: taskConfig.first_game_completed.solvReward,
      icon: <Target className="w-6 h-6" />,
      category: "gaming",
      // Keep card non-green; disable button separately when claimed
      completed: false,
    },
    {
      id: "weekly-champion",
      name: taskConfig.weekly_champion.displayName,
      description: "Reach top 10 on weekly leaderboard",
      points: taskConfig.weekly_champion.solvReward,
      icon: <Trophy className="w-6 h-6" />,
      category: "special",
      completed:
        taskProgress.weeklyRank !== null && taskProgress.weeklyRank <= 10,
      progress: taskProgress.weeklyRank || 0,
      maxProgress: 10,
    },
  ];

  // Calculate multiplier tiers based on contract multiplier factor
  const multiplierTiers = [
    { amount: 1, multiplier: 1 + contractMultiplierFactor * 0.5 },
    { amount: 5, multiplier: 1 + contractMultiplierFactor * 1 },
    { amount: 10, multiplier: 1 + contractMultiplierFactor * 2 },
    { amount: 25, multiplier: 1 + contractMultiplierFactor * 4 },
  ];

  // Debug log for multiplier tiers when contract factor changes
  useEffect(() => {
    console.log(
      "Multiplier tiers updated:",
      multiplierTiers.map(
        (tier) => `${tier.amount} NEAR = ${tier.multiplier.toFixed(1)}x`
      )
    );
  }, [contractMultiplierFactor]);

  const fetchTasks = async () => {
    try {
      setIsLoadingTasks(true);
      const response = await throttleApiCall(
        "tasks",
        () => fetch("/api/tasks"),
        200 // 200ms delay
      );

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error(
          "Server returned non-JSON response:",
          response.status,
          response.statusText
        );
        setTasks([
          {
            id: 1,
            name: "Subscribe to YouTube",
            points: 10,
            link: "https://www.youtube.com/@solvium_puzzle",
            category: "social",
          },
          {
            id: 2,
            name: "Follow X",
            points: 10,
            link: "https://x.com/Solvium_game",
            category: "social",
          },
          {
            id: 3,
            name: "Join Solvium Telegram Group",
            points: 10,
            link: "https://t.me/solvium_puzzle",
            category: "social",
          },
          {
            id: 4,
            name: "Join Announcement Channel",
            points: 10,
            link: "https://t.me/solviumupdate",
            category: "social",
          },
          {
            id: 5,
            name: "Follow Facebook",
            points: 10,
            link: "https://www.facebook.com/profile.php?id=61566560151625&mibextid=LQQJ4d",
            category: "social",
          },
        ]);
        setUserTasks([]);
        return;
      }

      const data = await response.json();

      if (response.ok) {
        setTasks(data.tasks || []);
        setUserTasks(data.userTasks || []);
      } else {
        console.error("Failed to fetch tasks:", data.error);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTasks([
        {
          id: 1,
          name: "Subscribe to YouTube",
          points: 10,
          link: "https://www.youtube.com/@solvium_puzzle",
          category: "social",
        },
        {
          id: 2,
          name: "Follow X",
          points: 10,
          link: "https://x.com/Solvium_game",
          category: "social",
        },
        {
          id: 3,
          name: "Join Solvium Telegram Group",
          points: 10,
          link: "https://t.me/solvium_puzzle",
          category: "social",
        },
        {
          id: 4,
          name: "Join Announcement Channel",
          points: 10,
          link: "https://t.me/solviumupdate",
          category: "social",
        },
        {
          id: 5,
          name: "Follow Facebook",
          points: 10,
          link: "https://www.facebook.com/profile.php?id=61566560151625&mibextid=LQQJ4d",
          category: "social",
        },
      ]);
      setUserTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Initial page load fetch: runs once per user id
  useEffect(() => {
    const userId = userDetails?.id ? String(userDetails.id) : null;
    // Always fetch tasks on initial mount (even without a user)
    if (!didInitialFetchRef.current) {
      didInitialFetchRef.current = "mounted";
      const anonTimer = setTimeout(() => {
        fetchTasks();
      }, 50);
      return () => clearTimeout(anonTimer);
    }

    // If we have a user, run user-specific initializations once per user id
    if (!userId) return;
    if (didInitialFetchRef.current === userId) return;
    didInitialFetchRef.current = userId;

    const timer = setTimeout(() => {
      fetchTasks();
      fetchRealTimeData();

      if (didLoginTrackRef.current !== userId) {
        didLoginTrackRef.current = userId;
        throttleApiCall(
          "login-track",
          () => trackLoginRef.current(),
          300
        ).catch(console.error);
      }

      // Evaluate first game status once on load
      checkFirstGameStatus();
    }, 100);

    return () => clearTimeout(timer);
  }, [userDetails?.id, checkFirstGameStatus]);

  // Refresh data when wallet connection state changes (tracked key)
  useEffect(() => {
    const key = `${Boolean(isConnected)}:${accountId || ""}`;
    if (!isConnected || !accountId) {
      lastWalletKeyRef.current = key;
      return;
    }

    if (lastWalletKeyRef.current === key) return;
    lastWalletKeyRef.current = key;

    const timer = setTimeout(() => {
      fetchRealTimeData();
    }, 200);

    return () => clearTimeout(timer);
  }, [isConnected, accountId]);

  // Auto-refresh data every 10 minutes (much reduced frequency)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected && accountId && !isRefreshing) {
        fetchRealTimeData();
      }
    }, 600000); // 10 minutes

    return () => clearInterval(interval);
  }, [isConnected, accountId, isRefreshing]);

  // Fetch real-time data from contract and wallet (with debounce and caching)
  const fetchRealTimeData = async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      // Always-safe public fetches (no wallet required)
      try {
        const rateLimitResponse = await fetch(
          "/api/wallet?action=rate-limit-status"
        );
        if (rateLimitResponse.ok) {
          const rateLimitData = await rateLimitResponse.json();
          setRateLimitInfo(rateLimitData);
        }
      } catch (error) {
        console.log("Could not fetch rate limit status:", error);
      }

      // Wallet/contract reads (only when connected with account)
      if (isConnected && accountId) {
        if (account) {
          const nearBalance = await fetchBalance(account, accountId);
          setNearBalance(nearBalance);
        }

        const [depositSummary, spins, multiplier] = await Promise.all([
          getUserDepositSummary(accountId),
          getSpinsAvailable(accountId),
          getMultiplierFactor(accountId),
        ]);

        if (depositSummary.success) {
          setUserDepositSummary(depositSummary.data);
        }

        if (spins.success) {
          setSpinsAvailable(spins.data || 0);
        }

        if (multiplier.success) {
          const contractMultiplier = multiplier.data || 1;
          setContractMultiplierFactor(contractMultiplier);
          if (userDetails?.multiplier !== contractMultiplier) {
            await refreshUser();
          }
        }
      }
    } catch (error) {
      console.error("Error fetching real-time data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshTasks = async () => {
    await fetchTasks();
  };

  const engageTasks = async (
    type: string,
    data: any,
    func: (param: boolean) => void
  ) => {
    func(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: userDetails?.username,
          type: type,
          data: data,
          userMultipler: userDetails?.multiplier || 1,
        }),
      });

      const result = await response.json();

      if (response.ok && (result.weeklyScore || result.id || result.success)) {
        await refreshUser();
        await refreshTasks();
        toast({
          title: "Task Completed!",
          description: "Your points have been updated.",
          variant: "default",
        });
      } else {
        console.error("Task engagement failed:", result.error || result);
        const errorMessage =
          result.error ||
          result.message ||
          "Task engagement failed. Please try again.";
        toast({
          title: "Task Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error engaging task:", error);
      toast({
        title: "Network Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to connect to server. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      func(false);
    }
  };

  const sendComplete = async (data: any) => {
    const taskData = {
      task: data,
      userId: userDetails?.id,
    };
    await engageTasks("completetasks", taskData, () =>
      setLoading({ id: data.id, status: false })
    );
  };

  const ProcessLink = async (data: any) => {
    setLoading({ id: data.id, status: true });
    await engageTasks("reg4tasks", data, () =>
      setLoading({ id: data.id, status: false })
    );
    if (!data?.link) return;
    data.link && window?.open(data.link);
  };

  const Verify = async (data: any) => {
    setLoading({ id: data.id, status: true });
    setError("");

    if (
      data.name.includes("Join Solvium Telegram Group") ||
      data.name.includes("Join Telegram Channel")
    ) {
      try {
        const response = await axios.get(
          `https://api.telegram.org/bot${process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID}&user_id=${userDetails?.chatId}`
        );

        if (response.data.result.user.username == userDetails?.username) {
          if (response.data.result.status == "member") {
            sendComplete(data);
            return;
          } else {
            setError("You have not Joined Group yet!");
            toast({
              title: "Group Error",
              description:
                "You have not joined the Telegram group yet! Please join the group first.",
              variant: "destructive",
            });
            setLoading({ id: data.id, status: false });
            setTimeout(() => {
              data.link && tg?.openLink(data.link);
            }, 2000);
            return;
          }
        } else {
          setError("An error occurred, Please try again!");
          toast({
            title: "Verification Error",
            description:
              "Verification failed. Please try again or contact support.",
            variant: "destructive",
          });
          setLoading({ id: data.id, status: false });
          return;
        }
      } catch (error) {
        setError("An error occurred, Please try again!");
        toast({
          title: "Network Error",
          description:
            "Network error during verification. Please check your connection and try again.",
          variant: "destructive",
        });
        setLoading({ id: data.id, status: false });
        return;
      }
    }

    sendComplete(data);
  };

  const handleDeposit = async () => {
    if (!nearAmount || Number.parseFloat(nearAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid NEAR amount",
        variant: "destructive",
      });
      return;
    }

    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    setDepositLoading(true);

    try {
      // Use the Solvium contract hook
      const result = await depositToGame(nearAmount);

      if (result.success) {
        toast({
          title: "Deposit Successful!",
          description: `Successfully deposited ${nearAmount} NEAR to the game`,
          variant: "default",
        });

        setNearAmount("");

        // Refresh user data and real-time data
        await refreshUser();
        await fetchRealTimeData();
      } else {
        throw new Error(result.error || "Deposit failed");
      }
    } catch (error) {
      console.error("Deposit error:", error);
      toast({
        title: "Deposit Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to deposit NEAR. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDepositLoading(false);
    }
  };

  // Handle gaming task completion (API-based, no wallet required)
  const handleGamingTask = async (taskId: string) => {
    try {
      setGamingLoadingId(taskId);
      let success = false;
      let alreadyToastShown = false;

      switch (taskId) {
        case "daily-login":
          console.log("[ui] Daily login clicked. Starting flow...");
          {
            const result = await completeDailyLogin();
            if (result.status === "new") {
              success = true;
            } else if (result.status === "already") {
              toast({
                title: "Already logged in today",
                description: `Come back at ${result.nextResetAt} (${result.timeLeft}) to continue your streak. Current streak: ${result.streak} day(s).`,
                variant: "default",
              });
              alreadyToastShown = true;
              success = true; // treat as handled
            } else {
              success = false;
            }
          }
          break;
        case "first-game":
          console.log("[ui] First game clicked. Starting flow...");
          success = await completeFirstGame();
          console.log("[ui] First game flow finished. Success:", success);
          break;
        case "weekly-champion":
          // Weekly champion is automatically tracked, no manual completion needed
          toast({
            title: "Weekly Champion",
            description:
              "Your rank is automatically tracked. Keep playing to improve!",
            variant: "default",
          });
          return;
        default:
          throw new Error("Unknown task");
      }

      if (success) {
        console.log("[ui] Task flow succeeded:", taskId);
        if (!alreadyToastShown) {
          toast({
            title: "Task Completed!",
            description: "Your progress has been updated.",
            variant: "default",
          });
        }
        await refreshUser();
        // Skip wallet/contract reads for non-wallet tasks to avoid near-rpc calls
        if (taskId !== "daily-login" && taskId !== "first-game") {
          await fetchRealTimeData();
        }
      } else {
        console.log("[ui] Task flow failed:", taskId);
        throw new Error("Task completion failed");
      }
    } catch (error) {
      console.error("Gaming task error:", error);
      toast({
        title: "Task Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to complete task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGamingLoadingId(null);
    }
  };

  const getTaskIcon = (taskName: string) => {
    if (
      taskName.toLowerCase().includes("x") ||
      taskName.toLowerCase().includes("twitter")
    ) {
      return <FaXTwitter className="w-6 h-6" />;
    }
    if (taskName.toLowerCase().includes("telegram")) {
      return <FaTelegram className="w-6 h-6" />;
    }
    if (
      taskName.toLowerCase().includes("invite") ||
      taskName.toLowerCase().includes("friend")
    ) {
      return <Users className="w-6 h-6" />;
    }
    return <Star className="w-6 h-6" />;
  };

  return (
    <div className="h-screen bg-[#0A0A1F] text-white overflow-y-auto">
      <div className="px-4 pt-6 pb-12">
        {/* <button
          className="flex items-center gap-2 text-white mb-4"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button> */}
        {/* <h1
          className="text-3xl font-bold text-center mb-2 tracking-wider"
          style={{
            fontFamily: "'Press Start 2P', monospace",
            textShadow: "2px 2px 0px rgba(0,0,0,0.5)",
          }}
        >
          TASK CENTER
        </h1> */}


        <div className="absolute top-6 left-4 z-20 mt-1 mb-5">
                    <button
                        onClick={() => router.push("/")}
                      className="flex items-center gap-2 text-white hover:text-purple-300 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span className="text-[8px] lg:text-lg font-semibold">Back</span>
                    </button>
                  </div>
        
                  <div className="absolute top-5 right-11 z-20">
                    <h1
                      className="text-3xl md:text-4xl font-bold text-white tracking-[0.3em] drop-shadow-2xl"
                      style={{ fontFamily: "'Pixelify Sans', monospace", letterSpacing: "0.1em" }}
                    >
                       TASK CENTER
                    </h1>
                  </div>
        <p className="text-center mt-10 text-sm text-gray-400">
          Complete tasks to earn SOLV points and unlock multipliers
        </p>
      </div>

      <div className="px-4 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold">
              {(userDetails as any)?.totalSOLV ?? userDetails?.totalPoints ?? 0}
            </div>

            <div className="text-xs text-white/80 mt-1">SOLV Points</div>
          </div>
          <div className="bg-[#1a1a3e] border-2 border-blue-500/30 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold">{nearBalance}</div>
            <div className="text-xs text-gray-400 mt-1">NEAR</div>
          </div>
          <div className="bg-[#1a1a3e] border-2 border-purple-500/30 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold">
              {userDetails?.multiplier || 1}x
            </div>
            <div className="text-xs text-gray-400 mt-1">Multiplier</div>
          </div>
        </div>
      </div>

      <div className="px-4 mb-6">
        <div className="bg-[#1a1a3e] border-2 border-blue-500/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                <span className="text-lg">💰</span>
              </div>
              <h3 className="text-lg font-bold">
                Deposit NEAR for Multipliers
              </h3>
            </div>
            <Info className="w-5 h-5 text-gray-400" />
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="number"
              placeholder="Enter NEAR amount"
              value={nearAmount}
              onChange={(e) => setNearAmount(e.target.value)}
              className="flex-1 bg-[#0f0f2a] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
            />
            <button
              onClick={handleDeposit}
              disabled={depositLoading || contractLoading || !isConnected}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
            >
              {depositLoading || contractLoading
                ? "..."
                : !isConnected
                ? "Connect Wallet"
                : "Deposit"}
            </button>
          </div>

          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-gradient-to-br from-blue-400 to-cyan-500 rounded flex items-center justify-center text-xs">
                ⚡
              </div>
              <span className="text-sm font-medium text-gray-300">
                Multiplier Tiers
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {multiplierTiers.map((tier) => (
                <button
                  key={tier.amount}
                  onClick={() => setNearAmount(tier.amount.toString())}
                  className="bg-[#0f0f2a] hover:bg-[#1a1a3e] border border-gray-700 hover:border-blue-500/50 rounded-xl px-3 py-2 text-sm font-medium transition-all flex items-center justify-between"
                >
                  <span>{tier.amount} NEAR</span>
                  <span className="bg-gradient-to-r from-blue-400 to-cyan-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                    +{tier.multiplier.toFixed(1)}x
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Higher deposits unlock better point multipliers for all tasks
          </p>

          {/* Multiplier Calculation Info */}
          {isConnected && contractMultiplierFactor > 1 && (
            <div className="mt-3 p-2 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-300 text-center">
                <span className="text-blue-400">Formula:</span> Base (1x) +
                (Contract Factor × Deposit Tier)
              </p>
              <p className="text-xs text-gray-400 text-center mt-1">
                Current Contract Factor:{" "}
                <span className="text-purple-400">
                  {contractMultiplierFactor}x
                </span>
              </p>
            </div>
          )}

          {/* Contract Multiplier Factor Info */}
          {isConnected && contractMultiplierFactor > 1 && (
            <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">⚡</span>
                </div>
                <span className="text-sm font-medium text-blue-300">
                  Contract Multiplier Factor
                </span>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {contractMultiplierFactor}x
                </div>
                <div className="text-xs text-blue-300">
                  Base multiplier factor from contract
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contract Data Display */}
      {isConnected && (userDepositSummary || spinsAvailable > 0) && (
        <div className="px-4 mb-6">
          <div className="bg-[#1a1a3e] border-2 border-green-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                <span className="text-lg">📊</span>
              </div>
              <h3 className="text-lg font-bold">Contract Data</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {spinsAvailable > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {spinsAvailable}
                  </div>
                  <div className="text-xs text-gray-400">Spins Available</div>
                </div>
              )}

              {userDepositSummary && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {(
                      parseFloat(userDepositSummary.totalDeposits || "0") / 1e24
                    ).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-400">Total Deposited</div>
                </div>
              )}

              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {contractMultiplierFactor}x
                </div>
                <div className="text-xs text-gray-400">Multiplier Factor</div>
              </div>
            </div>

            {/* Rate Limit Status */}
            {rateLimitInfo && (
              <div className="mt-4 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">⏱</span>
                  </div>
                  <span className="text-xs text-yellow-300">
                    API Calls: {rateLimitInfo.remaining}/6 remaining
                    {rateLimitInfo.resetIn > 0 && (
                      <span className="ml-2">
                        (resets in {rateLimitInfo.resetIn}s)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-yellow-400" />
          <h2 className="text-xl font-bold">Gaming Tasks</h2>
        </div>

        <div className="space-y-3">
          {gamingTasks.map((task) => (
            <div
              key={task.id}
              className={`rounded-2xl p-5 border-2 ${
                task.completed
                  ? "bg-gradient-to-br from-green-500 to-green-600 border-green-400/30"
                  : task.category === "special"
                  ? "bg-gradient-to-br from-pink-500 to-purple-600 border-pink-400/30"
                  : "bg-gradient-to-br from-blue-600/40 to-blue-800/40 border-blue-500/30"
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  {task.completed ? (
                    <span className="text-green-400 text-xl">✓</span>
                  ) : (
                    task.icon
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-base font-bold">
                      {task.completed ? `${task.name} ✓` : task.name}
                    </h3>
                    <span className="bg-gradient-to-r from-orange-400 to-orange-600 text-white text-xs px-3 py-1 rounded-full font-bold whitespace-nowrap ml-2">
                      +{task.points} SOLV
                    </span>
                  </div>
                  <p className="text-sm text-white/70">{task.description}</p>
                </div>
              </div>

              {task.progress !== undefined && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-white/70">Progress</span>
                    <span className="font-bold">
                      {task.progress}/{task.maxProgress}
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        task.completed
                          ? "bg-gradient-to-r from-green-400 to-green-500"
                          : "bg-gradient-to-r from-cyan-400 to-blue-500"
                      }`}
                      style={{
                        width: `${Math.min(
                          (task.progress / task.maxProgress) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={() => handleGamingTask(task.id)}
                disabled={
                  gamingLoadingId === task.id ||
                  (task.id === "daily-login" && alreadyLoggedToday) ||
                  (task.id === "first-game" && firstGameClaimed) ||
                  (task.completed && task.id !== "first-game")
                }
                className={`w-full py-3 rounded-xl font-bold transition-all ${
                  (task.completed && task.id !== "first-game") ||
                  (task.id === "daily-login" && alreadyLoggedToday) ||
                  (task.id === "first-game" && firstGameClaimed)
                    ? "bg-green-400 text-green-900 cursor-not-allowed"
                    : task.category === "special"
                    ? "bg-white text-purple-600 hover:bg-gray-100 disabled:opacity-50"
                    : "bg-[#0A0A1F] text-white hover:bg-black disabled:opacity-50"
                }`}
              >
                {gamingLoadingId === task.id ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-t-2 border-white animate-spin rounded-full"></div>
                    <span>Processing...</span>
                  </div>
                ) : (task.completed && task.id !== "first-game") ||
                  (task.id === "daily-login" && alreadyLoggedToday) ||
                  (task.id === "first-game" && firstGameClaimed) ? (
                  "Completed"
                ) : task.id === "weekly-champion" ? (
                  "View Rank"
                ) : (
                  "Start Task"
                )}
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-center text-gray-400 mt-4">
          Earn more with higher NEAR deposits • Multipliers apply to all SOLV
          rewards
        </p>
      </div>

      <div className="px-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center">
            <span className="text-sm">🔗</span>
          </div>
          <h2 className="text-xl font-bold">Social Media Tasks</h2>
        </div>

        {isLoadingTasks ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-t-4 border-pink-500 animate-spin rounded-full"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks?.map((task: any) => {
              let found = false;
              let onGoing = false;

              userTasks?.forEach((utask: any) => {
                if (task.id == utask.taskId) {
                  if (utask.isCompleted) found = true;
                  onGoing = true;
                }
              });

              if (found || task.points == 0) return null;

              return (
                <div
                  key={task.id}
                  className="bg-gradient-to-br from-blue-600/40 to-blue-800/40 border-2 border-blue-500/30 rounded-2xl p-5"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      {getTaskIcon(task.name)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-base font-bold">{task.name}</h3>
                        <span className="bg-gradient-to-r from-orange-400 to-orange-600 text-white text-xs px-3 py-1 rounded-full font-bold whitespace-nowrap ml-2">
                          +{task.points} SOLV
                        </span>
                      </div>
                      <p className="text-sm text-white/70">
                        {task.name.includes("X")
                          ? "Follow our official Twitter account for updates"
                          : task.name.includes("Telegram")
                          ? "Join our community channel for exclusive content"
                          : "Invite friends and earn rewards for each signup"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setLoading({ id: task.id, status: true });
                      onGoing ? Verify(task) : ProcessLink(task);
                    }}
                    disabled={loading.id == task.id && loading.status}
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                  >
                    {loading.id == task.id && loading.status ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-t-2 border-white animate-spin rounded-full"></div>
                        <span>Loading...</span>
                      </div>
                    ) : (
                      <span>{onGoing ? "Verify" : "Start Task"}</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;
