import { useEffect, useMemo, useState } from "react";
import { useTonAddress } from "@tonconnect/ui-react";
import { fromNano } from "@ton/core";
import { Wallet, Star } from "lucide-react";
import { useTonConnect } from "@/app/hooks/useTonConnect";
import { useMultiplierContract } from "@/app/hooks/useDepositContract";
import { useAuth } from "@/app/contexts/AuthContext";
import { useUserWallet } from "@/app/hooks/useUserWallet";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { utils, providers } from "near-api-js";
import { useNearDeposits } from "@/app/contracts/near_deposits";
import BarLoader from "react-spinners/BarLoader";
import { ToastContainer, toast, Bounce } from "react-toastify";
import timestampLib from "unix-timestamp";
// Update interfaces at top of file
export interface Deposit {
  id: number;
  amount: string;
  startTime: number;
  multiplier: number;
  active: boolean;
}

interface DepositResponse {
  points: number;
  multiplier: number;
  weeklyScore: any;
  user: any;
}

export default function DepositMultiplier({ user }: any) {
  const { connected: tonConnected, connectWallet: connectTon } =
    useTonConnect();
  const { user: authUser } = useAuth();
  const { sendTransaction, balance } = useUserWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState("deposit");
  const [walletType, setWalletType] = useState<"TON" | "NEAR">("NEAR");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isDepositing, setIsDepositing] = useState<boolean>(false);
  const tonAddress = useTonAddress();
  const { deposits, handleDeposit } = useMultiplierContract(tonAddress);

  const getCurrencyLabel = () => (walletType === "TON" ? "TON" : "NEAR");
  const getMinDeposit = () => (walletType === "TON" ? "0.11" : "0.1");

  const {
    deposits: nearDeposits,
    loading: nearLoading,
    refetch,
  } = useNearDeposits();

  //   useEffect(() => {
  //     const pollInterval = setInterval(() => {
  //       refetch();
  //     }, 3000);

  //     return () => clearInterval(pollInterval);
  //   }, [refetch]);

  // console.log(nearDeposits, "nearDeposits");

  const getDeposits = (): Deposit[] => {
    if (walletType === "TON") {
      return deposits;
    }

    if (!nearDeposits?.deposits) return [];

    const ONE_WEEK_IN_SECONDS = 604800;

    const isDepositActive = (startTimeInMs: number) => {
      const startTimeInSeconds = startTimeInMs / 1000; // Convert ms to seconds
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      const endTimeInSeconds = startTimeInSeconds + ONE_WEEK_IN_SECONDS;

      // Return true only if current time is less than end time
      return currentTimeInSeconds <= endTimeInSeconds;
    };

    return Object.values(nearDeposits.deposits)
      .map((deposit) => {
        const startTimeInMs = Number(deposit.startTime) / 1000000; // Convert to milliseconds

        return {
          id: deposit.id,
          amount: utils.format.formatNearAmount(deposit.amount),
          endTime: startTimeInMs + ONE_WEEK_IN_SECONDS * 1000,
          startTime: startTimeInMs,
          multiplier: Number(deposit.multiplier) / 1e16,
          active: isDepositActive(startTimeInMs),
        };
      })
      .sort((a, b) => b.startTime - a.startTime); // Sort by newest first
  };

  // Update currentDeposits type
  const currentDeposits = getDeposits();

  // console.log(currentDeposits, "firstDeposit");
  const isLoading = walletType === "NEAR" ? nearLoading : false;

  const isConnected = walletType === "NEAR" ? authUser?.isConnected : false; // Add TON connection check

  const handleStart = () => {
    if (!isConnected) {
      setIsOpen(true);
      return;
    }
    setIsOpen(true);
  };

  const handleWalletConnect = async () => {
    try {
      if (walletType === "TON") {
        await connectTon();
      } else {
        await sendTransaction();
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  const handleNearDeposit = async (amount: string) => {
    setIsDepositing(true);
    if (!authUser?.nearAddress || !authUser?.selector) return;

    try {
      const numAmount = parseFloat(amount);

      if (isNaN(numAmount)) throw new Error("Invalid amount");

      const wallet = authUser.selector;
      const deposit = utils.format.parseNearAmount(amount);

      await wallet.signAndSendTransaction({
        signerId: authUser.nearAddress,
        receiverId: process.env.NEXT_PUBLIC_CONTRACT_ID!,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "depositToGame",
              args: {},
              gas: "30000000000000",
              deposit: deposit || "0",
            },
          },
        ],
      });

      const response = await fetch("/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount: numAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process deposit");
      }

      const { points, multiplier } = data as DepositResponse;

      toast.success("Deposit successful");
      // Trigger refresh after deposit
      setRefreshTrigger((prev) => prev + 1);
      setAmount("");

      // Immediate refetch
      await refetch();
    } catch (error) {
      console.error("Failed to deposit:", error);
      throw error;
    } finally {
      setIsDepositing(false);
    }
  };

  useEffect(() => {
    if (refreshTrigger > 0) {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  const handleSmartDeposit = async (amount: string) => {
    if (walletType === "TON") {
      await handleDeposit(amount);
    } else {
      await handleNearDeposit(amount);
      // Add Near deposit logic here
      // await handleNearDeposit(amount);
    }
  };

  // Add helper functions before component
  const formatDepositAmount = (amount: string, type: "TON" | "NEAR") => {
    return type === "TON"
      ? `${fromNano(amount)} TON`
      : `${utils.format.formatNearAmount(amount)} NEAR`;
  };

  interface Deposit {
    id: string | number;
    amount: string;
    startTime: number;
    multiplier: number;
    active: boolean;
  }

  const formatDate = (timestamp: number | string): string => {
    try {
      // Convert milliseconds to seconds for timestampLib
      const seconds = Number(timestamp) / 1000;

      // Use timestampLib to create date
      const date = timestampLib.toDate(seconds);

      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "UTC",
        timeZoneName: "short",
      });
    } catch (error) {
      console.error("Date formatting error:", error);
      return "Invalid Date";
    }
  };

  const isValidAmount = (amount: string): boolean => {
    const value = parseFloat(amount);
    if (walletType === "NEAR") {
      return value >= 0.5;
    }
    return value >= 0.11; // TON minimum
  };
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <button
        onClick={handleStart}
        className="mt-3 text-[13px] border-blue-80 border-[2px] text-white h-8 flex items-center justify-center rounded-lg px-3"
      >
        Start
      </button>

      {isOpen && (
        <div className="fixed z-[50] top-0 left-0 w-full h-full bg-[rgba(0,0,0,0.7)] flex items-center justify-center">
          <div className="border-blue-80 border-[2px] w-[85%] mx-auto bg-black p-5">
            {/* Wallet Type Selector */}
            <div className="p-2">
              <button onClick={() => setIsOpen(false)} className="">
                <h3>
                  <XMarkIcon className="h-6 w-6 mb-3  text-white" />
                </h3>
              </button>
            </div>

            <div className="tabs tabs-boxed mb-4">
              {/* <a
                className={`tab ${walletType === "TON" ? "tab-active" : ""}`}
                onClick={() => setWalletType("TON")}
              >
                TON
              </a> */}
              <a
                className={`tab ${walletType === "NEAR" ? "tab-active" : ""}`}
                onClick={() => setWalletType("NEAR")}
              >
                NEAR
              </a>
            </div>

            {!isConnected ? (
              <div className="card border-blue-80 border-[2px] p-8 text-center z-0">
                <h2 className="text-xl mb-4">
                  Connect your {walletType} wallet to get started
                </h2>
                <button
                  onClick={handleWalletConnect}
                  className="btn btn-primary flex"
                >
                  <Wallet className="mr-2 hidden md:flex" size={20} />
                  CONNECT
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="tabs tabs-boxed">
                  <a
                    className={`tab ${
                      activeTab === "deposit" ? "tab-active" : ""
                    }`}
                    onClick={() => setActiveTab("deposit")}
                  >
                    Deposit
                  </a>
                  <a
                    className={`tab ${
                      activeTab === "deposits" ? "tab-active" : ""
                    }`}
                    onClick={() => setActiveTab("deposits")}
                  >
                    My Deposits
                  </a>
                </div>
                {activeTab === "deposit" ? (
                  <div className="card bg-base-800 border-blue-80 border-[2px]">
                    <div className="card-body">
                      <h2 className="card-title text-center">Make a Deposit</h2>
                      <div className="space-y-4">
                        <div className="form-control">
                          <label className="label">
                            <span className="text-white">
                              Amount ({getCurrencyLabel()})
                            </span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min={getMinDeposit()}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={`Enter amount (min. ${getMinDeposit()} ${getCurrencyLabel()})`}
                            className="input text-black bg-slate-300 input-bordered w-full"
                          />
                        </div>
                        <div className="card bg-base-500 border-blue-80 border-[2px]">
                          <div className="card-body">
                            <h3 className="card-title text-sm">
                              <Star size={20} />
                              Estimated Multiplier
                            </h3>
                            <p className="text-2xl font-bold">
                              {amount
                                ? `${(parseFloat(amount) * 10).toFixed(1)}x`
                                : "0x"}
                            </p>
                            <p className="text-sm opacity-70">
                              Active for 1 week
                            </p>
                          </div>
                        </div>
                        <button
                          disabled={
                            isDepositing || !amount || !isValidAmount(amount)
                          }
                          onClick={() => handleSmartDeposit(amount)}
                          className="btn btn-secondary w-full"
                          // disabled={!amount || parseFloat(amount) < 0.11}
                        >
                          {amount && !isValidAmount(amount) ? (
                            `Minimum ${
                              walletType === "NEAR" ? "0.5 NEAR" : "0.11 TON"
                            } required`
                          ) : (
                            <>
                              Deposit {getCurrencyLabel()}
                              {isDepositing && <BarLoader color="#fff" />}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card bg-base-600 border-blue-80 border-[2px]">
                    <div className="w-full p-2">
                      <h2 className="text-xl mb-4 text-center">
                        My {getCurrencyLabel()} Deposits
                      </h2>
                      {isLoading ? (
                        <div className="text-center py-8">
                          <div className="loading loading-spinner loading-md"></div>
                          <p className="text-gray-500 mt-2">
                            Loading deposits...
                          </p>
                        </div>
                      ) : currentDeposits?.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500">
                            No {getCurrencyLabel()} deposits found
                          </p>
                          <p className="text-sm text-gray-400 mt-2">
                            Make your first deposit to get started
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {currentDeposits?.map((deposit: Deposit) => (
                            <div
                              key={deposit.id.toString()}
                              className="collapse border-blue-80 border-[2px] collapse-arrow bg-base-600"
                            >
                              <input type="checkbox" />
                              <div className="collapse-title">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-bold">
                                      {walletType === "TON"
                                        ? `${fromNano(deposit.amount)} TON`
                                        : `${deposit.amount} NEAR`}
                                    </p>
                                    <p className="text-sm opacity-70">
                                      {formatDate(deposit.startTime)}
                                    </p>
                                  </div>
                                  <div
                                    className={`badge ${
                                      deposit.active
                                        ? "badge-success"
                                        : "badge-ghost"
                                    }`}
                                  >
                                    {deposit.active ? "Active" : "Expired"}
                                  </div>
                                </div>
                              </div>
                              <div className="collapse-content">
                                <div className="pt-4 space-y-2">
                                  <p>
                                    Multiplier: {deposit.multiplier.toString()}x
                                  </p>
                                  <p>
                                    Start Time: {formatDate(deposit.startTime)}
                                  </p>
                                  <p>
                                    End Time:{" "}
                                    {formatDate(
                                      deposit.startTime + 604800 * 1000
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                />{" "}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Alert */}
      {/* {error != "" && (
        <div className="alert alert-error mt-4">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )} */}
    </div>
  );
}
