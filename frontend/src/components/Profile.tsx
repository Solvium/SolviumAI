import { Dispatch, SetStateAction, useEffect, useState } from "react";
import copy from "@/app/assets/userProfile/copy.svg";
import { CopyToClipboard } from "react-copy-to-clipboard";
import WebApp from "@twa-dev/sdk";
import axios from "axios";
import { FaFacebook, FaXTwitter, FaTelegram, FaYoutube } from "react-icons/fa6";
import TimerCountdown from "./Timer";
import { Wallet } from "lucide-react";
// import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "@/app/contexts/AuthContext";
import { useToast } from "@/app/hooks/use-toast";
import DepositMultiplier from "./DepositMultiplier";
// import { useWallet as useSolWallet } from "@solana/wallet-adapter-react";

const UserProfile = ({ tg }: { tg: typeof WebApp | null }) => {
  const { user: userDetails } = useAuth();
  return (
    <div className="min-h-screen w-full bg-[#0B0B14] py-4 px-4 md:py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex justify-end">
          {/* <UnifiedWalletConnector /> */}
          {/* <WalletMultiButton /> */}
        </div>

        {/* Profile Header */}
        <div className="bg-[#151524] rounded-2xl p-6 border border-[#2A2A45] shadow-[0_0_15px_rgba(41,41,69,0.5)]">
          <ProfileHeader userDetails={userDetails} />
        </div>

        {/* Invite Link */}
        <div className="bg-[#151524] rounded-2xl p-6 border border-[#2A2A45] shadow-[0_0_15px_rgba(41,41,69,0.5)]">
          <Link userDetails={userDetails} />
        </div>

        {/* Farming Section */}
        <div className="bg-[#151524] rounded-2xl p-6 border border-[#2A2A45] shadow-[0_0_15px_rgba(41,41,69,0.5)]">
          <Farming />
        </div>

        {/* Tasks Section */}
        <div className="bg-[#151524] rounded-2xl p-6 border border-[#2A2A45] shadow-[0_0_15px_rgba(41,41,69,0.5)]">
          <Tasks tg={tg} />
        </div>
      </div>
    </div>
  );
};

