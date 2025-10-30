"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { CONTRACTID, MEME_TOKEN_ADDRESS } from "@/lib/constants/contractId";
import { Bounce, toast, ToastContainer } from "react-toastify";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { useSolviumContract } from "@/hooks/useSolviumContract";
import { useAuth } from "@/contexts/AuthContext";
import { ACTIVITY_POINTS } from "@/lib/services/pointsService";
import { checkTokenRegistration } from "@/lib/nearWallet";
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
  onClose,
}: {
  isVisible: boolean;
  prize: string;
  onClaim: () => void;
  isClaimLoading: boolean;
  onClose?: () => void;
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-3xl p-8 mx-4 max-w-sm w-full shadow-2xl ">
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center"
        >
          ✕
        </button>
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
  const { user, logActivity, claimPoints } = useAuth();
  const {
    isConnected: nearConnected,
    accountId: nearAddress,
    account: nearAccount,
    signAndSendTransaction,
    checkTokenRegistration: checkTokenRegistrationCallback,
    registerToken: registerTokenCallback,
  } = usePrivateKeyWallet();
  const { getAllUserDeposits } = useSolviumContract();

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
  // Remove modal flow for buying spins; use inline buttons instead

  const [lastPlayed, setLastPlayed] = useState<number | null>(null);
  const [cooldownTime, setCooldownTime] = useState<Date>(new Date());

  // Control showing the reward modal (allow closing)
  const [showWin, setShowWin] = useState(true);

  const data = [
    {
      option: "30",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
    {
      option: "70",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
    {
      option: "100",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
    {
      option: "200",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
    {
      option: "300",
      style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
    },
    {
      option: "400",
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
  ];

  // Weighted probabilities for 9 slices (higher prizes are rarer)
  const prizeWeights = [24, 20, 18, 14, 9, 6, 4, 3, 2]; // corresponds to data indices

  const pickWeightedIndex = (weights: number[]) => {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
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
      setShowWin(true);
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
      // Check if token is registered
      const isRegistered = await checkTokenRegistrationCallback(
        MEME_TOKEN_ADDRESS
      );
      if (!isRegistered) {
        console.log("Token not registered, registering...");
        await registerTokenCallback(MEME_TOKEN_ADDRESS);
      }

      // Check if user has storage deposit for the contract
      console.log("Checking storage deposit...");
      if (!nearAccount) {
        throw new Error("NEAR account not available");
      }
      const storageBalance = await checkTokenRegistration(
        nearAccount,
        MEME_TOKEN_ADDRESS,
        nearAddress
      );

      if (!storageBalance || storageBalance.total === "0") {
        console.log("No storage deposit found, making storage deposit...");
        toast.info("Making storage deposit for token contract...", {
          autoClose: 2000,
        });

        // Make a small storage deposit (0.00125 NEAR)
        const storageDepositTx = await signAndSendTransaction(
          MEME_TOKEN_ADDRESS,
          [
            {
              type: "FunctionCall",
              params: {
                methodName: "storage_deposit",
                args: {
                  account_id: nearAddress,
                  registration_only: true,
                },
                gas: "300000000000000",
                deposit: "1250000000000000000000", // 0.00125 NEAR
              },
            },
          ]
        );

        await storageDepositTx;
        console.log("Storage deposit completed");
        toast.success("Storage deposit completed!", { autoClose: 2000 });
      } else {
        console.log("Storage deposit found:", storageBalance);
      }

      // Check if user has deposits in the main contract
      console.log("Checking deposits in main contract...");
      if (!nearAccount) {
        throw new Error("NEAR account not available");
      }

      let hasDeposits = false;
      try {
        const depositsResult = await nearAccount.viewFunction({
          contractId: CONTRACTID!,
          methodName: "getUserDepositSummary",
          args: { accountId: nearAddress },
        });
        console.log("Deposits result:", depositsResult);
        hasDeposits =
          Array.isArray(depositsResult) && depositsResult.length > 0;
        console.log("Deposits found:", depositsResult);
      } catch (error) {
        console.log("Error checking deposits, trying alternative method...");
        try {
          const depositsResult = await nearAccount.viewFunction({
            contractId: CONTRACTID!,
            methodName: "getUserDepositSummary",
            args: { account_id: nearAddress },
          });
          hasDeposits =
            Array.isArray(depositsResult) && depositsResult.length > 0;
          console.log("Deposits found (alternative):", depositsResult);
        } catch (altError) {
          console.log("No deposits found, will make a small deposit");
          hasDeposits = false;
        }
      }

      if (!hasDeposits) {
        console.log(
          "No deposits found in main contract, making small deposit..."
        );
        toast.info("Making small deposit to enable claiming...", {
          autoClose: 2000,
        });

        // Make a small deposit to the main contract (0.01 NEAR)
        const depositTx = await signAndSendTransaction(CONTRACTID!, [
          {
            type: "FunctionCall",
            params: {
              methodName: "depositToGame",
              args: {},
              gas: "300000000000000",
              deposit: "300000000000000000000000", // 0.01 NEAR
            },
          },
        ]);

        await depositTx;
        console.log("Main contract deposit completed");
        toast.success("Deposit completed! You can now claim rewards.", {
          autoClose: 3000,
        });
      } else {
        console.log("Deposits found in main contract");
      }

      console.log("Proceeding with claim after all deposits...");

      // Use the correct claim method name
      console.log("Trying claim method: claim_wheel");
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

      // Try execute transfer method
      console.log("Trying execute method: execute_transfer");
      // const executeTransferTx = await signAndSendTransaction(CONTRACTID!, [
      //   {
      //     type: "FunctionCall",
      //     params: {
      //       methodName: "execute_transfer",
      //       args: {},
      //       gas: "300000000000000",
      //       deposit: "0",
      //     },
      //   },
      // ]);

      // await executeTransferTx;

      localStorage.setItem("lastClaimed", Date.now().toString());
      localStorage.setItem("transaction", JSON.stringify({ claimTransaction }));
      onSuccess?.();
      return { claimTransaction };
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

    // Require user to have at least one deposit in the game (not storage deposit)
    try {
      let hasDeposits = false;
      if (nearAddress) {
        try {
          const res = (await getAllUserDeposits(nearAddress)) as unknown;
          const list = res as any[];
          if (Array.isArray(list) && list.length > 0) hasDeposits = true;
        } catch {}
        if (!hasDeposits && nearAccount) {
          try {
            const alt = await nearAccount.viewFunction({
              contractId: CONTRACTID!,
              methodName: "getAllUserDeposits",
              args: { accountId: nearAddress },
            });
            if (Array.isArray(alt) && alt.length > 0) hasDeposits = true;
          } catch {}
        }
      }

      if (!hasDeposits) {
        toast.info("No game deposit found. Please deposit to play the wheel.");
        return;
      }
    } catch {
      toast.error("Unable to verify game deposit. Please try again later.");
      return;
    }

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

    claimPoints("spin claim", () => setCanClaim(false));

    // Generate weighted random prize (higher prizes are rarer)
    const newPrizeNumber = pickWeightedIndex(prizeWeights);
    const selectedPrize = data[newPrizeNumber].option;

    console.log(
      "Spinning - Prize Number:",
      newPrizeNumber,
      "Selected Prize:",
      selectedPrize
    );

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
      console.log("Animation complete - Setting winner to:", selectedPrize);
      setIsSpinning(false);
      setMustSpin(false);
      setWinner(selectedPrize); // Set the winner for claiming
      setHasPlayed(true); // Mark as played
      setShowWin(true);

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
    console.log("winner", winner);
    console.log("prizeNumber", prizeNumber);
    console.log("data", data);
    console.log("selected prize from data:", data[prizeNumber]?.option);
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

  // Buy spin handlers (inline buttons)
  const handleBuySpinWithNear = async () => {
    try {
      if (!nearConnected) {
        toast.error("Connect wallet first");
        return;
      }
      await signAndSendTransaction(CONTRACTID!, [
        {
          type: "FunctionCall",
          params: {
            methodName: "depositToGame",
            args: {},
            gas: "300000000000000",
            // default to 0.01 NEAR unless env overrides
            deposit:
              process.env.NEXT_PUBLIC_SPIN_PRICE_YOCTO ||
              "10000000000000000000000",
          },
        },
      ]);
      toast.success("Spin purchased with NEAR");
    } catch (e) {
      toast.error("Failed to buy spin with NEAR");
      console.error(e);
    }
  };

  const handleBuySpinWithPoints = async (count: string) => {
    try {
      if (!nearConnected) {
        toast.error("Connect wallet first");
        return;
      }

      console.log("count", count);
      await signAndSendTransaction(CONTRACTID!, [
        {
          type: "FunctionCall",
          params: {
            methodName: "purchaseSpinWithPoints",
            args: { points: count },
            gas: "300000000000000",
            deposit: "0",
          },
        },
      ]);
      const spins = Math.max(1, Math.floor(Number(count) / 500));
      toast.success(
        `Purchased ${spins} spin${spins > 1 ? "s" : ""} with points`
      );
    } catch (e) {
      toast.error("Failed to buy spin with points");
      console.error(e);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] w-full relative overflow-hidden">
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
                      ? `rotate(${prizeNumber * 40 + 1800}deg)` // 9 slices → 40° per slice
                      : "rotate(0deg)",
                  }}
                  priority
                />
              </div>

              {/* Prize Indicator Arrow */}
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 -translate-y-2 z-30">
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
            <button
              onClick={handleClaim}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {/* <button
                onClick={handleBuySpinWithNear}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-lg font-black rounded-2xl hover:opacity-90 transition-all"
              >
                Buy Spin (NEAR)
              </button> */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleBuySpinWithPoints("500")}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-black rounded-2xl hover:opacity-90 transition-all"
                >
                  1 Spin (500)
                </button>
                <button
                  onClick={() => handleBuySpinWithPoints("1000")}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-black rounded-2xl hover:opacity-90 transition-all"
                >
                  2 Spins (1000)
                </button>
                <button
                  onClick={() => handleBuySpinWithPoints("1500")}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-black rounded-2xl hover:opacity-90 transition-all"
                >
                  3 Spins (1500)
                </button>
                <button
                  onClick={() => handleBuySpinWithPoints("2000")}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-black rounded-2xl hover:opacity-90 transition-all"
                >
                  4 Spins (2000)
                </button>
              </div>
            </div>
          )}
      </div>

      <WinPopup
        isVisible={Boolean((winner || unclaimed) && !isClaimed && showWin)}
        prize={winner}
        onClaim={handleClaim}
        isClaimLoading={isClaimLoading}
        onClose={() => setShowWin(false)}
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
