"use client";

import { useEffect, useState } from "react";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAccountInfo,
  formatNearAmount,
  getAccountTxns,
} from "@/lib/nearblocks";
import { getAccountFull, formatYoctoToNear } from "@/lib/fastnear";
import { getNearUsd } from "@/lib/prices";
// import { getAccountTxnsFastnear } from "@/lib/fastnearExplorer";
import Image from "next/image";
import SendFlow from "@/components/features/wallet/SendFlow";
import AddFlow from "@/components/features/wallet/AddFlow";
import SwapFlow from "@/components/features/wallet/SwapFlow";
import SuccessModal from "@/components/features/wallet/SuccessModal";

type ActiveFlow = "send" | "add" | "swap" | null;

const WalletPage = () => {
  const { isConnected, isLoading, error, accountId, autoConnect, account } =
    usePrivateKeyWallet();
  const [nearBalance, setNearBalance] = useState<string | null>(null);
  const [recentTxns, setRecentTxns] = useState<any[] | null>(null);
  const [allTxns, setAllTxns] = useState<any[] | null>(null);
  const [showAllTxns, setShowAllTxns] = useState(false);
  const [nearUsd, setNearUsd] = useState<number | null>(null);
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!isConnected && !isLoading) {
      autoConnect().catch(() => {});
    }
  }, [isConnected, isLoading, autoConnect]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const price = await getNearUsd();
      if (!cancelled && price) setNearUsd(price);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    (async () => {
      try {
        const full = await getAccountFull(accountId);
        if (!cancelled && full?.state?.balance) {
          setNearBalance(formatYoctoToNear(full.state.balance));
        } else {
          const info = await getAccountInfo(accountId);
          if (!cancelled) {
            const bal = info?.account?.amount || info?.amount || info?.balance;
            if (bal) {
              setNearBalance(formatNearAmount(bal));
            }
          }
        }

        const nbTxns = await getAccountTxns(accountId);
        if (!cancelled) {
          if (Array.isArray(nbTxns)) {
            console.log("Raw Nearblocks data:", nbTxns.slice(0, 2)); // Debug log

            const normalized = nbTxns.map((row: any) => {
              // Parse Nearblocks transaction structure
              const action = row?.actions?.[0];

              // Determine direction relative to current account
              const signer = row?.signer_account_id;
              const receiver = row?.receiver_account_id;
              const isSend = signer === accountId;
              const isReceive = receiver === accountId && signer !== accountId;

              // Format amount from deposit (in yoctoNEAR)
              let amount = "";
              if (action?.deposit && action.deposit > 0) {
                const nearAmount = action.deposit / 1e24; // Convert yoctoNEAR to NEAR
                amount = nearAmount.toFixed(4);
              }

              // Determine transaction type and description
              let type = "unknown";
              let description = "Transaction";

              if (action?.action === "TRANSFER") {
                if (isSend) {
                  type = "send";
                  description = "NEAR Sent";
                } else if (isReceive) {
                  type = "receive";
                  description = "NEAR Received";
                } else {
                  // Fallback when neither side clearly matches (e.g., contract transfers)
                  type = signer && signer !== receiver ? "send" : "receive";
                  description = type === "send" ? "NEAR Sent" : "NEAR Received";
                }
              } else if (action?.action === "FUNCTION_CALL") {
                type = "interact";
                description = action.method || "Contract Call";
              }

              return {
                id: row?.transaction_hash || row?.id,
                type,
                amount,
                token: "NEAR",
                from: signer ?? row?.predecessor_account_id,
                to: row?.receiver_account_id,
                timestamp: row?.block_timestamp,
                status: row?.outcomes?.status ? "completed" : "failed",
                description,
                method: action?.method,
                fee: row?.outcomes_agg?.transaction_fee
                  ? (row.outcomes_agg.transaction_fee / 1e24).toFixed(6)
                  : "0",
              };
            });

            setAllTxns(normalized);
            setRecentTxns(normalized.slice(0, 5)); // Show first 5 by default
          } else {
            console.log("Failed to fetch transactions or rate limited");
            // Keep existing transactions if rate limited
          }
        }
      } catch (error) {
        console.error("Error fetching wallet data:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  useEffect(() => {
    if (!account || nearBalance) return;
    let cancelled = false;
    (async () => {
      try {
        const b = await account.getAccountBalance?.();
        if (!cancelled && b?.available) {
          setNearBalance(formatNearAmount(b.available));
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [account, nearBalance]);

  const usdBalance =
    nearUsd && nearBalance && /^[0-9]+(\.[0-9]+)?$/.test(nearBalance)
      ? (Number(nearBalance) * nearUsd).toFixed(2)
      : "0.00";

  const handleFlowSuccess = () => {
    setActiveFlow(null);
    setShowSuccess(true);
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-white text-lg">Connecting wallet...</div>
          {error && (
            <div className="text-red-400 text-sm">
              {error}
              <Button
                onClick={() => autoConnect()}
                className="mt-4 bg-blue-600 hover:bg-blue-700"
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] pb-24 relative overflow-hidden h-[calc(100vh-75px)]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
          <div className="absolute top-40 right-20 w-3 h-3 bg-purple-500 rounded-full animate-pulse delay-100" />
          <div className="absolute bottom-40 left-20 w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-200" />
        </div>

        <div className="relative z-10 px-4 pt-6 space-y-6 overflow-y-auto h-full">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10 p-2"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
            <h1
              className="text-3xl font-bold text-white tracking-wider"
              style={{
                fontFamily: "monospace",
                letterSpacing: "0.2em",
                textShadow: "0 0 10px rgba(255,255,255,0.5)",
              }}
            >
              WALLET
            </h1>
            <div className="w-20" />
          </div>

          <div className="relative">
            <div
              className="rounded-3xl p-[2px]"
              style={{
                background:
                  "linear-gradient(135deg, #00d4ff 0%, #9d4edd 50%, #7b2cbf 100%)",
              }}
            >
              <div className="bg-[#0f1535] rounded-3xl p-6 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="text-white/70 text-sm">Total balance</div>
                    <div className="text-5xl font-bold text-white">
                      ${usdBalance}
                    </div>
                  </div>
                  <div className="relative w-24 h-24">
                    <Image
                      src="/assets/wallet/mascot-robot.svg"
                      alt="Mascot"
                      width={96}
                      height={96}
                      className="object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-8 py-4">
            <button
              onClick={() => setActiveFlow("send")}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">Send</span>
            </button>

            <button
              onClick={() => setActiveFlow("add")}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">Add</span>
            </button>

            <button
              onClick={() => setActiveFlow("swap")}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </div>
              <span className="text-white text-sm font-medium">Swap</span>
            </button>
          </div>

          <div className="mt-8">
            <div
              className="rounded-3xl p-[2px]"
              style={{
                background:
                  "linear-gradient(135deg, #00d4ff 0%, #9d4edd 50%, #7b2cbf 100%)",
              }}
            >
              <div className="bg-[#0f1535] rounded-3xl p-6 space-y-4">
                <h2 className="text-xl font-bold text-white mb-4">
                  Transactions
                </h2>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-white font-medium">
                          Wallet Earn
                        </div>
                      </div>
                    </div>
                    <div className="text-yellow-400 font-bold">$120.32</div>
                  </div>

                  {(showAllTxns ? allTxns : recentTxns)?.map((txn, idx) => (
                    <div
                      key={`${txn.id || "noid"}-${txn.timestamp || idx}`}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            txn.type === "receive"
                              ? "bg-gradient-to-br from-green-400 to-green-600"
                              : txn.type === "send"
                              ? "bg-gradient-to-br from-red-400 to-red-600"
                              : "bg-gradient-to-br from-blue-400 to-purple-500"
                          }`}
                        >
                          <span className="text-white text-xs font-bold">
                            {txn.type === "receive"
                              ? "↗"
                              : txn.type === "send"
                              ? "↘"
                              : "⚡"}
                          </span>
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            {txn.description}
                          </div>
                          <div className="text-white/50 text-xs">
                            {txn.from?.slice(0, 8)}...{txn.from?.slice(-4)} →{" "}
                            {txn.to?.slice(0, 8)}...{txn.to?.slice(-4)}
                          </div>
                          {txn.status === "failed" && (
                            <div className="text-red-400 text-xs">Failed</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {txn.amount && (
                          <div className="text-yellow-400 font-bold">
                            {txn.amount} NEAR
                          </div>
                        )}
                        {txn.fee && txn.fee !== "0" && (
                          <div className="text-white/50 text-xs">
                            Fee: {txn.fee} NEAR
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* See More/Less Button */}
                  {allTxns && allTxns.length > 5 && (
                    <div className="flex justify-center mt-4">
                      <button
                        onClick={() => setShowAllTxns(!showAllTxns)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {showAllTxns
                          ? "Show Less"
                          : `See More (${allTxns.length - 5} more)`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeFlow === "send" && (
        <SendFlow
          onClose={() => setActiveFlow(null)}
          onSuccess={handleFlowSuccess}
        />
      )}
      {activeFlow === "add" && (
        <AddFlow onClose={() => setActiveFlow(null)} accountId={accountId} />
      )}
      {activeFlow === "swap" && (
        <SwapFlow
          onClose={() => setActiveFlow(null)}
          onSuccess={handleFlowSuccess}
        />
      )}
      {showSuccess && <SuccessModal onClose={handleCloseSuccess} />}
    </>
  );
};

export default WalletPage;
