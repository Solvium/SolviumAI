"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAccountInfo, formatNearAmount } from "@/lib/nearblocks";
import { getAccountFull, formatYoctoToNear } from "@/lib/fastnear";
import { getNearUsd } from "@/lib/prices";
// import { getAccountTxnsFastnear } from "@/lib/fastnearExplorer";
import Image from "next/image";
import SendFlow from "@/components/features/wallet/SendFlow";
import AddFlow from "@/components/features/wallet/AddFlow";
import SwapFlow from "@/components/features/wallet/SwapFlow";
import SuccessModal from "@/components/features/wallet/SuccessModal";
import { useWalletPortfolioContext } from "@/contexts/WalletPortfolioContext";

type ActiveFlow = "send" | "add" | "swap" | null;

const WalletPage = () => {
  const { isConnected, isLoading, error, accountId, autoConnect, account } =
    usePrivateKeyWallet();
  const [nearBalance, setNearBalance] = useState<string | null>(null);
  const [recentTxns, setRecentTxns] = useState<any[] | null>(null);
  const [allTxns, setAllTxns] = useState<any[] | null>(null);
  const [showAllTxns, setShowAllTxns] = useState(false);
  const [activeTab, setActiveTab] = useState<"assets" | "txns">("assets");
  const [nearUsd, setNearUsd] = useState<number | null>(null);
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const lastWalletFetchAtRef = useRef<number>(0);
  const [tokenHoldings, setTokenHoldings] = useState<
    { id: string; symbol: string; balance: string; decimals?: number }[]
  >([]);
  const [tokenPricesUsd, setTokenPricesUsd] = useState<Record<string, number>>(
    {}
  );
  const portfolio = useWalletPortfolioContext();

  // Disable background scroll when a modal/flow is active
  useEffect(() => {
    try {
      if (activeFlow) {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
          document.body.style.overflow = prev;
        };
      }
    } catch {}
    return;
  }, [activeFlow]);

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
    const now = Date.now();
    // Debounce wallet data fetch to at most once every 30s
    if (now - lastWalletFetchAtRef.current < 30000) return;
    lastWalletFetchAtRef.current = now;

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

        // txns and tokens are provided by useWalletPortfolio
      } catch (error) {
        console.error("Error fetching wallet data:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  // Sync txns from portfolio
  useEffect(() => {
    if (!portfolio) return;
    const all = portfolio.txns || [];
    setAllTxns(all);
    setRecentTxns(all.slice(0, 5));
  }, [portfolio]);

  // Sync tokens from portfolio
  useEffect(() => {
    if (!portfolio) return;
    const mapped = (portfolio.tokens || []).map((t) => ({
      id: t.id,
      symbol: t.symbol,
      balance: t.balance,
      decimals: t.decimals,
    }));
    setTokenHoldings(mapped);
  }, [portfolio]);

  // Fetch USD prices for all token holdings
  useEffect(() => {
    (async () => {
      try {
        const uniqueIds = Array.from(
          new Set(
            (tokenHoldings || []).map((t) =>
              t.symbol === "NEAR" ? "wrap.near" : t.id
            )
          )
        ).filter(Boolean) as string[];
        if (uniqueIds.length === 0) return;
        const entries = await Promise.all(
          uniqueIds.map(async (id) => {
            // Stablecoins
            if (
              id.toLowerCase() ===
                "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near" ||
              id.toLowerCase() ===
                "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near"
            ) {
              return [id, 1] as const;
            }
            const res = await fetch(
              `/api/wallet?action=price&token=${encodeURIComponent(id)}`,
              {
                method: "GET",
                headers: { Accept: "application/json" },
                cache: "no-store",
              }
            );
            if (!res.ok) return [id, NaN] as const;
            const data = await res.json().catch(() => null);
            const p = Number(data?.priceUsd);
            return [id, Number.isFinite(p) && p > 0 ? p : NaN] as const;
          })
        );
        const map: Record<string, number> = {};
        for (const [id, p] of entries) if (Number.isFinite(p)) map[id] = p;
        // Mirror NEAR if present
        if (map["wrap.near"] && nearUsd && !Number.isNaN(nearUsd)) {
          map["near"] = nearUsd;
        }
        setTokenPricesUsd(map);
      } catch {}
    })();
  }, [tokenHoldings, nearUsd]);

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
      <div className="h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] pb-24 relative overflow-y-auto">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
          <div className="absolute top-40 right-20 w-3 h-3 bg-purple-500 rounded-full animate-pulse delay-100" />
          <div className="absolute bottom-40 left-20 w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-200" />
        </div>

        <div
          className={`relative z-10 px-4 pt-6 space-y-6 ${
            activeFlow ? "pointer-events-none select-none blur-[1px]" : ""
          }`}
          aria-hidden={activeFlow ? "true" : undefined}
        >
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

          {/* Tabs */}
          <div className="mt-8 flex items-center gap-4">
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                activeTab === "assets"
                  ? "bg-blue-600 text-white"
                  : "bg-white/10 text-white/70"
              }`}
              onClick={() => setActiveTab("assets")}
            >
              Assets
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                activeTab === "txns"
                  ? "bg-blue-600 text-white"
                  : "bg-white/10 text-white/70"
              }`}
              onClick={() => setActiveTab("txns")}
            >
              Transactions
            </button>
          </div>

          {/* Assets tab (default) */}
          {activeTab === "assets" && (
            <div className="mt-6">
              <div
                className="rounded-3xl p-[2px]"
                style={{
                  background:
                    "linear-gradient(135deg, #00d4ff 0%, #9d4edd 50%, #7b2cbf 100%)",
                }}
              >
                <div className="bg-[#0f1535] rounded-3xl p-6 space-y-4">
                  <h2 className="text-xl font-bold text-white mb-2">Assets</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-white text-sm">
                      <thead className="text-white/70">
                        <tr>
                          <th className="py-2 pr-4">Token</th>
                          <th className="py-2 pr-4">Balance</th>
                          <th className="py-2 pr-4">Value (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-2 pr-4">NEAR</td>
                          <td className="py-2 pr-4">{nearBalance ?? "0"}</td>
                          <td className="py-2 pr-4">${usdBalance}</td>
                        </tr>
                        {tokenHoldings.map((t) => {
                          const idOrNear =
                            t.symbol === "NEAR" ? "wrap.near" : t.id;
                          const price =
                            t.symbol === "NEAR" && nearUsd
                              ? nearUsd
                              : tokenPricesUsd[idOrNear] || 0;
                          const balNum = Number(t.balance || 0);
                          const usd =
                            Number.isFinite(balNum) && price
                              ? balNum * price
                              : 0;
                          return (
                            <tr key={t.id}>
                              <td className="py-2 pr-4">{t.symbol}</td>
                              <td className="py-2 pr-4">{t.balance}</td>
                              <td className="py-2 pr-4">${usd.toFixed(4)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transactions tab */}
          {activeTab === "txns" && (
            <div className="mt-6">
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

                    {((showAllTxns ? allTxns : recentTxns) || []).length ===
                      0 && (
                      <div className="text-white/60 text-sm">
                        No transactions found.
                      </div>
                    )}
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
              {/* Close outer mt-6 wrapper */}
            </div>
          )}
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
