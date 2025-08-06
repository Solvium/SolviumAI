import { Dispatch, SetStateAction, useEffect, useState } from "react";
import copy from "@/app/assets/userProfile/copy.svg";
import { CopyToClipboard } from "react-copy-to-clipboard";
import WebApp from "@twa-dev/sdk";
import axios from "axios";
import { FaFacebook, FaXTwitter, FaTelegram, FaYoutube } from "react-icons/fa6";
import { useAuth } from "@/app/contexts/AuthContext";
import { useMultiLoginContext } from "@/app/contexts/MultiLoginContext";

const UserProfile = ({ tg }: { tg: typeof WebApp | null }) => {
  const { user: userDetails, refreshUser } = useAuth();
  return (
    <div className="min-h-screen w-full bg-[#0B0B14] py-4 px-4 md:py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Profile Header */}
        <div className="bg-[#151524] rounded-2xl p-6 border border-[#2A2A45] shadow-[0_0_15px_rgba(41,41,69,0.5)]">
          <ProfileHeader
            userDetails={userDetails}
            multiplier={userDetails?.multiplier || 0}
          />
        </div>

        {/* Invite Link */}
        <div className="bg-[#151524] rounded-2xl p-6 border border-[#2A2A45] shadow-[0_0_15px_rgba(41,41,69,0.5)]">
          <Link userDetails={userDetails} />
        </div>

        {/* Farming Section */}
        <div className="bg-[#151524] rounded-2xl p-6 border border-[#2A2A45] shadow-[0_0_15px_rgba(41,41,69,0.5)]">
          <Farming userDetails={userDetails} />
        </div>

        {/* Tasks Section */}
        <div className="bg-[#151524] rounded-2xl p-6 border border-[#2A2A45] shadow-[0_0_15px_rgba(41,41,69,0.5)]">
          <Tasks tg={tg} userDetails={userDetails} />
        </div>
      </div>
    </div>
  );
};

const ProfileHeader = ({ userDetails, multiplier }: any) => {
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
                      {multiplier || 0}
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
  const [copied, setCopied] = useState(false);
  const inviteLink = `https://t.me/SolviumBot?start=${
    userDetails?.id || "user"
  }`;

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <svg
          className="w-5 h-5 text-[#4C6FFF]"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
        </svg>
        <h2 className="text-lg font-bold text-white">Invite Link</h2>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={inviteLink}
          readOnly
          className="flex-1 bg-[#1A1A2F] border border-[#2A2A45] rounded-lg px-3 py-2 text-white text-sm"
        />
        <CopyToClipboard text={inviteLink} onCopy={handleCopy}>
          <button className="px-4 py-2 bg-[#4C6FFF] hover:bg-[#4C6FFF]/90 text-white rounded-lg transition-all">
            {copied ? (
              <img src={copy} alt="copy" className="w-4 h-4" />
            ) : (
              "Copy"
            )}
          </button>
        </CopyToClipboard>
      </div>
    </div>
  );
};