const ProfileHeader = ({ userDetails }: any) => {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="absolute inset-0 bg-[#4C6FFF] rounded-full blur-lg opacity-20"></div>
        <div className="relative bg-gradient-to-b from-[#4C6FFF] to-[#4C6FFF]/50 p-0.5 rounded-full">
          <div className="bg-[#151524] rounded-full w-20 h-20 flex items-center justify-center text-2xl font-bold text-white">
            {userDetails?.username?.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-4">
          {userDetails?.username}
        </h2>
        <div className="flex gap-4">
          <div className="text-center h-full">
            <div className="bg-[#1A1A2F] rounded-lg p-3 border border-[#2A2A45] relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute inset-0 bg-[#4C6FFF] blur-2xl opacity-5"></div>
              <div className="relative">
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xs text-[#8E8EA8]">
                    Points:{" "}
                    <span className="text-[#4C6FFF] font-bold">
                      {userDetails?.totalPoints || 0}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center h-full">
            <div className="bg-[#1A1A2F] rounded-lg p-3 border border-[#2A2A45] relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute inset-0 bg-[#4C6FFF] blur-2xl opacity-5"></div>
              <div className="relative">
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xs text-[#8E8EA8]">
                    Refs:{" "}
                    <span className="text-[#4C6FFF] font-bold">
                      {userDetails?.referralCount || 0}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center h-full">
            <div className="bg-[#1A1A2F] rounded-lg p-3 border border-[#2A2A45] relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute inset-0 bg-[#4C6FFF] blur-2xl opacity-5"></div>
              <div className="relative">
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xs text-[#8E8EA8]">
                    Multiplier:{" "}
                    <span className="text-[#4C6FFF] font-bold">
                      {userDetails?.multiplier || 0}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Link = ({ userDetails }: any) => {
  const [copyState, setCopyState] = useState("Copy");
  const [link, setLink] = useState("");
  useEffect(() => {
    setLink(location.href);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <svg
          className="w-5 h-5 text-[#4C6FFF]"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
        </svg>
        <h2 className="text-lg font-bold text-white">Invite Link</h2>
      </div>
      <div className="bg-[#1A1A2F] rounded-lg p-3 border border-[#2A2A45] relative overflow-hidden">
        <div className="absolute inset-0 bg-[#4C6FFF] blur-2xl opacity-5"></div>
        <div className="relative">
          <p className="text-sm text-[#8E8EA8] break-all text-center md:text-left mb-3">
            {`${link}?ref=${userDetails?.username}`}
          </p>
          <CopyToClipboard
            text={`${link}?ref=${userDetails?.username}`}
            onCopy={() => setCopyState("Copied")}
          >
            <button className="w-full px-4 py-3 bg-[#4C6FFF] hover:bg-[#4C6FFF]/90 text-white rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-medium">
              <span>{copyState}</span>
              <img src={copy.src} alt="copy" className="w-4 h-4 invert" />
            </button>
          </CopyToClipboard>
        </div>
      </div>
    </div>
  );
};

const Farming = () => {
  const { user: userDetails, refreshUser } = useAuth();
  const { toast } = useToast();

  const [loadingFarm, setLoadingFarm] = useState(false);
  const [amount, setAmount] = useState(0);
  const [count, setCount] = useState(0);
  // const address = useTonAddress();

  const hashRate = 0.0035;
  const remainingTime =
    new Date(userDetails?.lastClaim || new Date()).getTime() -
    new Date().getTime();

  // console.log(userDetails);
  // Real claimPoints function that calls the API and refreshes user data
  const claimPoints = async (
    type: string,
    setLoading: (loading: boolean) => void
  ) => {
    setLoading(true);
    try {
      const response = await fetch("/api/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: userDetails?.username,
          type: type,
          userMultipler: userDetails?.multiplier || 1,
          solWallet: userDetails?.wallet || "",
        }),
      });

      const result = await response.json();

      if (response.ok && (result.username || result.success)) {
        // Immediately refresh user data to show updated points and status
        await refreshUser();
        // Show success toast
        toast({
          title: "Claim Successful!",
          description: "Your points have been updated.",
          variant: "default",
        });
      } else {
        console.error("Claim failed:", result.error || result);
        // Show error toast
        const errorMessage =
          result.error || result.message || "Claim failed. Please try again.";
        toast({
          title: "Claim Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error claiming points:", error);
      // Show error toast for network/technical errors
      toast({
        title: "Network Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to connect to server. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setAmount(
      hashRate *
        (userDetails?.multiplier == 0 ? 1 : userDetails?.multiplier || 1) *
        (18000 - count / 1000)
    );
  }, [count, userDetails?.multiplier]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <svg
          className="w-5 h-5 text-[#4C6FFF]"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9 2a1 1 0 000 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
          <path
            fillRule="evenodd"
            d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <h2 className="text-lg font-bold text-white">Farming</h2>
      </div>
      <div className="flex justify-center">
        <button
          disabled={remainingTime > 0 && userDetails?.isMining}
          style={{
            opacity: remainingTime > 0 && userDetails?.isMining ? 0.6 : 1,
          }}
          onClick={async () => {
            setLoadingFarm(true);
            if (userDetails?.isMining) {
              if (remainingTime <= 0)
                claimPoints(
                  "farm claim--" + Math.round(amount),
                  setLoadingFarm
                );
              return;
            }
            claimPoints("start farming", setLoadingFarm);
          }}
          className="px-6 py-3 bg-[#4C6FFF] hover:bg-[#4C6FFF]/90 text-white rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow disabled:opacity-50"
        >
          {loadingFarm ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-t-2 border-white animate-spin rounded-full"></div>
              <span>Processing...</span>
            </div>
          ) : userDetails?.isMining ? (
            <>
              {remainingTime > 0 ? (
                <div className="flex items-center gap-2">
                  <span>{`Mining ${
                    amount > 1 ? amount.toFixed(2) : amount.toFixed(4)
                  } SOLV`}</span>
                  <TimerCountdown
                    setCount={setCount}
                    time={new Date(
                      userDetails?.lastClaim || new Date()
                    ).getTime()}
                  />
                </div>
              ) : (
                <span>Claim {amount.toFixed(2)} SOLV</span>
              )}
            </>
          ) : (
            <span>Start Mining</span>
          )}
        </button>
      </div>
    </div>
  );
};

const Tasks = ({ tg }: { tg: typeof WebApp | null }) => {
  const [loading, setLoading] = useState({ id: "", status: false });
  const [onGoing, setOnGoing] = useState(false);
  const [isOpenSolModal, setIsOpenSolModal] = useState(false);
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  const { user: userDetails, refreshUser } = useAuth();
  const { toast } = useToast();

  // Fetch tasks from database
  const fetchTasks = async () => {
    try {
      setIsLoadingTasks(true);
      const response = await fetch("/api/tasks");
      const data = await response.json();

      if (response.ok) {
        setTasks(data.tasks || []);
        setUserTasks(data.userTasks || []);
      } else {
        console.error("Failed to fetch tasks:", data.error);
        toast({
          title: "Error",
          description: "Failed to load tasks. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Network Error",
        description:
          "Failed to connect to server. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Fetch tasks on component mount
  useEffect(() => {
    fetchTasks();
  }, []);

  // Refresh tasks after completing a task
  const refreshTasks = async () => {
    await fetchTasks();
  };

  // Real engageTasks function that calls the API and refreshes user data
  const engageTasks = async (
    type: string,
    data: any,
    func: (param: boolean) => void
  ) => {
    func(true);
    try {
      const response = await fetch("/api/allroute", {
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
        // Immediately refresh user data to show updated points and status
        await refreshUser();
        // Refresh tasks to show updated completion status
        await refreshTasks();
        // Show success toast
        toast({
          title: "Task Completed!",
          description: "Your points have been updated.",
          variant: "default",
        });
      } else {
        console.error("Task engagement failed:", result.error || result);
        // Show error toast
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
      // Show error toast for network/technical errors
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

  // const getDeposits = (): number => {
  //   let total = 0;
  //   if (!nearDeposits?.deposits) return total;

  //   const ONE_WEEK_IN_SECONDS = 604800;

  //   const isDepositActive = (startTimeInMs: number) => {
  //     const startTimeInSeconds = startTimeInMs / 1000; // Convert ms to seconds
  //     const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  //     const endTimeInSeconds = startTimeInSeconds + ONE_WEEK_IN_SECONDS;

  //     // Return true only if current time is less than end time
  //     return currentTimeInSeconds <= endTimeInSeconds;
  //   };

  //   Object.values(nearDeposits.deposits).map((deposit) => {
  //     const startTimeInMs = Number(deposit.startTime) / 1000000; // Convert to milliseconds

  //     if (isDepositActive(startTimeInMs))
  //       total += Number(deposit.multiplier) / 1e16;
  //   });
  //   return total;
  // };

  const sendComplete = async (data: any) => {
    const taskData = {
      task: data,
      userId: userDetails?.id,
    };
    const res = await engageTasks("completetasks", taskData, () =>
      setLoading({ id: data.id, status: false })
    );
  };

  const ProcessLink = async (data: any) => {
    setLoading({ id: data.id, status: true });

    const res = await engageTasks("reg4tasks", data, () =>
      setLoading({ id: data.id, status: false })
    );

    if (!data?.link) return;
    data.link && window?.open(data.link);
  };

  const Verify = async (data: any, type = "") => {
    setLoading({ id: data.id, status: true });
    setError("");

    if (data.name.includes("Join Solvium Telegram Group")) {
      try {
        const response = await axios.get(
          `https://api.telegram.org/bot7858122446:AAEwouIyKmFuF5vnxpY4FUNY6r4VIEMtWH0/getChatMember?chat_id=-1002478373737&user_id=${userDetails?.chatId}`
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

    if (data.name.includes("Join Solvium Chat")) {
      try {
        const response = await axios.get(
          `https://api.telegram.org/bot7858122446:AAEwouIyKmFuF5vnxpY4FUNY6r4VIEMtWH0/getChatMember?chat_id=-1002376352525&user_id=${userDetails?.chatId}`
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
                "You have not joined the Telegram chat yet! Please join the chat first.",
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

    // if (data.name.includes("Connect Wallet")) {
    //   if (publicKey) sendComplete(data);
    //   else {
    //     setError("Kindly Connect Your Wallet");
    //     setLoading({ id: data.id, status: false });
    //     return;
    //   }
    // }

    sendComplete(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <svg
          className="w-5 h-5 text-[#4C6FFF]"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9 2a1 1 0 000 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
        </svg>
        <h2 className="text-lg font-bold text-white">Tasks</h2>
      </div>

      <div className="space-y-3">
        <div className="bg-[#1A1A2F] rounded-lg p-3 border border-[#2A2A45] relative overflow-hidden">
          <div className="absolute inset-0 bg-[#4C6FFF] blur-2xl opacity-5"></div>
          <div className="relative">
            <p className="text-sm font-medium text-white">
              Purchase Multiplier
            </p>
            {/* <button
              onClick={() => setIsOpenSolModal(true)}
              className="mt-3 text-[13px] border-blue-80 border-[2px] text-white h-8 flex items-center justify-center rounded-lg px-3"
            >
              Start
            </button> */}
            <DepositMultiplier user={userDetails} />
          </div>
        </div>
        {/* series embrace artefact myth miracle okay farm pony spoil sell coconut
        chair */}
        {isLoadingTasks ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-t-2 border-white animate-spin rounded-full"></div>
            <span className="ml-2 text-white">Loading tasks...</span>
          </div>
        ) : tasks?.length === 0 ? (
          <div className="text-center text-white">No tasks available.</div>
        ) : (
          <div className="space-y-3">
            {tasks?.map((task: any, i: number) => {
              let curCat = "Tg";
              let icon = <FaTelegram className="text-[#4C6FFF] text-xl" />;

              switch (task.name.toLowerCase()) {
                case "follow x".toLowerCase():
                  icon = <FaXTwitter className="text-[#4C6FFF] text-xl" />;
                  curCat = "x";
                  break;
                case "Follow Facebook".toLowerCase():
                case "Join Facebook Group".toLowerCase():
                  curCat = "fb";
                  icon = <FaFacebook className="text-[#4C6FFF] text-xl" />;
                  break;
                case "Subscribe to Youtube".toLowerCase():
                  curCat = "yt";
                  icon = <FaYoutube className="text-[#4C6FFF] text-xl" />;
                  break;
                case "connect wallet".toLowerCase():
                  curCat = "wallet";
                  icon = <Wallet className="text-[#4C6FFF] text-xl" />;
                  break;
                default:
                  break;
              }

              let found = false;
              let onGoing = false;

              userTasks?.length > 0 &&
                userTasks?.map((utask: any) => {
                  if (task.id == utask.taskId) {
                    if (utask.isCompleted) found = true;
                    onGoing = true;
                  }
                });

              if (found) return <div key={i + task.name + "task" + i}> </div>;
              if (task.points == 0)
                return <div key={task.name + task.id + "task" + i}> </div>;

              // const found = userDetails?.completedTasks?.find(
              //   (completedTask: any) =>
              //     completedTask.name === task.name &&
              //     completedTask.category === curCat
              // );

              // if (found) return null;

              return (
                <div
                  key={"bbb" + task.name + "task" + i}
                  className="bg-[#1A1A2F] rounded-lg p-3 border border-[#2A2A45] relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-[#4C6FFF] blur-2xl opacity-5"></div>
                  <div className="relative flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#4C6FFF]/10 flex items-center justify-center">
                      {icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">
                        {task.name}
                      </p>
                      <div className="flex items-center gap-1">
                        <svg
                          className="w-3 h-3 text-[#4C6FFF]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <p className="text-xs text-[#4C6FFF]">
                          {task.points} SOLV
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setLoading({ id: task.id, status: true });
                        onGoing ? Verify(task) : ProcessLink(task);
                      }}
                      className="px-4 py-2 bg-[#4C6FFF] hover:bg-[#4C6FFF]/90 text-white rounded-lg transition-all text-sm font-medium disabled:opacity-50"
                      disabled={loading.id == task.id && loading.status}
                    >
                      {loading.id == task.id && loading.status ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-t-2 border-white animate-spin rounded-full"></div>
                          <span>Processing...</span>
                        </div>
                      ) : (
                        <span>{onGoing ? "Verify" : "Start"}</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* <SolDepositModal
        isOpen={isOpenSolModal}
        onClose={() => setIsOpenSolModal(false)}
      /> */}
    </div>
  );
};

const Modal = () => {
  return (
    <div>
      <dialog id="my_modal_3" className="modal">
        <div className="modal-box ">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
              ✕
            </button>
          </form>
          <div className="p-5">
            <p>Support the project and double your points over the next week</p>

            <div>
              <p>Amount</p>
              <input type="text" />
            </div>
            <div>
              <button>Support</button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default UserProfile;
