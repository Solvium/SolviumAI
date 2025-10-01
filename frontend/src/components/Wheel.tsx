"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { CONTRACTID, MEME_TOKEN_ADDRESS } from "./constants/contractId";
import { Bounce, toast, ToastContainer } from "react-toastify";
import BuySpin from "./BuySpin";
import { useMultiLoginContext } from "@/app/contexts/MultiLoginContext";
import { usePrivateKeyWallet } from "@/app/contexts/PrivateKeyWalletContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { ACTIVITY_POINTS } from "@/lib/services/pointsService";
import Image from "next/image";
import { Montserrat } from "next/font/google";
import { Pixelify_Sans } from "next/font/google";

const pixelify = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["400", "700"], // pick weights you need
  display: "swap", // prevents layout shift
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const Wheel = dynamic(
  () => import("react-custom-roulette").then((mod) => mod.Wheel),
  { ssr: false }
);

interface ClaimProps {
  rewardAmount: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

const WinPopup = ({
  isVisible,
  prize,
  onClaim,
  isClaimLoading,
}: {
  isVisible: boolean;
  prize: string;
  onClaim: () => void;
  isClaimLoading: boolean;
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-3xl p-8 mx-4 max-w-sm w-full shadow-2xl animate-bounce">
        <div className="absolute -top-4 -left-4 w-8 h-8 bg-yellow-400 rounded-full animate-ping"></div>
        <div className="absolute -top-2 -right-6 w-6 h-6 bg-orange-400 rounded-full animate-ping delay-300"></div>
        <div className="absolute -bottom-3 -left-2 w-5 h-5 bg-green-400 rounded-full animate-ping delay-500"></div>
        <div className="absolute -bottom-4 -right-4 w-7 h-7 bg-purple-400 rounded-full animate-ping delay-700"></div>

        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🎉</div>
          <h2 className="text-3xl font-black text-white mb-2 drop-shadow-lg">
            WINNER!
          </h2>
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-transparent bg-clip-text text-4xl font-black mb-6 drop-shadow-lg">
            {prize} TOKENS
          </div>
          <button
            onClick={onClaim}
            disabled={isClaimLoading}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xl font-black rounded-2xl
                     hover:from-orange-600 hover:to-red-600 transition-all duration-300 transform hover:scale-105
                     disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isClaimLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-t-2 border-white animate-spin rounded-full"></div>
                <span>CLAIMING...</span>
              </div>
            ) : (
              "CLAIM REWARD!"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const CountdownTimer = ({ targetTime }: { targetTime: Date }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date(Date.now());
      const remaining = targetTime.getTime() - now.getTime();
      setTimeLeft(Math.max(0, remaining));
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime]);

  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return (
    <div className="text-white text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-4">
      <div className="text-sm mb-1 font-semibold">Next spin available in</div>
      <div className="font-black text-xl text-yellow-400">
        {hours}h {minutes}m {seconds}s
      </div>
    </div>
  );
};

export const WheelOfFortune = () => {
  const { userData: user, claimPoints } = useMultiLoginContext();
  const { logActivity } = useAuth();
  const {
    isConnected: nearConnected,
    accountId: nearAddress,
    signAndSendTransaction,
    checkTokenRegistration,
    registerToken,
  } = usePrivateKeyWallet();

  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [winner, setWinner] = useState("");
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<string | null>(null);
  const [unclaimed, setUnclaimed] = useState<{
    winner: string;
    prizeNumber: number;
  } | null>(null);

  const [spinningSound, setSpinningSound] = useState(new Audio());
  const [isClaimLoading, setIsClaimLoading] = useState(false);
  const [canClaim, setCanClaim] = useState(false);
  const [buySpins, setBuySpins] = useState(false);

  const [lastPlayed, setLastPlayed] = useState<number | null>(null);
  const [cooldownTime, setCooldownTime] = useState<Date>(new Date());

  const data = [
    {
      option: "1",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
    {
      option: "25",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
    {
      option: "50",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
    {
      option: "100",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
    {
      option: "250",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
    {
      option: "500",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
    {
      option: "1000",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
    {
      option: "2000",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
    {
      option: "5000",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
  ];

  const checkTokenRegistrationCallback = useCallback(async () => {
    if (!nearAddress) return null;

    try {
      const result = await checkTokenRegistration(MEME_TOKEN_ADDRESS);
      return result;
    } catch (error) {
      console.error("Token registration check failed:", error);
      return null;
    }
  }, [nearAddress, checkTokenRegistration]);

  const registerTokenCallback = async (tokenId: string) => {
    if (!nearAddress) return;

    try {
      return await registerToken(tokenId);
    } catch (error) {
      console.error("Token registration failed:", error);
      throw error;
    }
  };

  useEffect(() => {
    setSpinningSound(new Audio(location.origin + "/spin.mp3"));
    setLastPlayed(Number(user?.lastSpinClaim));
    const now = new Date(Date.now());
    const cooldownEnd = new Date(
      new Date(user?.lastSpinClaim ?? 0).getTime() + 24 * 60 * 60 * 1000
    );
    if (now < cooldownEnd) {
      setCooldownTime(cooldownEnd);
    }
    if ((user?.dailySpinCount ?? 0) <= 0) setHasPlayed(true);
    else setHasPlayed(false);

    const unclaimedPrize = localStorage.getItem("unclaimedPrize");
    const lastClaimedTime = localStorage.getItem("lastClaimed");
    if (unclaimedPrize && !lastClaimedTime) {
      const prize = JSON.parse(unclaimedPrize);
      setWinner(prize.winner);
      setPrizeNumber(prize.prizeNumber);
      setUnclaimed(prize);
      setIsClaimed(false);
    }
  }, [user]);

  const handleClaimRewardImproved = async ({
    rewardAmount,
    onSuccess,
    onError,
  }: ClaimProps) => {
    if (!nearAddress || !nearConnected) {
      const error = new Error("Wallet not connected");
      onError?.(error);
      return;
    }

    try {
      const isRegistered = await checkTokenRegistrationCallback();
      if (!isRegistered) {
        await registerTokenCallback(MEME_TOKEN_ADDRESS);
      }

      const claimTransaction = await signAndSendTransaction(CONTRACTID!, [
        {
          type: "FunctionCall",
          params: {
            methodName: "claimWheel",
            args: {
              rewardAmount: rewardAmount,
              tokenAddress: MEME_TOKEN_ADDRESS!,
            },
            gas: "300000000000000",
            deposit: "0",
          },
        },
      ]);

      await claimTransaction;

      const executeTransferTx = await signAndSendTransaction(CONTRACTID!, [
        {
          type: "FunctionCall",
          params: {
            methodName: "execute_transfer",
            args: {},
            gas: "300000000000000",
            deposit: "0",
          },
        },
      ]);

      await executeTransferTx;

      localStorage.setItem("lastClaimed", Date.now().toString());
      localStorage.setItem(
        "transaction",
        JSON.stringify({ claimTransaction, executeTransferTx })
      );
      onSuccess?.();
      return { claimTransaction, executeTransferTx };
    } catch (error: any) {
      console.error("Failed to claim reward:", error.message);
      onError?.(error as Error);
      throw error;
    }
  };

  const handleSpinClick = async () => {
    const now = Date.now();

    if (!nearConnected) {
      toast.error("Please connect your NEAR wallet to continue!");
      return;
    }

    if (isSpinning) return; // Prevent multiple spins

    // Log wheel spin activity
    try {
      await logActivity({
        activity_type: "SPIN_WHEEL",
        points_earned: ACTIVITY_POINTS.SPIN_WHEEL,
        metadata: {
          game_type: "wheel_spin",
          timestamp: now,
          wallet_connected: nearConnected,
        },
      });
    } catch (error) {
      console.error("Failed to log wheel spin activity:", error);
    }

    claimPoints("spin claim", setCanClaim);

    // Generate random prize
    const newPrizeNumber = Math.floor(Math.random() * data.length);
    const selectedPrize = data[newPrizeNumber].option;

    setPrizeNumber(newPrizeNumber);
    setWonPrize(selectedPrize);
    setIsSpinning(true);
    setMustSpin(true);
    spinningSound.play();
    setLastPlayed(now);
    setCooldownTime(new Date(now + 24 * 60 * 60 * 1000));
    localStorage.setItem("lastPlayedTime", now.toString());

    // Stop spinning after animation completes
    setTimeout(() => {
      setIsSpinning(false);
      setMustSpin(false);

      // Show prize notification
      toast.success(`🎉 You won ${selectedPrize} tokens!`, {
        position: "top-center",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }, 4000); // Match the CSS animation duration
  };

  const parseErrorMessage = (error: any): string => {
    try {
      if (typeof error === "string") {
        return error;
      }

      if (error.message) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.kind?.kind?.FunctionCallError?.ExecutionError) {
            const fullError = parsed.kind.kind.FunctionCallError.ExecutionError;
            const match = fullError.match(
              /Smart contract panicked: (.*?)(?:\n|$)/
            );
            return match ? match[1] : fullError;
          }
        } catch {
          return error.message;
        }
      }

      return "Unknown error occurred";
    } catch {
      return "Failed to parse error message";
    }
  };

  const handleClaim = async () => {
    if (!winner) return;
    setIsClaimLoading(true);
    try {
      await handleClaimRewardImproved({
        rewardAmount: data[prizeNumber].option,
        onSuccess: () => {
          setIsClaimed(true);
          localStorage.setItem("lastClaimed", Date.now().toString());
          localStorage.removeItem("unclaimedPrize");
          setIsClaimLoading(false);
          setUnclaimed(null);
        },
        onError: (error) => {
          console.error("Claim failed:", error);
          setIsClaimLoading(false);
          toast.error(`Failed to claim: ${parseErrorMessage(error)}`);
          alert(`Failed to claim:${parseErrorMessage(error)} `);
        },
      });
    } catch (error) {
      setIsClaimLoading(false);
      console.error("Claim failed:", error);
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] w-full relative overflow-hidden">
      {/* Background with floating dots */}
      <div className="absolute inset-0">
        <Image
          src="/assets/wheel/background-dots.svg"
          alt="Background dots"
          fill
          className="object-cover"
          priority
        />
      </div>

      <div className="relative z-10 max-w-[630px] mx-auto h-full flex flex-col px-4 py-2">
        {/* Header */}
        <div className="flex items-center justify-center mb-0 mt-[1%]">
          {/* Back button */}
          {/* <Image
            src="/assets/wheel/back-button.svg"
            alt="Back"
            width={40}
            height={28}
          /> */}

          {/* Title */}
          <h1
            className={`${pixelify.className} text-4xl text-center font-black text-[#BDECFB] tracking-wider mb-0 mt-2`}
          >
            LUCKY SPIN
          </h1>

          {/* Dots menu */}
          {/* <Image
            src="/assets/wheel/dots-circle.svg"
            alt="Menu"
            width={24}
            height={24}
          /> */}
        </div>

        {/* Title */}

        <div className="text-center ">
          <p
            className={`${montserrat.className} text-white text-[14.48px] font-normal`}
          >
            Spin To Win Coins, Prizes And Boost
          </p>
        </div>
        <div className="flex-1">
          <div className="flex relative flex-row justify-center">
            <div className="-bottom-10 -left-10 absolute z-30">
              <Image
                src="/assets/wheel/mascot-hello.svg"
                alt="Mascot"
                width={165}
                height={193}
                className="object-contain w-[165px] h-[193px]"
              />
            </div>

            {/* Spinning Wheel */}
            <div className="relative flex flex-col items-center justify-center">
              <div className="relative z-20">
                <Image
                  src="/assets/wheel/spin-wheel-new.svg"
                  alt="Spin Wheel"
                  width={383}
                  height={377}
                  className={`transition-transform duration-[4s] ease-out ${
                    isSpinning ? "animate-wheel-spin" : ""
                  }`}
                  style={{
                    transform: mustSpin
                      ? `rotate(${prizeNumber * 40 + 1800}deg)`
                      : "rotate(0deg)",
                  }}
                  priority
                />
              </div>

              {/* Prize Indicator Arrow */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2 z-30">
                <div className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-red-500"></div>
              </div>

              <div className="  z-30 items-center">
                <div className="text-center space-y-2">
                  {/* Progress bar */}
                  <div className="h-2 sm:h-3  bg-[#B2D9FF] border border-[#FF309B] rounded-full flex items-center">
                    <div
                      className="h-[70%] sm:h-[80%] ml-[2px] bg-[#FF309B] rounded-full shadow-lg"
                      style={{
                        width: "34%",
                        boxShadow: "0 0 15px rgba(34, 211, 238, 0.6)",
                      }}
                    />
                  </div>

                  {/* Spins left text */}
                  <p
                    className={`${montserrat.className} text-white text-xs sm:text-[10px] font-normal leading-relaxed`}
                  >
                    <span className="font-bold">
                      {new Date(cooldownTime) > new Date(Date.now())
                        ? user?.dailySpinCount || 0
                        : 1}
                      /3
                    </span>
                    <span className="font-normal text-white/70">
                      {" "}
                      Spins Left For Today
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mascot and Spins Left */}

        {/* Spin Button */}
        <div className="mb-6 flex justify-center">
          {hasPlayed && new Date(cooldownTime) > new Date(Date.now()) ? (
            <CountdownTimer targetTime={cooldownTime} />
          ) : (
            <button
              onClick={handleSpinClick}
              disabled={
                (hasPlayed && new Date(cooldownTime) > new Date(Date.now())) ||
                isSpinning
              }
              className={`w-[287px] h-20 flex items-center justify-center text-white font-bold transition-all duration-300 ${
                isSpinning ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
              }`}
              style={{
                backgroundImage: "url('/assets/wheel/spin-wheel.svg')",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
              }}
            >
              {isSpinning && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Spinning...</span>
                </div>
              )}
            </button>
          )}
        </div>

        {/* Prize Display */}
        {wonPrize && !isSpinning && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-4 text-center mb-4 animate-pulse">
            <div className="text-2xl font-black text-yellow-900 mb-2">
              🎉 CONGRATULATIONS! 🎉
            </div>
            <div className="text-xl font-bold text-yellow-900">
              You won {wonPrize} tokens!
            </div>
          </div>
        )}

        {/* Additional UI elements */}
        {isClaimed && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 text-center mb-4">
            <div className="text-lg text-white font-black">
              🎉 REWARD CLAIMED! 🎉
            </div>
          </div>
        )}

        {(user?.dailySpinCount ?? 0) <= 0 &&
          new Date(cooldownTime) > new Date(Date.now()) && (
            <button
              onClick={() => setBuySpins(true)}
              className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-lg font-black rounded-2xl
                     hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105
                     shadow-xl mb-4"
            >
              💎 BUY SPIN 💎
            </button>
          )}

        {buySpins && <BuySpin setBuySpins={setBuySpins} />}
      </div>

      <WinPopup
        isVisible={Boolean((winner || unclaimed) && !isClaimed)}
        prize={winner}
        onClaim={handleClaim}
        isClaimLoading={isClaimLoading}
      />

      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        transition={Bounce}
      />
    </div>
  );
};