const Farming = ({ userDetails }: { userDetails: any }) => {
  const [loadingFarm, setLoadingFarm] = useState(false);
  const [amount, setAmount] = useState(0);
  const [count, setCount] = useState(0);

  const hashRate = 0.0035;
  const remainingTime =
    new Date(userDetails?.lastClaim ?? 0).getTime() - new Date().getTime();

  useEffect(() => {
    setAmount(
      hashRate *
        (userDetails?.multiplier == 0 ? 1 : userDetails?.multiplier) *
        (18000 - count / 1000)
    );
  }, [count, userDetails?.multiplier]);

  const handleFarming = async () => {
    setLoadingFarm(true);
    // TODO: Implement farming logic with new auth system
    setTimeout(() => {
      setLoadingFarm(false);
    }, 2000);
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
          onClick={handleFarming}
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
                  }/s`}</span>
                  <span>Time remaining...</span>
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

const Tasks = ({
  tg,
  userDetails,
}: {
  tg: typeof WebApp | null;
  userDetails: any;
}) => {
  const [loading, setLoading] = useState({ id: "", status: false });
  const [error, setError] = useState("");

  // Mock tasks data - in real implementation, this would come from the backend
  const tasks = [
    {
      id: "1",
      name: "Join Solvium Telegram Group",
      description: "Join our official Telegram group",
      points: 50,
      completed: false,
      link: "https://t.me/SolviumGroup",
    },
    {
      id: "2",
      name: "Follow on Twitter",
      description: "Follow our official Twitter account",
      points: 30,
      completed: false,
      link: "https://twitter.com/Solvium",
    },
  ];

  const sendComplete = async (data: any) => {
    setLoading({ id: data.id, status: true });
    // TODO: Implement task completion with new auth system
    setTimeout(() => {
      setLoading({ id: data.id, status: false });
    }, 2000);
  };

  const ProcessLink = async (data: any) => {
    console.log(data);
    setLoading({ id: data.id, status: true });

    // TODO: Implement task processing with new auth system
    setTimeout(() => {
      setLoading({ id: data.id, status: false });
    }, 2000);

    if (!data?.link) return;
    data.link && window?.open(data.link);
  };

  const Verify = async (data: any, type = "") => {
    setLoading({ id: data.id, status: true });
    setError("");

    if (data.name.includes("Join Solvium Telegram Group")) {
      try {
        const response = await axios.get(
          `https://api.telegram.org/bot7858122446:AAEwouIyKmFuF5vnxpY4FUNY6r4VIEMtWH0/getChatMember?chat_id=-1002478373737&user_id=${userDetails?.telegramId}`
        );

        console.log(response);
        if (response.data.result.user.username == userDetails?.username) {
          if (response.data.result.status == "member") {
            sendComplete(data);
            return;
          } else {
            setError("You have not Joined Group yet!");
            setLoading({ id: data.id, status: false });
            setTimeout(() => {
              data.link && tg?.openLink(data.link);
            }, 2000);
            return;
          }
        } else {
          setError("An error occurred, Please try again!");
          setLoading({ id: data.id, status: false });
          return;
        }
      } catch (error) {
        setError("An error occurred, Please try again!");
        setLoading({ id: data.id, status: false });
        return;
      }
    }

    if (data.name.includes("Join Solvium Chat")) {
      try {
        const response = await axios.get(
          `https://api.telegram.org/bot7858122446:AAEwouIyKmFuF5vnxpY4FUNY6r4VIEMtWH0/getChatMember?chat_id=-1002376352525&user_id=${userDetails?.telegramId}`
        );

        console.log(response);
        if (response.data.result.user.username == userDetails?.username) {
          if (response.data.result.status == "member") {
            sendComplete(data);
            return;
          } else {
            setError("You have not Joined Chat yet!");
            setLoading({ id: data.id, status: false });
            setTimeout(() => {
              data.link && tg?.openLink(data.link);
            }, 2000);
            return;
          }
        } else {
          setError("An error occurred, Please try again!");
          setLoading({ id: data.id, status: false });
          return;
        }
      } catch (error) {
        setError("An error occurred, Please try again!");
        setLoading({ id: data.id, status: false });
        return;
      }
    }

    // For other tasks, just process the link
    ProcessLink(data);
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
          <path
            fillRule="evenodd"
            d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <h2 className="text-lg font-bold text-white">Tasks</h2>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="bg-[#1A1A2F] rounded-lg p-4 border border-[#2A2A45]"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-white font-medium">{task.name}</h3>
                <p className="text-[#8E8EA8] text-sm">{task.description}</p>
              </div>
              <span className="text-[#4C6FFF] font-bold">
                {task.points} pts
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => Verify(task)}
                disabled={loading.id === task.id && loading.status}
                className="flex-1 px-4 py-2 bg-[#4C6FFF] hover:bg-[#4C6FFF]/90 text-white rounded-lg transition-all text-sm disabled:opacity-50"
              >
                {loading.id === task.id && loading.status ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-t-2 border-white animate-spin rounded-full"></div>
                    <span>Verifying...</span>
                  </div>
                ) : task.completed ? (
                  "Completed"
                ) : (
                  "Verify"
                )}
              </button>

              {task.link && (
                <button
                  onClick={() => window.open(task.link)}
                  className="px-4 py-2 bg-[#2A2A45] hover:bg-[#2A2A45]/90 text-white rounded-lg transition-all text-sm"
                >
                  Visit
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserProfile;
