"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ArrowLeft, Copy, Plus, Search } from "lucide-react";
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

type SwapStep = "select" | "swap" | "confirm";

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
  const [amount, setAmount] = useState("0");
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
    console.log("fetchLiveQuote called with:", { amount, fromToken, toToken });
    if (!amount || Number(amount) <= 0) {
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
        setLiveQuote(null);
        return;
      }
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
      // Ignore stale responses if a newer request completed after this one
      if (requestId === lastRequestIdRef.current) {
        setLiveQuote(String(data?.expectedOut || "0"));
      }
    } catch (e) {
      console.warn("Live quote failed:", e);
      setLiveQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [amount, fromToken, toToken, resolveToken]);

  // Debounced quote fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLiveQuote();
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [fetchLiveQuote]);

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

      onSuccess();
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

  if (step === "swap") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] z-50 overflow-y-auto pb-20">
        <div className="max-w-md mx-auto min-h-screen pb-6">
          <div className="px-4 pt-6">
            <div className="flex items-center justify-between mb-8">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10 p-2"
                onClick={onClose}
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
                SWAP
              </h1>
              <div className="w-20" />
            </div>

            <div className="space-y-6 mt-12">
              <div
                className="rounded-3xl p-[2px]"
                style={{
                  background:
                    "linear-gradient(135deg, #00d4ff 0%, #9d4edd 100%)",
                }}
              >
                <div className="bg-[#0a0e27] rounded-3xl p-8 space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-white/70 text-sm">From token</div>
                      <button
                        type="button"
                        onClick={() =>
                          setShowFromCustomTokenInput(!showFromCustomTokenInput)
                        }
                        className="flex items-center gap-1 text-cyan-400 text-xs hover:text-cyan-300 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add Custom Token
                      </button>
                    </div>

                    {showFromCustomTokenInput && (
                      <div className="space-y-2 p-3 bg-[#0f1535] rounded-xl border border-white/10">
                        <div className="text-white/70 text-xs">
                          From Token Contract Address
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={fromCustomTokenAddress}
                            onChange={(e) =>
                              setFromCustomTokenAddress(e.target.value)
                            }
                            placeholder="e.g., token.near"
                            className="flex-1 bg-[#1a1f3a] text-white/90 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              fetchFromCustomToken(fromCustomTokenAddress)
                            }
                            disabled={
                              !fromCustomTokenAddress.trim() ||
                              fromCustomTokenLoading
                            }
                            className="px-3 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            {fromCustomTokenLoading ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Search className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {fromCustomTokenError && (
                          <div className="text-red-400 text-xs">
                            {fromCustomTokenError}
                          </div>
                        )}

                        {fromCustomTokenData && (
                          <div className="p-2 bg-green-900/20 border border-green-500/30 rounded-lg">
                            <div className="text-green-400 text-xs font-medium">
                              ✓ {fromCustomTokenData.token.symbol} -{" "}
                              {fromCustomTokenData.token.name}
                            </div>
                            <div className="text-white/60 text-xs mt-1">
                              Liquidity: $
                              {fromCustomTokenData.liquidity.usd.toFixed(2)} |
                              Price: $
                              {fromCustomTokenData.token.priceUsd.toFixed(6)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <select
                      value={fromToken}
                      onChange={(e) => setFromToken(e.target.value)}
                      className="w-full bg-[#1a1f3a] text-white/90 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {selectable.map((t) => {
                        const p = pricesUsd[t.symbol];
                        const priceText = p ? ` - $${p.toFixed(2)}` : "";
                        return (
                          <option key={t.symbol} value={t.symbol}>
                            {t.symbol} - {t.name}
                            {priceText}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="flex items-center justify-center">
                    <button
                      className="w-12 h-12 bg-[#1a1f3a] rounded-full flex items-center justify-center hover:bg-[#252a4a] transition-colors"
                      onClick={() => {
                        setFromToken(toToken);
                        setToToken(fromToken);
                      }}
                    >
                      <svg
                        className="w-6 h-6 text-cyan-500"
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
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-white/70 text-sm">To token</div>
                      <button
                        type="button"
                        onClick={() =>
                          setShowToCustomTokenInput(!showToCustomTokenInput)
                        }
                        className="flex items-center gap-1 text-cyan-400 text-xs hover:text-cyan-300 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add Custom Token
                      </button>
                    </div>

                    {showToCustomTokenInput && (
                      <div className="space-y-2 p-3 bg-[#0f1535] rounded-xl border border-white/10">
                        <div className="text-white/70 text-xs">
                          To Token Contract Address
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={toCustomTokenAddress}
                            onChange={(e) =>
                              setToCustomTokenAddress(e.target.value)
                            }
                            placeholder="e.g., token.near"
                            className="flex-1 bg-[#1a1f3a] text-white/90 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              fetchToCustomToken(toCustomTokenAddress)
                            }
                            disabled={
                              !toCustomTokenAddress.trim() ||
                              toCustomTokenLoading
                            }
                            className="px-3 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            {toCustomTokenLoading ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Search className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {toCustomTokenError && (
                          <div className="text-red-400 text-xs">
                            {toCustomTokenError}
                          </div>
                        )}

                        {toCustomTokenData && (
                          <div className="p-2 bg-green-900/20 border border-green-500/30 rounded-lg">
                            <div className="text-green-400 text-xs font-medium">
                              ✓ {toCustomTokenData.token.symbol} -{" "}
                              {toCustomTokenData.token.name}
                            </div>
                            <div className="text-white/60 text-xs mt-1">
                              Liquidity: $
                              {toCustomTokenData.liquidity.usd.toFixed(2)} |
                              Price: $
                              {toCustomTokenData.token.priceUsd.toFixed(6)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <select
                      value={toToken}
                      onChange={(e) => setToToken(e.target.value)}
                      className="w-full bg-[#1a1f3a] text-white/90 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {selectable
                        .filter((t) => t.symbol !== fromToken)
                        .map((t) => {
                          const p = pricesUsd[t.symbol];
                          const priceText = p ? ` - $${p.toFixed(2)}` : "";
                          return (
                            <option key={t.symbol} value={t.symbol}>
                              {t.symbol} - {t.name}
                              {priceText}
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-white/70 text-sm">Amount</div>
                      <div className="text-white/60 text-xs">
                        Bal: {getFromTokenBalance()} {fromToken}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[#1a1f3a] text-white/90 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={handleMax}
                        className="px-4 py-3 bg-[#1a1f3a] text-cyan-400 rounded-xl border border-white/10 hover:bg-[#252a4a]"
                      >
                        MAX
                      </button>
                    </div>
                    {liveQuote && Number(amount) > 0 && (
                      <div className="text-cyan-400 text-sm">
                        Estimated: {liveQuote} {toToken}
                        {(() => {
                          const p = pricesUsd[toToken];
                          if (!p) return null;
                          const usd = Number(liveQuote) * p;
                          if (!isFinite(usd)) return null;
                          return (
                            <span className="text-white/60 ml-2">
                              (~${usd.toFixed(2)})
                            </span>
                          );
                        })()}
                        {quoteLoading && <span className="ml-2">⏳</span>}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-white/70 text-sm">Slippage (%)</div>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={(slippageBps / 100).toString()}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value || 0));
                        setSlippageBps(Math.round(v * 100));
                      }}
                      className="w-full bg-[#1a1f3a] text-white/90 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep("confirm")}
                className="w-full py-4 bg-[#0075EA] text-white rounded-full text-lg font-bold hover:bg-cyan-600 transition-colors"
              >
                SWAP
              </button>
            </div>
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
    const verifierLabel = "Rhea Router";
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] z-50 overflow-y-auto">
        <div className="max-w-md mx-auto min-h-screen pb-6">
          <div className="px-4 pt-6">
            <div className="flex items-center justify-between mb-8">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10 p-2"
                onClick={() => setStep("swap")}
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
                SWAP
              </h1>
              <div className="w-20" />
            </div>

            <div className="space-y-6">
              <div className="text-white text-lg mb-4">Swap Transaction</div>

              <div className="bg-[#0a0e27] rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="text-white/70">From</div>
                  <div className="text-white font-semibold">
                    {amount || "0"} {fromToken}
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="w-10 h-10 bg-[#1a1f3a] rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-[#0075EA]"
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
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-white/70">To (min receive)</div>
                  <div className="text-white font-semibold">
                    {minReceiveNum.toString()} {toToken}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-white/70">Router</div>
                  <div className="text-white/60 text-sm font-mono truncate max-w-[55%] text-right">
                    {verifierLabel}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-sm">From token</div>
                  <div className="text-white text-sm">{fromMeta.symbol}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-sm">To token</div>
                  <div className="text-white text-sm">{toMeta.symbol}</div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-sm">Network fees</div>
                  <div className="text-white text-sm">
                    Gas + 1 yocto on transfers
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-white font-medium">You send</div>
                  <div className="text-white font-bold">
                    {amount || "0"} {fromToken}
                  </div>
                </div>
              </div>

              <button
                onClick={handleSwap}
                className="w-full py-4 bg-[#0075EA] text-white rounded-full text-lg font-bold hover:bg-cyan-600 transition-colors"
              >
                {submitting ? "SWAPPING..." : "CONFIRM"}
              </button>
              {error && (
                <div className="text-red-400 text-sm text-center mt-2">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SwapFlow;
