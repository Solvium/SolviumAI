"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ArrowLeft, Copy, Plus, Search, ArrowDownUp, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toRawAmount } from "@/lib/nearIntents";
// Quotes are now retrieved from server-side Ref SDK via /api/ref-quote
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { useWalletPortfolioContext } from "@/contexts/WalletPortfolioContext";
import {
  DEFAULT_TOKENS,
  getKnownTokenBySymbol,
  getWNEARAddress,
} from "@/lib/tokens";
// Removed Ref SDK config; using Rhea instead

interface SwapFlowProps {
  onClose: () => void;
  onSuccess: () => void;
}

type SwapStep = "swap" | "confirm" | "selectFromToken" | "selectToToken" | "confirmed";

const tokens = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    amount: "0.0000013",
    usd: "$29.56",
    color: "bg-orange-500",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    amount: "0.17",
    usd: "$234",
    color: "bg-purple-500",
  },
  {
    symbol: "BNB",
    name: "Binance",
    amount: "0.01745",
    usd: "$4.98",
    color: "bg-yellow-500",
  },
  {
    symbol: "MATIC",
    name: "Polygon",
    amount: "34.3",
    usd: "$30",
    color: "bg-purple-600",
  },
  {
    symbol: "XRP",
    name: "Ripple",
    amount: "3.00912",
    usd: "$30",
    color: "bg-green-500",
  },
];

