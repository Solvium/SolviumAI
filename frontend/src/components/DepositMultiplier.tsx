import { useEffect, useMemo, useState } from "react";
import { Wallet, Star } from "lucide-react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import BarLoader from "react-spinners/BarLoader";
import { ToastContainer, toast, Bounce } from "react-toastify";
import timestampLib from "unix-timestamp";
import { useNearWallet } from "@/app/hooks/useNearWallet";
import { usePrivateKeyWallet } from "@/app/contexts/PrivateKeyWalletContext";

// Update interfaces at top of file
export interface Deposit {
  id: string;
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
  const [walletType, setWalletType] = useState<"NEAR">("NEAR");
  const [isDepositing, setIsDepositing] = useState<boolean>(false);

  const {
    state,
    deposits,
    isLoading,
    connectWallet,
    disconnectWallet,
    makeDeposit,
    getDeposits,
    getBalance,
  } = useNearWallet();

  const { isConnected, accountId, balance, error } = state;

  // Also expose our NEAR wallet (database/private-key based)
  const {
    isConnected: pkConnected,
    accountId: pkAccountId,
    autoConnect: pkAutoConnect,
  } = usePrivateKeyWallet();

  const getCurrencyLabel = () => "NEAR";
  const getMinDeposit = () => "0.1";

  // Connect wallet when modal opens
  useEffect(() => {
    if (isOpen && !isConnected) {
      console.log("Connecting to NEAR wallet...");
      connectWallet(); // Uses test private key automatically
    }
  }, [isOpen, isConnected, connectWallet]);

  // Load deposits when wallet is connected
  useEffect(() => {
    if (isOpen && isConnected) {
      console.log("Loading deposits...");
      getDeposits(); // Uses test private key automatically
    }
  }, [isOpen, isConnected, getDeposits]);

  const handleStart = () => {
    // Open modal immediately without checking wallet connection
    setIsOpen(true);
    // Ensure our NEAR wallet attempts auto-connect too
    if (!pkConnected) {
      pkAutoConnect().catch(() => {});
    }
  };

  const handleNearDeposit = async (amount: string) => {
    setIsDepositing(true);

    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount)) throw new Error("Invalid amount");

      console.log("Making NEAR deposit:", amount, "NEAR");

      const result = await makeDeposit(amount); // Uses test private key automatically

      if (result.success) {
        toast.success("Deposit successful!");
        setAmount("");

        // Refresh deposits
        await getDeposits();
      } else {
        throw new Error(result.error || "Deposit failed");
      }
    } catch (error) {
      console.error("Failed to deposit:", error);
      toast.error(error instanceof Error ? error.message : "Deposit failed");
    } finally {
      setIsDepositing(false);
    }
  };

  const handleSmartDeposit = async (amount: string) => {
    await handleNearDeposit(amount);
  };

  // Add helper functions before component
  const formatDepositAmount = (amount: string) => {
    return `${amount} NEAR`;
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
    return value >= 0.1; // NEAR minimum
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
              <a
                className={`tab ${walletType === "NEAR" ? "tab-active" : ""}`}
                onClick={() => setWalletType("NEAR")}
              >
                NEAR
              </a>
            </div>
            {!isConnected ? (
              <div className="card border-blue-80 border-[2px] p-8 text-center z-0">
                <h2 className="text-xl mb-4">Connecting to wallet...</h2>
                {isLoading && (
                  <div className="loading loading-spinner loading-md"></div>
                )}
                {error && <p className="text-red-500 mt-2">{error}</p>}
                <p className="text-sm text-gray-400 mt-4">
                  Please wait while we connect to your NEAR wallet
                </p>
                {/* Our NEAR wallet context status */}
                <div className="mt-4 text-left">
                  <p className="text-xs text-gray-400">
                    NEAR Wallet (PrivateKey):
                  </p>
                  <p className="font-mono text-xs break-all">
                    {pkAccountId || "Not connected"}
                  </p>
                  {!pkConnected && (
                    <button
                      onClick={() => pkAutoConnect()}
                      className="mt-2 text-xs underline"
                    >
                      Connect NEAR wallet
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Our NEAR wallet summary */}
                <div className="card border-blue-80 border-[2px] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">NEAR Wallet</p>
                      <p className="font-mono text-xs break-all">
                        {pkAccountId || accountId || "Not connected"}
                      </p>
                    </div>
                    {pkAccountId && (
                      <button
                        className="btn btn-xs"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(pkAccountId);
                          } catch {
                            const ta = document.createElement("textarea");
                            ta.value = pkAccountId;
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand("copy");
                            document.body.removeChild(ta);
                          }
                        }}
                      >
                        Copy
                      </button>
                    )}
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
                            <span className="text-white">
                              {" "}
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
                              <Star size={20} /> Estimated Multiplier
                            </h3>
                            <p className="text-2xl font-bold">
                              {amount
                                ? `${(parseFloat(amount) * 10).toFixed(1)}x`
                                : "0x"}
                            </p>
                            <p className="text-sm opacity-70">
                              {" "}
                              Active for 1 week{" "}
                            </p>
                          </div>
                        </div>
                        <button
                          disabled={
                            isDepositing || !amount || !isValidAmount(amount)
                          }
                          onClick={() => handleSmartDeposit(amount)}
                          className="btn btn-secondary w-full"
                        >
                          {amount && !isValidAmount(amount) ? (
                            `Minimum 0.1 NEAR required`
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
                        {" "}
                        My {getCurrencyLabel()} Deposits{" "}
                      </h2>
                      {isLoading ? (
                        <div className="text-center py-8">
                          <div className="loading loading-spinner loading-md"></div>
                          <p className="text-gray-500 mt-2">
                            {" "}
                            Loading deposits...{" "}
                          </p>
                        </div>
                      ) : deposits?.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500">
                            {" "}
                            No {getCurrencyLabel()} deposits found{" "}
                          </p>
                          <p className="text-sm text-gray-400 mt-2">
                            {" "}
                            Make your first deposit to get started{" "}
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
                                      {deposit.amount} NEAR
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
                                    {" "}
                                    Multiplier: {deposit.multiplier.toString()}x{" "}
                                  </p>
                                  <p>
                                    {" "}
                                    Start Time: {formatDate(
                                      deposit.startTime
                                    )}{" "}
                                  </p>
                                  <p>
                                    {" "}
                                    End Time:{" "}
                                    {formatDate(
                                      deposit.startTime + 604800 * 1000
                                    )}{" "}
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
    </div>
  );
}
