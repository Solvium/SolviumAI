"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { ChevronLeft, ArrowUp, Plus, DollarSign, RefreshCw, Sparkles, MessageCircle } from "lucide-react";
import { getAccountInfo, formatNearAmount } from "@/lib/nearblocks";
import { getAccountFull, formatYoctoToNear } from "@/lib/fastnear";
import { getNearUsd } from "@/lib/prices";
import { utils } from "near-api-js";
import SendFlow from "@/components/features/wallet/SendFlow";
import AddFlow from "@/components/features/wallet/AddFlow";
import SwapFlow from "@/components/features/wallet/SwapFlow";
import SuccessModal from "@/components/features/wallet/SuccessModal";
import AIChatAgent from "@/components/features/wallet/AIChatAgent";
import { useWalletPortfolioContext } from "@/contexts/WalletPortfolioContext";

type ActiveFlow = "send" | "add" | "swap" | "transaction" | null;

const WalletPage = () => {
  const {
    isConnected,
    isLoading,
    error,
    accountId,
    autoConnect,
    createWallet,
    account,
    unwrapNear,
  } = usePrivateKeyWallet();
  const [nearBalance, setNearBalance] = useState<string | null>(null);
  const [recentTxns, setRecentTxns] = useState<any[] | null>(null);
  const [allTxns, setAllTxns] = useState<any[] | null>(null);
  const [showAllTxns, setShowAllTxns] = useState(false);
  const [activeTab, setActiveTab] = useState<"assets" | "txns">("assets");
  const [nearUsd, setNearUsd] = useState<number | null>(null);
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const lastWalletFetchAtRef = useRef<number>(0);
  
  // AI Agent draggable state
  const [aiPosition, setAiPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, elementX: 0, elementY: 0 });
  const hasDraggedRef = useRef(false);
  const aiButtonRef = useRef<HTMLButtonElement>(null);
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

  // Auto-unwrap wrapped NEAR when received
  useEffect(() => {
    if (!portfolio?.tokens || !unwrapNear) return;

    const wrappedNearToken = portfolio.tokens.find(
      (t) => t.symbol === "WNEAR" || t.id === "wrap.near"
    );

    if (wrappedNearToken && parseFloat(wrappedNearToken.balance) > 0) {
      // Auto-unwrap wrapped NEAR
      handleUnwrapNear(wrappedNearToken.balance);
    }
  }, [portfolio?.tokens, unwrapNear]);

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
            // Native stablecoins (usdc.near, usdt.near) are safe to hardcode as $1
            if (id === "usdc.near" || id === "usdt.near") {
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

  // Calculate total portfolio value including all tokens
  const calculateTotalPortfolioValue = () => {
    let totalValue = 0;

    // Add NEAR balance value
    if (nearUsd && nearBalance && /^[0-9]+(\.[0-9]+)?$/.test(nearBalance)) {
      totalValue += Number(nearBalance) * nearUsd;
    }

    // Add all token holdings value
    if (tokenHoldings && tokenPricesUsd) {
      tokenHoldings.forEach((token) => {
        const tokenId = token.symbol === "NEAR" ? "near" : token.id;
        const price = tokenPricesUsd[tokenId];
        const balance = parseFloat(token.balance) || 0;

        if (price && !isNaN(price) && price > 0) {
          totalValue += balance * price;
        }
      });
    }

    return totalValue.toFixed(2);
  };

  const usdBalance = calculateTotalPortfolioValue();

  // Calculate individual NEAR USD value for the assets table
  const nearUsdValue =
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

  const handleUnwrapNear = async (balance: string) => {
    try {
      // Use NEAR API utils to properly convert to yoctoNEAR
      const amountYocto = utils.format.parseNearAmount(balance);
      if (!amountYocto) {
        throw new Error("Invalid amount format");
      }

      await unwrapNear(amountYocto);

      // Portfolio will automatically refresh when the transaction completes
      setShowSuccess(true);
    } catch (error) {
      console.error("Failed to unwrap NEAR:", error);
      // You could add a toast notification here
    }
  };

  // AI Agent drag handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    let currentX = aiPosition?.x || 0;
    let currentY = aiPosition?.y || 0;
    
    // If position hasn't been set yet, get the actual position from the DOM
    if (!aiPosition && aiButtonRef.current) {
      const rect = aiButtonRef.current.getBoundingClientRect();
      currentX = rect.left;
      currentY = rect.top;
    }
    
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      elementX: currentX,
      elementY: currentY,
    };
    
    hasDraggedRef.current = false;
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      
      // Mark as dragged if moved more than 5 pixels
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasDraggedRef.current = true;
      }
      
      setAiPosition({
        x: dragStartRef.current.elementX + deltaX,
        y: dragStartRef.current.elementY + deltaY,
      });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#0a0b2e] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-white text-lg">Connecting wallet...</div>
          {error && (
            <div className="text-red-400 text-sm">
              {error}
              <button
                onClick={() => autoConnect()}
                className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#0a0b2e] relative flex flex-col">
        {/* Fixed Header */}
        <div className="sticky top-0 z-50 bg-[#0a0b2e] border-b border-white/5">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => window.history.back()}
                className="text-white/80 hover:text-white flex items-center gap-1 text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs">Back</span>
              </button>
              <h1
                className="text-lg font-bold text-white tracking-[0.2em]"
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  textShadow: "0 0 15px rgba(99, 102, 241, 0.5)",
                }}
              >
                WALLET
              </h1>
              <div className="w-12" />
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4 pb-24">

            {/* Balance Card */}
            <div className="relative mb-4">
              <div
                className="rounded-2xl p-[2px]"
                style={{
                  background:
                    "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #6366f1 100%)",
                }}
              >
                <div className="bg-[#1a1d3f] rounded-2xl px-4  relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-white/70 text-sm font-medium">
                        Total balance
                      </div>
                      <div className="text-4xl font-bold text-white tracking-tight">
                        ${usdBalance}
                      </div>
                    </div>
                    <div className="relative w-36 h-36 -mr-16">
                      <img
                        src="/assets/wallet/mascot-robot.svg"
                        alt="Robot Mascot"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          // Fallback to inline SVG if image not found
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4 mb-5">
              <button
                onClick={() => setActiveFlow("send")}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <ArrowUp className="w-4 h-4 text-white" />
                </div>
                <span className="text-white text-[10px] font-medium">Send</span>
              </button>

              <button
                onClick={() => setActiveFlow("add")}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <span className="text-white text-[10px] font-medium">Add</span>
              </button>

              <button
                onClick={() => setActiveFlow("transaction")}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
                <span className="text-white text-[10px] font-medium">Transaction</span>
              </button>

              <button
                onClick={() => setActiveFlow("swap")}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <RefreshCw className="w-4 h-4 text-white" />
                </div>
                <span className="text-white text-[10px] font-medium">Swap</span>
              </button>
            </div>

            {/* Token List */}
            <div className="space-y-2.5">
              {/* NEAR Token */}
              <div
                className="rounded-xl p-[2px]"
                style={{
                  background:
                    "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #6366f1 100%)",
                }}
              >
                <div className="bg-[#1a1d3f] rounded-xl px-3 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                      <svg
                        width="20"
                        height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 2L2 7L12 12L22 7L12 2Z"
                        fill="white"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M2 17L12 22L22 17"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M2 12L12 17L22 12"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    </div>
                    <div>
                      <div className="text-white font-semibold text-xs">
                        NEAR
                      </div>
                      <div className="text-white/50 text-[10px]">
                        {nearBalance || "0.0000"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold text-sm">
                      ${nearUsdValue}
                    </div>
                    <div className="text-green-400 text-[10px] flex items-center justify-end gap-0.5">
                      <svg
                        width="10"
                        height="10"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6 9L6 3M6 3L3 6M6 3L9 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      </svg>
                      +4.3%
                    </div>
                  </div>
                </div>
              </div>

              {/* Other Tokens */}
              {tokenHoldings
                .filter((t) => {
                  const balance = parseFloat(t.balance || "0");
                  if (balance <= 0) return false;
                  const tokenId = t.id || "";
                  if (
                    tokenId.includes(".e") ||
                    tokenId.includes("factory.bridge.near")
                  ) {
                    return false;
                  }
                  return true;
                })
                .slice(0, 3)
                .map((t) => {
                  const idOrNear = t.symbol === "NEAR" ? "wrap.near" : t.id;
                  const price =
                    t.symbol === "NEAR" && nearUsd
                      ? nearUsd
                      : tokenPricesUsd[idOrNear] || 0;
                  const balNum = Number(t.balance || 0);
                  const usd =
                    Number.isFinite(balNum) && price ? balNum * price : 0;
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl p-[2px]"
                      style={{
                        background:
                          "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #6366f1 100%)",
                      }}
                    >
                      <div className="bg-[#1a1d3f] rounded-xl px-3 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-xs">
                              {t.symbol.slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <div className="text-white font-semibold text-xs">
                              {t.symbol.length > 8 ? `${t.symbol.slice(0, 8)}...` : t.symbol}
                            </div>
                            <div className="text-white/50 text-[10px]">
                              {t.balance}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-bold text-sm">
                            ${usd.toFixed(2)}
                          </div>
                          <div className="text-green-400 text-[10px] flex items-center justify-end gap-0.5">
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 12 12"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M6 9L6 3M6 3L3 6M6 3L9 6"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            +4.3%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* AI Insights Section */}
            <div className="mt-5 rounded-xl border border-white/10 bg-[#1a1d3f]/50 px-3 py-3 text-center">
              <div className="flex items-center justify-center mb-1.5">
                {/* <Sparkles className="w-4 h-4 text-blue-400" /> */}
              </div>
              <div className="text-white/60 text-[8px] font-medium mb-0.5">
                AI Insights Available
              </div>
              <div className="text-white/40 text-[8px]">
                Tap the AI assistant for personalized portfolio recommendations
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating AI Chat Button - Only show on main wallet page */}
      {!activeFlow && (
        <button
          ref={aiButtonRef}
          onClick={(e) => {
            if (!hasDraggedRef.current) {
              setIsChatOpen(!isChatOpen);
            }
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          className="fixed group cursor-move select-none"
          style={{ 
            zIndex: 9999,
            left: aiPosition ? `${aiPosition.x}px` : 'auto',
            top: aiPosition ? `${aiPosition.y}px` : 'auto',
            right: !aiPosition ? '4px' : 'auto',
            bottom: !aiPosition ? '128px' : 'auto',
            transition: isDragging ? 'none' : 'all 0.3s ease',
          }}
        >
        <div className="relative">
          {/* Notification Badge */}
          {/* <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-[#0a0b2e] flex items-center justify-center z-10">
            <span className="text-white text-[9px] font-bold">1</span>
          </div> */}

          {/* Main Button */}
          <div className={`w-24 h-24 rounded-full items-center justify-center shadow-2xl ${!isDragging && 'group-hover:scale-110'} transition-transform overflow-hidden`}>
            <img
              src="/ai/AI-Assistant.svg"
              alt="AI Assistant"
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
          </div>

          {/* Online Indicator */}
          {/* <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#0a0b2e]"></div> */}
        </div>

        {/* Tooltip */}
        {!isDragging && (
          <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-white rounded-2xl px-2.5 py-1.5 shadow-lg whitespace-nowrap">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-medium text-gray-900">
                  Hi! How can I help you?
                </span>
              </div>
              <div className="absolute bottom-0 right-3 transform translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-white"></div>
            </div>
          </div>
        )}
        </button>
      )}

      {/* Modals */}
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

      {/* AI Chat Agent */}
      <AIChatAgent isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  );
};

export default WalletPage;
