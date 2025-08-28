"use client";
import { useState, useEffect, useCallback } from "react";
import { providers, utils } from "near-api-js";
import { CodeResult } from "near-api-js/lib/providers/provider";

import dynamic from "next/dynamic";
import { CONTRACTID, MEME_TOKEN_ADDRESS } from "./constants/contractId";
import { Bounce, toast, ToastContainer } from "react-toastify";
import BuySpin from "./BuySpin";
import { useMultiLoginContext } from "@/app/contexts/MultiLoginContext";
import { usePrivateKeyWallet } from "@/app/contexts/PrivateKeyWalletContext";
import WalletConnect from "./WalletConnect";
const Wheel = dynamic(
  () => import("react-custom-roulette").then((mod) => mod.Wheel),
  { ssr: false }
);

interface ClaimProps {
  rewardAmount: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

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
    <div className="text-[#6C5CE7] text-center">
      <div className="text-sm mb-1">Next spin available in</div>
      <div className="font-semibold">
        {hours}h {minutes}m {seconds}s
      </div>
    </div>
  );
};

export const WheelOfFortune = () => {
  const { userData: user, claimPoints } = useMultiLoginContext();
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
    { option: "1", style: { fontSize: 20, fontWeight: "bold" } },
    { option: "25", style: { fontSize: 20, fontWeight: "bold" } },
    { option: "50", style: { fontSize: 20, fontWeight: "bold" } },
    { option: "100", style: { fontSize: 20, fontWeight: "bold" } },
    { option: "250", style: { fontSize: 20, fontWeight: "bold" } },
    { option: "500", style: { fontSize: 20, fontWeight: "bold" } },
    { option: "1000", style: { fontSize: 20, fontWeight: "bold" } },
    { option: "2000", style: { fontSize: 20, fontWeight: "bold" } },

    { option: "5000", style: { fontSize: 20, fontWeight: "bold" } },
    // { option: "10000", style: { fontSize: 20, fontWeight: "bold" } },
  ];

  const checkTokenRegistrationCallback = useCallback(async () => {
    if (!nearAddress) return null;

    try {
      const result = await checkTokenRegistration(MEME_TOKEN_ADDRESS);
      console.log("Token registration check result:", result);
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

  // console.log(user);
  // Add useEffect to check last played time
  useEffect(() => {
    setSpinningSound(new Audio(location.origin + "/spin.mp3"));
    setLastPlayed(Number(user?.lastSpinClaim));
    const now = new Date(Date.now());
    const cooldownEnd = new Date(
      new Date(user?.lastSpinClaim ?? 0).getTime() + 24 * 60 * 60 * 1000
    );
    console.log(now);
    console.log(cooldownEnd);
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
      let isRegistered = await checkTokenRegistrationCallback();
      console.log("isRegistered", isRegistered);

      if (!isRegistered) {
        await registerTokenCallback(MEME_TOKEN_ADDRESS);
      }

      console.log(rewardAmount, MEME_TOKEN_ADDRESS, "rewardAmount");

      // Claim wheel transaction
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

      // Wait for transaction completion
      await claimTransaction;

      // Execute the transfer transaction immediately after claimWheel
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

      // Wait for the execute_transfer transaction to complete
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

  const handleSpinClick = () => {
    const now = Date.now();

    if (!nearConnected) {
      toast.error("Please connect your NEAR wallet to continue!");
      return;
    }

    claimPoints("spin claim", setCanClaim);
    const newPrizeNumber = Math.floor(Math.random() * data.length);
    setPrizeNumber(newPrizeNumber);
    setMustSpin(true);
    spinningSound.play();
    setLastPlayed(now);
    setCooldownTime(new Date(now + 24 * 60 * 60 * 1000));
    localStorage.setItem("lastPlayedTime", now.toString());
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
            // Extract message between "Smart contract panicked:" and first "\n"
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

  // Update handleClaim function
  const handleClaim = async () => {
    if (!winner) return;
    setIsClaimLoading(true);
    console.log(data[prizeNumber].option, "data infor   ");
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

  console.log(hasPlayed);
  return (
    <div className="min-h-screen w-full  bg-[#0B0B14] py-4 px-4 md:py-6">
      <div className="max-w-xl mx-auto">
        <div className="bg-[#151524] rounded-[28px] p-6 shadow-[0_0_30px_rgba(76,111,255,0.1)]">
          <h2 className="text-2xl mt-10 font-bold text-center text-white mb-1">
            Spin The Wheel
          </h2>
          <p className="mb-4 text-sm text-center text-[#6C5CE7]">
            You need to have made atleast a deposit before playing
          </p>
          <p className="mb-8 text-sm text-center text-[#6C5CE7]">
            Spins Left:{" "}
            {new Date(cooldownTime) > new Date(Date.now())
              ? user?.dailySpinCount
              : 2}
          </p>

          {/* Wallet Connection */}
          <WalletConnect />

          {/* Wheel Container */}
          <div className="relative flex justify-center mb-8">
            <div className="relative scale-85 origin-center">
              {/* The wheel itself - moved to be first in DOM order */}
              <Wheel
                mustStartSpinning={mustSpin}
                prizeNumber={prizeNumber}
                data={data}
                backgroundColors={[
                  "#FF6B6B", // Red
                  "#4ECDC4", // Teal
                  "#FFD93D", // Yellow
                  "#6C5CE7", // Purple
                  "#95A5A6", // Gray
                  "#2ECC71", // Green
                ]}
                textColors={["#FFFFFF"]}
                outerBorderColor="#2A2A45"
                outerBorderWidth={3}
                innerRadius={20}
                innerBorderColor="#2A2A45"
                innerBorderWidth={2}
                radiusLineColor="#2A2A45"
                radiusLineWidth={1}
                fontSize={16}
                perpendicularText={true}
                textDistance={60}
                spinDuration={0.5}
                onStopSpinning={() => {
                  setMustSpin(false);
                  const prize = {
                    winner: data[prizeNumber].option,
                    prizeNumber: prizeNumber,
                  };
                  localStorage.setItem("unclaimedPrize", JSON.stringify(prize));
                  setUnclaimed(prize);
                  setIsClaimed(false);
                  setWinner(prize.winner);
                  spinningSound.pause();
                  spinningSound.currentTime = 0;
                }}
              />

              {/* Outer glow effect */}
              <div className="absolute -inset-[30px] bg-gradient-radial from-[#4C6FFF]/40 to-transparent blur-2xl animate-glow pointer-events-none" />

              {/* Inner glow effects */}
              <div className="absolute inset-0">
                <div className="absolute inset-0 rounded-full bg-gradient-conic from-[#4C6FFF]/30 via-[#6C5CE7]/30 to-[#4C6FFF]/30 animate-wheel-spin pointer-events-none shadow-glow-blue" />
              </div>

              {/* Glowing bulbs - moved to be last in DOM order and added z-10 */}
              <div className="absolute inset-0 z-10">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-3 h-3"
                    style={{
                      top: "50%",
                      left: "50%",
                      transform: `rotate(${i * 30}deg) translateY(-145px)`,
                    }}
                  >
                    <div
                      className="absolute w-full h-full rounded-full bg-gradient-radial from-white via-white/40 to-transparent shadow-glow-lg animate-bulb-pulse"
                      style={{
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                    <div className="absolute w-2 h-2 top-0.5 left-0.5 rounded-full bg-white shadow-glow-xl" />
                  </div>
                ))}
              </div>

              {/* Center decoration - also added z-10 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="w-12 h-12 rounded-full bg-gradient-radial from-[#4C6FFF] to-[#6C5CE7] shadow-glow-blue animate-glow">
                  <div className="w-8 h-8 m-2 rounded-full bg-[#151524]">
                    <div className="w-6 h-6 m-1 rounded-full bg-gradient-radial from-[#4C6FFF] to-[#6C5CE7] shadow-glow-sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {(winner || unclaimed) && !isClaimed ? (
              <div className="mt-6 text-center">
                <div className="bg-[#1A1A2F] rounded-xl p-6 border border-[#2A2A45] relative overflow-hidden">
                  <div className="absolute inset-0 bg-[#4C6FFF] blur-2xl opacity-5"></div>
                  <div className="relative">
                    <p className="text-xl font-bold text-[#4C6FFF] mb-4">
                      You won {winner} tokens!
                    </p>
                    <button
                      onClick={handleClaim}
                      disabled={isClaimLoading}
                      className="w-full py-3 bg-[#2ECC71] hover:bg-[#27AE60] text-white font-bold rounded-xl
                               transition-all duration-300
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isClaimLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-t-2 border-white animate-spin rounded-full"></div>
                          <span>Claiming...</span>
                        </div>
                      ) : (
                        "Claim Reward"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {hasPlayed && new Date(cooldownTime) > new Date(Date.now()) ? (
                  <div className="bg-[#1A1A2F] rounded-xl p-4 border border-[#2A2A45]">
                    <CountdownTimer targetTime={cooldownTime} />
                  </div>
                ) : (
                  <button
                    onClick={handleSpinClick}
                    disabled={
                      (hasPlayed &&
                        new Date(cooldownTime) > new Date(Date.now())) ||
                      mustSpin
                    }
                    className="w-full py-4 bg-gradient-to-r from-[#4C6FFF] to-[#6C5CE7] text-white text-lg font-bold rounded-xl
                         hover:opacity-90 transition-all duration-300
                         disabled:opacity-50 disabled:cursor-not-allowed
                         relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-all duration-1000"></div>
                    <span className="relative">SPIN</span>
                  </button>
                )}
              </div>
            )}

            {isClaimed && (
              <div>
                <div className="mt-6 text-3xl text-center text-[#2ECC71] font-bold">
                  Reward claimed successfully!
                </div>
              </div>
            )}
            {(user?.dailySpinCount ?? 0) <= 0 &&
              new Date(cooldownTime) > new Date(Date.now()) && (
                <button
                  onClick={() => setBuySpins(true)}
                  className="w-full py-4 bg-gradient-to-r from-[#4C6FFF] to-[#6C5CE7] text-white text-lg font-bold rounded-xl
                         hover:opacity-90 transition-all duration-300
                         disabled:opacity-50 disabled:cursor-not-allowed
                         relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-all duration-1000"></div>
                  <span className="relative">BUY SPIN</span>
                </button>
              )}
            {buySpins && <BuySpin setBuySpins={setBuySpins} />}
          </div>
        </div>
      </div>
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
