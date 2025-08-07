import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { utils } from "near-api-js";
import BarLoader from "react-spinners/BarLoader";
import { ToastContainer, toast, Bounce } from "react-toastify";
import timestampLib from "unix-timestamp";
import { useNearWallet } from "@/app/hooks/useNearWallet";

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
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState("deposit");

  // Use the new NEAR wallet hook
  const {
    isConnected,
    accountId,
    balance,
    isLoading,
    error,
    deposits,
    isLoadingDeposits,
    connectWallet,
    disconnectWallet,
    makeDeposit,
    getDeposits,
    getBalance,
  } = useNearWallet();

  const getCurrencyLabel = () => "NEAR";
  const getMinDeposit = () => "0.1";

  // Connect wallet when component mounts
  useEffect(() => {
    if (user?.id && !isConnected) {
      // Get private key from user data or environment
      const privateKey =
        user.wallet?.privateKey || process.env.NEXT_PUBLIC_NEAR_PRIVATE_KEY;
      const accountId =
        user.wallet?.accountId ||
        process.env.NEXT_PUBLIC_CONTRACT_ID ||
        "solviumpuzzlegame.near";

      if (privateKey) {
        connectWallet(privateKey, accountId);
      }
    }
  }, [user?.id, isConnected, connectWallet]);

  // Load deposits when wallet is connected
  useEffect(() => {
    if (isConnected && user?.id) {
      const privateKey =
        user.wallet?.privateKey || process.env.NEXT_PUBLIC_NEAR_PRIVATE_KEY;
      const accountId =
        user.wallet?.accountId ||
        process.env.NEXT_PUBLIC_CONTRACT_ID ||
        "solviumpuzzlegame.near";

      if (privateKey) {
        getDeposits(privateKey, accountId);
      }
    }
  }, [isConnected, user?.id, getDeposits]);

  const handleStart = () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }
    setIsOpen(true);
  };

  const handleNearDeposit = async (amount: string) => {
    if (!user?.id) {
      toast.error("User not found");
      return;
    }

    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount)) throw new Error("Invalid amount");

      const privateKey =
        user.wallet?.privateKey || process.env.NEXT_PUBLIC_NEAR_PRIVATE_KEY;
      const accountId =
        user.wallet?.accountId ||
        process.env.NEXT_PUBLIC_CONTRACT_ID ||
        "solviumpuzzlegame.near";

      if (!privateKey) {
        toast.error("No private key available");
        return;
      }

      const result = await makeDeposit(
        privateKey,
        accountId,
        numAmount.toString()
      );

      if (result.success) {
        toast.success("Deposit successful");
        setAmount("");

        // Refresh deposits and balance
        await getDeposits(privateKey, accountId);
        await getBalance(privateKey, accountId);
      } else {
        toast.error(result.error || "Deposit failed");
      }
    } catch (error) {
      console.error("Failed to deposit:", error);
      toast.error("Deposit failed. Please try again.");
    }
  };

  const handleSmartDeposit = async (amount: string) => {
    await handleNearDeposit(amount);
  };

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
    return value >= 0.5;
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
            {/* Close Button */}
            <div className="p-2">
              <button onClick={() => setIsOpen(false)} className="">
                <h3>
                  <XMarkIcon className="h-6 w-6 mb-3  text-white" />
                </h3>
              </button>
            </div>

            <div className="tabs tabs-boxed mb-4">
              <a className={`tab ${true ? "tab-active" : ""}`}>NEAR</a>
            </div>

            {/* Wallet Connection Status */}
            {!isConnected ? (
              <div className="card border-blue-80 border-[2px] p-8 text-center z-0">
                <h2 className="text-xl mb-4">Connecting to wallet...</h2>
                {isLoading && (
                  <div className="loading loading-spinner loading-md"></div>
                )}
                {error && <p className="text-red-500 mt-2">{error}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Wallet Info */}
                <div className="card bg-base-700 border-blue-80 border-[2px] p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm opacity-70">Account</p>
                      <p className="font-mono text-sm">{accountId}</p>
                    </div>
                    <div>
                      <p className="text-sm opacity-70">Balance</p>
                      <p className="font-bold">{balance || "0"} NEAR</p>
                    </div>
                  </div>
                </div>

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
                            <span className="text-white">Amount (NEAR)</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min={getMinDeposit()}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={`Enter amount (min. ${getMinDeposit()} NEAR)`}
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
                            isLoading || !amount || !isValidAmount(amount)
                          }
                          onClick={() => handleSmartDeposit(amount)}
                          className="btn btn-secondary w-full"
                        >
                          {amount && !isValidAmount(amount) ? (
                            `Minimum 0.5 NEAR required`
                          ) : (
                            <>
                              Deposit NEAR
                              {isLoading && <BarLoader color="#fff" />}
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
                        My NEAR Deposits
                      </h2>
                      {isLoadingDeposits ? (
                        <div className="text-center py-8">
                          <div className="loading loading-spinner loading-md"></div>
                          <p className="text-gray-500 mt-2">
                            Loading deposits...
                          </p>
                        </div>
                      ) : deposits?.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500">
                            No NEAR deposits found
                          </p>
                          <p className="text-sm text-gray-400 mt-2">
                            Make your first deposit to get started
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {deposits?.map((deposit: Deposit) => (
                            <div
                              key={deposit.id.toString()}
                              className="collapse border-blue-80 border-[2px] collapse-arrow bg-base-600"
                            >
                              <input type="checkbox" />
                              <div className="collapse-title">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-bold">
                                      {`${deposit.amount} NEAR`}
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
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