const SwapFlow = ({ onClose, onSuccess }: SwapFlowProps) => {
  const { tokens: walletTokens, nearBalance } = useWalletPortfolioContext();
  const [step, setStep] = useState<SwapStep>("swap");
  const [fromToken, setFromToken] = useState("NEAR");
  const [toToken, setToToken] = useState("USDC"); // Native USDC - safe default
  const [slippageBps, setSlippageBps] = useState(200); // 2.00% - More protective default
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [quoteOut, setQuoteOut] = useState<string | null>(null);
  const [liveQuote, setLiveQuote] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Custom token input state - separate for From and To tokens
  const [showFromCustomTokenInput, setShowFromCustomTokenInput] =
    useState(false);
  const [fromCustomTokenAddress, setFromCustomTokenAddress] = useState("");
  const [fromCustomTokenLoading, setFromCustomTokenLoading] = useState(false);
  const [fromCustomTokenError, setFromCustomTokenError] = useState<
    string | null
  >(null);
  const [fromCustomTokenData, setFromCustomTokenData] = useState<any>(null);

  const [showToCustomTokenInput, setShowToCustomTokenInput] = useState(false);
  const [toCustomTokenAddress, setToCustomTokenAddress] = useState("");
  const [toCustomTokenLoading, setToCustomTokenLoading] = useState(false);
  const [toCustomTokenError, setToCustomTokenError] = useState<string | null>(
    null
  );
  const [toCustomTokenData, setToCustomTokenData] = useState<any>(null);

  // Simple USD price map for display
  const [pricesUsd, setPricesUsd] = useState<Record<string, number>>({});
  // prices are fetched later once `selectable` is computed

  // Balance helpers and MAX handler
  const getFromTokenBalance = useCallback((): string => {
    if (fromToken === "NEAR") return nearBalance || "0";
    const t = (walletTokens || []).find(
      (x) => String(x.symbol).toUpperCase() === String(fromToken).toUpperCase()
    );
    return t?.balance || "0";
  }, [fromToken, walletTokens, nearBalance]);

  const handleMax = useCallback(() => {
    const balStr = getFromTokenBalance();
    const bal = Number(balStr || 0);
    if (!isFinite(bal) || bal <= 0) return;
    if (fromToken === "NEAR") {
      const safe = Math.max(0, bal - 0.02);
      setAmount(safe > 0 ? safe.toFixed(5) : "0");
    } else {
      setAmount(bal.toString());
    }
  }, [fromToken, getFromTokenBalance]);

  // Fetch custom token data from DexScreener - separate functions for From and To
  const fetchFromCustomToken = useCallback(async (address: string) => {
    if (!address.trim()) return;

    setFromCustomTokenLoading(true);
    setFromCustomTokenError(null);

    try {
      const response = await fetch(
        `/api/token-info?address=${encodeURIComponent(address.trim())}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch token data");
      }

      setFromCustomTokenData(data);
      console.log("From custom token data:", data);
    } catch (error) {
      console.error("Error fetching from custom token:", error);
      setFromCustomTokenError(
        error instanceof Error ? error.message : "Failed to fetch token data"
      );
      setFromCustomTokenData(null);
    } finally {
      setFromCustomTokenLoading(false);
    }
  }, []);

  const fetchToCustomToken = useCallback(async (address: string) => {
    if (!address.trim()) return;

    setToCustomTokenLoading(true);
    setToCustomTokenError(null);

    try {
      const response = await fetch(
        `/api/token-info?address=${encodeURIComponent(address.trim())}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch token data");
      }

      setToCustomTokenData(data);
      console.log("To custom token data:", data);
    } catch (error) {
      console.error("Error fetching to custom token:", error);
      setToCustomTokenError(
        error instanceof Error ? error.message : "Failed to fetch token data"
      );
      setToCustomTokenData(null);
    } finally {
      setToCustomTokenLoading(false);
    }
  }, []);

  // Convert raw integer token amount to human string
  const fromRawAmount = useCallback((raw: string, decimals: number) => {
    if (!raw) return "0";
    if (decimals <= 0) return raw;
    const negative = raw.startsWith("-");
    const digits = negative ? raw.slice(1) : raw;
    const len = digits.length;
    const intPart = len > decimals ? digits.slice(0, len - decimals) : "0";
    const fracPart = digits.padStart(decimals + 1, "0").slice(-decimals);
    const trimmed = fracPart.replace(/0+$/, "");
    const result = trimmed ? `${intPart}.${trimmed}` : intPart;
    return negative ? `-${result}` : result;
  }, []);

  // Build selectable tokens early: wallet tokens first, include defaults, hide WNEAR
  const selectable = useMemo(() => {
    const walletKnown = Array.isArray(walletTokens)
      ? walletTokens
          .filter((t) => !!t?.id && !!t?.symbol)
          .filter((t) => {
            // Hide tokens with zero balance
            const balance = parseFloat(t.balance || "0");
            if (balance <= 0) return false;

            // Hide any bridged tokens (.e tokens or factory.bridge.near)
            const tokenId = t.id || "";
            if (
              tokenId.includes(".e") ||
              tokenId.includes("factory.bridge.near")
            ) {
              return false;
            }

            return true;
          })
          .map((t) => ({
            symbol: String(t.symbol).toUpperCase(),
            name: String(t.symbol).toUpperCase(),
            kind: "ft" as const,
            address: t.id,
            decimals: t.decimals,
          }))
      : [];
    const mergedBySymbol = new Map<string, any>();
    for (const tk of walletKnown) {
      if (tk.symbol !== "WNEAR") mergedBySymbol.set(tk.symbol, tk);
    }
    for (const tk of DEFAULT_TOKENS) {
      if (tk.symbol !== "WNEAR" && !mergedBySymbol.has(tk.symbol)) {
        mergedBySymbol.set(tk.symbol, tk);
      }
    }

    // Add custom tokens if available
    if (fromCustomTokenData?.token) {
      const customToken = {
        symbol: fromCustomTokenData.token.symbol,
        name: fromCustomTokenData.token.name,
        kind: "ft" as const,
        address: fromCustomTokenData.token.address,
        decimals: fromCustomTokenData.token.decimals || 18,
      };
      mergedBySymbol.set(customToken.symbol, customToken);
    }

    if (toCustomTokenData?.token) {
      const customToken = {
        symbol: toCustomTokenData.token.symbol,
        name: toCustomTokenData.token.name,
        kind: "ft" as const,
        address: toCustomTokenData.token.address,
        decimals: toCustomTokenData.token.decimals || 18,
      };
      mergedBySymbol.set(customToken.symbol, customToken);
    }

    return Array.from(mergedBySymbol.values());
  }, [walletTokens, fromCustomTokenData, toCustomTokenData]);

  // Fetch token prices after selectable is ready
  useEffect(() => {
    (async () => {
      try {
        if (!Array.isArray(selectable) || selectable.length === 0) return;
        const entries = await Promise.all(
          selectable.map(async (t) => {
            // Native stablecoins (usdc.near, usdt.near) are safe to hardcode as $1
            if (t.symbol === "USDC" || t.symbol === "USDT") {
              return [t.symbol, 1] as const;
            }
            const tokenId = t.symbol === "NEAR" ? "wrap.near" : t.address;
            if (!tokenId) return [t.symbol, NaN] as const;
            const res = await fetch(
              `/api/wallet?action=price&token=${encodeURIComponent(tokenId)}`,
              {
                method: "GET",
                headers: { Accept: "application/json" },
                cache: "no-store",
              }
            );
            if (!res.ok) return [t.symbol, NaN] as const;
            const data = await res.json().catch(() => null);
            const p = Number(data?.priceUsd);
            return [t.symbol, Number.isFinite(p) && p > 0 ? p : NaN] as const;
          })
        );
        const map: Record<string, number> = {};
        for (const [sym, p] of entries) if (Number.isFinite(p)) map[sym] = p;
        if (map.WNEAR && !map.NEAR) map.NEAR = map.WNEAR;
        if (map.NEAR && !map.WNEAR) map.WNEAR = map.NEAR;
        setPricesUsd(map);
      } catch {}
    })();
  }, [selectable]);

  const resolveToken = useCallback(
    (symbol: string) =>
      selectable.find(
        (t) => t.symbol.toLowerCase() === String(symbol).toLowerCase()
      ) ||
      getKnownTokenBySymbol(symbol) ||
      DEFAULT_TOKENS[0],
    [selectable]
  );

  // Keep a monotonically increasing request id to ignore stale responses
  const lastRequestIdRef = useRef(0);
  let inFlightController: AbortController | null = null;

  // Real-time quote fetching (server-side Ref SDK)
  const fetchLiveQuote = useCallback(async () => {
    console.log("🔄 fetchLiveQuote called with:", { amount, fromToken, toToken });
    if (!amount || Number(amount) <= 0) {
      console.log("❌ No amount or invalid amount");
      setLiveQuote(null);
      return;
    }

    try {
      setQuoteLoading(true);
      const fromMeta = resolveToken(fromToken);
      const toMeta = resolveToken(toToken);
      const isFromNear = fromMeta.symbol === "NEAR";
      const isToNear = toMeta.symbol === "NEAR";
      const wnearAddr = getWNEARAddress();
      const tokenInId = isFromNear ? wnearAddr : fromMeta.address || "";
      const tokenOutId = isToNear ? wnearAddr : toMeta.address || "";

      if (!tokenInId || !tokenOutId || tokenInId === tokenOutId) {
        console.log("❌ Invalid token IDs:", { tokenInId, tokenOutId });
        setLiveQuote(null);
        return;
      }
      console.log("✅ Fetching quote for:", { tokenInId, tokenOutId, amount });
      // Abort any previous in-flight request
      try {
        inFlightController?.abort();
      } catch {}
      const controller = new AbortController();
      inFlightController = controller;
      const requestId = ++lastRequestIdRef.current;

      const res = await fetch("/api/ref-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenInId,
          tokenOutId,
          amountInHuman: amount,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("quote_failed");
      const data = await res.json();
      console.log("📊 Quote response:", data);
      // Ignore stale responses if a newer request completed after this one
      if (requestId === lastRequestIdRef.current) {
        const quote = String(data?.expectedOut || "0");
        console.log("✅ Setting live quote:", quote);
        setLiveQuote(quote);
      } else {
        console.log("⏭️ Ignoring stale response");
      }
    } catch (e) {
      console.error("❌ Live quote failed:", e);
      setLiveQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [amount, fromToken, toToken, resolveToken]);

  // Debounced quote fetching
  useEffect(() => {
    console.log("⏱️ Debounce effect triggered for:", { amount, fromToken, toToken });
    const timer = setTimeout(() => {
      fetchLiveQuote();
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [amount, fromToken, toToken, fetchLiveQuote]);
  
  // Reset quote when tokens change
  useEffect(() => {
    console.log("🔄 Tokens changed, resetting quote");
    setLiveQuote(null);
  }, [fromToken, toToken]);

  // Ensure confirm screen has a backend quote ready for min receive display
  useEffect(() => {
    (async () => {
      if (step !== "confirm") return;
      const fromMeta = resolveToken(fromToken);
      const toMeta = resolveToken(toToken);
      const isFromNear = fromMeta.symbol === "NEAR";
      const isToNear = toMeta.symbol === "NEAR";
      const wnearAddr = getWNEARAddress();
      const tokenInId = isFromNear ? wnearAddr : fromMeta.address || "";
      const tokenOutId = isToNear ? wnearAddr : toMeta.address || "";
      if (
        !amount ||
        Number(amount) <= 0 ||
        !tokenInId ||
        !tokenOutId ||
        tokenInId === tokenInId // placeholder, kept structure consistent
      )
        return;
      // Reuse latest live quote if present for same inputs
      if (liveQuote && Number(liveQuote) > 0) {
        setQuoteOut(liveQuote);
        return;
      }
      try {
        const res = await fetch("/api/ref-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tokenInId,
            tokenOutId,
            amountInHuman: amount,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.expectedOut) setQuoteOut(String(data.expectedOut));
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, amount, fromToken, toToken, resolveToken, liveQuote]);

  const {
    accountId,
    wrapNear,
    unwrapNear,
    registerToken,
    registerTokenFor,
    checkTokenRegistration,
    checkTokenRegistrationFor,
    signAndSendTransaction,
  } = usePrivateKeyWallet();

  const [error, setError] = useState<string | null>(null);

  const handleSwap = async () => {
    setError(null);
    if (!accountId) {
      setError("Wallet not connected");
      return;
    }
    // Resolve tokens
    const fromMeta = resolveToken(fromToken);
    const toMeta = resolveToken(toToken);
    const isFromNear = fromMeta.symbol === "NEAR";
    const isToNear = toMeta.symbol === "NEAR";
    const wnearAddr = getWNEARAddress();
    const tokenInId = isFromNear ? wnearAddr : fromMeta.address || "";
    const tokenOutId = isToNear ? wnearAddr : toMeta.address || "";

    if (!tokenInId || !tokenOutId || tokenInId === tokenOutId) {
      setError("Select two different tokens");
      return;
    }

    // WARNING: Check for problematic bridged tokens that have liquidity issues
    const problematicBridgedTokens = [
      "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near", // Old bridged USDC
      "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near", // Old bridged USDT
    ];

    // Also check for any .e tokens (bridged versions)
    const isBridgedToken = (tokenId: string) => {
      return (
        problematicBridgedTokens.includes(tokenId) ||
        tokenId.includes(".e") ||
        tokenId.includes("factory.bridge.near")
      );
    };

    if (isBridgedToken(tokenInId) || isBridgedToken(tokenOutId)) {
      setError(
        "⚠️ WARNING: Bridged tokens detected! These have liquidity issues and may cause fund loss. Please use native NEAR tokens (usdc.near, usdt.near) only."
      );
      return;
    }

    // Validate custom token liquidity if using custom tokens
    if (
      fromCustomTokenData &&
      tokenInId === fromCustomTokenData.token.address
    ) {
      if (fromCustomTokenData.liquidity.usd < 1000) {
        setError(
          `⚠️ WARNING: From token has insufficient liquidity ($${fromCustomTokenData.liquidity.usd.toFixed(
            2
          )}). Minimum $1000 required for safe trading.`
        );
        return;
      }
    }

    if (toCustomTokenData && tokenOutId === toCustomTokenData.token.address) {
      if (toCustomTokenData.liquidity.usd < 1000) {
        setError(
          `⚠️ WARNING: To token has insufficient liquidity ($${toCustomTokenData.liquidity.usd.toFixed(
            2
          )}). Minimum $1000 required for safe trading.`
        );
        return;
      }
    }

    // Validate slippage settings
    if (slippageBps < 10) {
      setError(
        "⚠️ Slippage too low! Minimum 0.1% required to prevent transaction failures."
      );
      return;
    }
    if (slippageBps > 1000) {
      setError(
        "⚠️ Slippage too high! Maximum 10% allowed to prevent excessive losses."
      );
      return;
    }

    try {
      setSubmitting(true);
      // Refresh backend quote for accurate confirm display
      try {
        const q = await fetch("/api/ref-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tokenInId,
            tokenOutId,
            amountInHuman: amount,
          }),
        });
        if (q.ok) {
          const j = await q.json();
          if (j?.expectedOut) setQuoteOut(String(j.expectedOut));
        }
      } catch {}
      // Build transactions on the server to avoid CSP and SDK env issues
      const res = await fetch("/api/ref-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenInId,
          tokenOutId,
          amountInHuman: amount,
          slippageBps,
          accountId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err?.message || "Failed to build swap transactions");
      }
      const { txs } = await res.json();

      // Ensure storage and wrapping before sending
      // Register output token for user (so we can receive it)
      if (tokenOutId !== wnearAddr) {
        try {
          const isRegistered = await checkTokenRegistration(tokenOutId);
          if (!isRegistered) {
            console.log(`Registering storage for output token: ${tokenOutId}`);
            const registrationResult = await registerToken(tokenOutId);
            if (!registrationResult) {
              throw new Error(
                `Failed to register storage for output token: ${tokenOutId}`
              );
            }
            // Verify registration was successful
            const isNowRegistered = await checkTokenRegistration(tokenOutId);
            if (!isNowRegistered) {
              throw new Error(
                `Storage registration verification failed for output token: ${tokenOutId}`
              );
            }
            console.log(
              `Successfully registered storage for output token: ${tokenOutId}`
            );
          }
        } catch (error) {
          console.error("Output token storage registration failed:", error);
          throw new Error(
            `Failed to register storage for output token: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      // Register receiver (Ref contract) on input token contract
      try {
        const firstFc = txs?.[0]?.functionCalls?.[0];
        const refReceiver: string | undefined = firstFc?.args?.receiver_id;
        if (refReceiver && tokenInId !== wnearAddr) {
          console.log(
            `Checking storage registration for Ref contract on input token: ${tokenInId}`
          );
          const isRefRegistered = await checkTokenRegistrationFor(
            tokenInId,
            refReceiver
          );
          if (!isRefRegistered) {
            console.log(
              `Registering storage for Ref contract on input token: ${tokenInId}`
            );
            const refRegistrationResult = await registerTokenFor(
              tokenInId,
              refReceiver
            );
            if (!refRegistrationResult) {
              throw new Error(
                `Failed to register storage for Ref contract on input token: ${tokenInId}`
              );
            }
            console.log(
              `Successfully registered storage for Ref contract on input token: ${tokenInId}`
            );
          }
        }
      } catch (error) {
        console.error("Ref contract storage registration failed:", error);
        throw new Error(
          `Failed to register storage for Ref contract: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
      // Wrap NEAR to wNEAR if needed
      if (isFromNear) {
        try {
          console.log("Wrapping NEAR to wNEAR...");
          const raw = toRawAmount(amount, 24);
          const wrapResult = await wrapNear(raw);
          console.log("NEAR wrapping result:", wrapResult);
        } catch (error) {
          console.error("Failed to wrap NEAR:", error);
          throw new Error(
            `Failed to wrap NEAR: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      // Execute swap transactions with proper error handling
      console.log(`Executing ${txs.length} swap transactions...`);
      for (let i = 0; i < txs.length; i++) {
        const tx = txs[i];
        try {
          console.log(
            `Executing transaction ${i + 1}/${txs.length} to ${tx.receiverId}`
          );

          const normalizeYocto = (v?: string) => {
            if (!v) return "0";
            return v.includes(".") ? toRawAmount(v, 24) : v;
          };

          const actions = Array.isArray(tx.functionCalls)
            ? tx.functionCalls.map((fc: any) => ({
                type: "FunctionCall",
                params: {
                  methodName: fc.methodName,
                  args: fc.args,
                  gas: fc.gas || "300000000000000", // Increased gas limit
                  deposit: normalizeYocto(fc.amount || fc.deposit || "0"),
                },
              }))
            : [];

          console.log(`Transaction ${i + 1} actions:`, actions);

          // Add timeout to prevent hanging
          const txPromise = signAndSendTransaction(
            tx.receiverId,
            actions as any
          );
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Transaction timeout after 60 seconds")),
              60000
            )
          );

          const txResult = await Promise.race([txPromise, timeoutPromise]);
          console.log(`Transaction ${i + 1} result:`, txResult);
        } catch (error) {
          console.error(`Transaction ${i + 1} failed:`, error);
          throw new Error(
            `Transaction ${i + 1} failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      // Optionally unwrap if receiving NEAR
      if (isToNear) {
        try {
          console.log("Unwrapping wNEAR to NEAR...");
          const raw = toRawAmount(String(quoteOut || liveQuote || "0"), 24);
          const unwrapResult = await unwrapNear(raw);
          console.log("NEAR unwrapping result:", unwrapResult);
        } catch (error) {
          console.error("Failed to unwrap wNEAR:", error);
          throw new Error(
            `Failed to unwrap wNEAR: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      setStep("confirmed");
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (e: any) {
      console.error("Swap failed", e);
      const msg = typeof e?.message === "string" ? e.message : String(e);
      setError(
        msg.includes("doesn't have enough balance")
          ? "Insufficient balance for this swap"
          : msg
      );
    } finally {
      setSubmitting(false);
    }
  };

  // selectable already built above

  // Token selection modal (reused for both from and to)
  if (step === "selectFromToken" || step === "selectToToken") {
    const isFromToken = step === "selectFromToken";
    return (
      <>
        {/* Background */}
        <div 
          className="fixed inset-0 bg-[#0a0b2e] z-50 flex flex-col cursor-pointer"
          onClick={() => setStep("swap")}
        >
          <div className="px-4 py-4 border-b border-white/5 flex items-center gap-3">
            <button onClick={onClose} className="text-white flex items-center gap-1">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">Back</span>
            </button>
            <h1
              className="text-xl font-bold text-white tracking-[0.2em] flex-1 text-center"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                textShadow: "0 0 15px rgba(99, 102, 241, 0.5)",
              }}
            >
              SWAP
            </h1>
            <div className="w-16"></div>
          </div>
        </div>

        {/* Token Selection Modal */}
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 pb-20">
          <div 
            className="bg-[#0a0b2e] w-[95%] max-w-md mx-auto rounded-t-2xl flex flex-col max-h-[60vh] mb-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full h-1 bg-white/10 rounded-t-2xl overflow-hidden">
              <div className="h-full w-1/3 bg-white"></div>
            </div>

            <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-white text-sm font-medium">Select Token</h2>
              <button
                onClick={() => setStep("swap")}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="px-3 pt-2.5 pb-3 space-y-2.5">
                <div>
                  <div className="text-white text-[10px] mb-1.5">Search</div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search token"
                      className="w-full bg-[#1a1d3f] text-white/60 rounded-lg px-3 py-1.5 pr-9 outline-none text-xs border border-white/10"
                    />
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="space-y-1">
                  {selectable.map((t) => {
                    const balance = t.symbol === "NEAR" ? nearBalance : 
                      (walletTokens || []).find(wt => wt.symbol === t.symbol)?.balance || "0";
                    const numericBal = parseFloat(balance || "0");
                    const price = pricesUsd[t.symbol] || 0;
                    const usdValue = (numericBal * price).toFixed(2);
                    
                    return (
                      <button
                        key={t.symbol}
                        onClick={() => {
                          if (isFromToken) {
                            setFromToken(t.symbol);
                          } else {
                            setToToken(t.symbol);
                          }
                          setStep("swap");
                        }}
                        className="w-full flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-[10px]">
                              {t.symbol.slice(0, 2)}
                            </span>
                          </div>
                          <div className="text-left">
                            <div className="text-white font-semibold text-xs">
                              {t.symbol}
                            </div>
                            <div className="text-white/50 text-[9px]">
                              {t.name}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-bold text-[10px]">
                            {numericBal.toFixed(4)}
                          </div>
                          <div className="text-white/50 text-[9px]">
                            (${usdValue})
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (step === "swap") {
    const fromMeta = resolveToken(fromToken);
    const toMeta = resolveToken(toToken);
    const fromBalance = getFromTokenBalance();
    const toBalance = toToken === "NEAR" ? nearBalance : 
      (walletTokens || []).find(wt => wt.symbol === toToken)?.balance || "0";
    
    return (
      <div className="fixed inset-0 bg-[#0a0b2e] z-50 flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 flex items-center gap-3">
          <button onClick={onClose} className="text-white flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
          <h1
            className="text-xl font-bold text-white tracking-[0.2em] flex-1 text-center"
            style={{
              fontFamily: "'Press Start 2P', monospace",
              textShadow: "0 0 15px rgba(99, 102, 241, 0.5)",
            }}
          >
            SWAP
          </h1>
          <div className="w-16"></div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pt-6 pb-28">
          <div className="relative max-w-md mx-auto">
            {/* You Pay Container */}
            <div className="bg-[#1a1d3f]/40 rounded-2xl p-4 mb-3">
              <div className="text-white text-xs mb-2 font-medium">You Pay</div>
              <div className="flex items-center justify-between mb-1.5">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="text-white text-2xl font-light bg-transparent outline-none w-20"
                />
                <button
                  onClick={() => setStep("selectFromToken")}
                  className="flex items-center gap-1.5"
                >
                  <div className="w-5 h-5 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full"></div>
                  <span className="text-white font-medium text-sm">{fromToken}</span>
                  <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className="text-white/60 text-xs">
                Balance: {parseFloat(fromBalance).toFixed(2)} {fromToken}
              </div>
            </div>

            {/* Swap Button - Positioned between containers */}
            <div className="flex justify-center -my-6 relative z-10">
              <button
                onClick={() => {
                  const temp = fromToken;
                  setFromToken(toToken);
                  setToToken(temp);
                }}
                className="w-12 h-12 bg-[#1a1d3f] border-2 border-white/20 rounded-full flex items-center justify-center hover:border-white/40 transition-colors"
              >
                <ArrowDownUp className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* You Receive Container */}
            <div className="bg-[#1a1d3f]/40 rounded-2xl p-4 mt-3">
              <div className="text-white text-xs mb-2 font-medium">You Receive</div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-white text-2xl font-light">
                  {liveQuote && Number(amount) > 0 ? parseFloat(liveQuote).toFixed(1) : "0.0"}
                  {quoteLoading && <span className="text-xs ml-2">...</span>}
                </div>
                <button
                  onClick={() => setStep("selectToToken")}
                  className="flex items-center gap-1.5"
                >
                  <div className="w-5 h-5 bg-gradient-to-br from-pink-400 to-red-500 rounded-full"></div>
                  <span className="text-white font-medium text-sm">{toToken}</span>
                  <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className="text-white/60 text-xs">
                Balance: {parseFloat(toBalance || "0").toFixed(2)} {toToken}
              </div>
            </div>

            {/* Swap Button */}
            <button
              onClick={() => setStep("confirm")}
              disabled={!amount || Number(amount) <= 0 || !liveQuote}
              className="w-full py-3.5 bg-[#0ea5e9] text-white rounded-2xl text-base font-bold hover:bg-[#0284c7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed tracking-wider shadow-lg shadow-blue-500/20 mt-6"
            >
              SWAP
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    const fromMeta = resolveToken(fromToken);
    const toMeta = resolveToken(toToken);
    const amountNum = Number(amount || 0) || 0;
    const basisQuote = quoteOut ?? liveQuote;
    const minReceiveNum = basisQuote
      ? Number(basisQuote) * (1 - (slippageBps || 0) / 10000)
      : Math.max(0, amountNum * (1 - (slippageBps || 0) / 10000));
    const fromPrice = pricesUsd[fromToken] || 0;
    const toPrice = pricesUsd[toToken] || 0;
    const fromUsd = (amountNum * fromPrice).toFixed(5);
    const toUsd = (minReceiveNum * toPrice).toFixed(2);
    
    return (
      <div className="fixed inset-0 bg-[#0a0b2e] z-50 flex flex-col">
        {/* Header */}
        <div className="px-3 py-3 border-b border-white/5">
          <div className="text-white text-sm font-medium text-center">Swap Transaction</div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 py-4 pb-24 space-y-4">
          {/* Swap Visual */}
          <div className="flex items-center justify-between">
            {/* From Token */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xs">{fromToken.slice(0, 2)}</span>
              </div>
              <div className="text-center">
                <div className="text-white font-semibold text-xs">{amountNum.toFixed(4)} {fromToken.toLowerCase()}</div>
                <div className="text-white/50 text-[10px]">${fromUsd}</div>
              </div>
            </div>

            {/* Swap Icon */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 bg-[#1a1d3f] rounded-full flex items-center justify-center">
                <ArrowDownUp className="w-4 h-4 text-[#0075EA]" />
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3.5 h-3.5 bg-gradient-to-br from-purple-400 to-purple-600 rounded-sm flex items-center justify-center">
                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* To Token */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-red-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xs">{toToken.slice(0, 2)}</span>
              </div>
              <div className="text-center">
                <div className="text-white font-semibold text-xs">{minReceiveNum.toFixed(4)} {toToken}</div>
                <div className="text-white/50 text-[10px]">${toUsd}</div>
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1.5">
              <div className="text-white/60 text-xs">From:</div>
              <div className="text-white/80 text-[10px] font-mono truncate max-w-[55%]">
                {accountId}
              </div>
              <button className="text-[#0075EA]">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <div className="text-white/60 text-xs">To:</div>
              <div className="text-white/80 text-[10px] font-mono truncate max-w-[55%]">
                {accountId}
              </div>
              <button className="text-[#0075EA]">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-white/60 text-xs">Network fees</div>
              <div className="text-white text-xs">0.004BTC</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-white/60 text-xs">Total</div>
              <div className="text-white font-bold text-xs">0.1320BTC</div>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-2.5 h-2.5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="text-blue-300 text-[10px]">Please double check recipient address</div>
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleSwap}
            disabled={submitting}
            className="w-full py-3 bg-[#0075EA] text-white rounded-2xl text-sm font-bold hover:bg-cyan-600 transition-colors disabled:opacity-50"
          >
            {submitting ? "SWAPPING..." : "CONFIRM"}
          </button>
        </div>

        {/* Error Modal */}
        {error && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-[#1a1d3f] rounded-2xl p-6 w-[90%] max-w-sm overflow-hidden">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <X className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-base mb-1 break-words">Transaction Error</h3>
                  <p className="text-white/70 text-sm break-words">{error}</p>
                </div>
              </div>
              <button
                onClick={() => setError(null)}
                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Confirmed Modal
  if (step === "confirmed") {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
        <div className="bg-[#1a1d3f] rounded-2xl p-6 w-[90%] max-w-sm relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="text-center space-y-4">
            <h2 className="text-white text-xl font-semibold">Transaction Confirmed</h2>
            <div className="w-20 h-20 mx-auto rounded-full border-4 border-[#0075EA] flex items-center justify-center">
              <Check className="w-10 h-10 text-[#0075EA]" />
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 bg-[#0075EA] hover:bg-cyan-600 text-white rounded-2xl text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SwapFlow;
