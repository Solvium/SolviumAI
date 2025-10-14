"use client";

import { useState } from "react";
import { ArrowLeft, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildTokenDiff, toRawAmount } from "@/lib/nearIntents";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { DEFAULT_TOKENS, getKnownTokenBySymbol } from "@/lib/tokens";

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
  const [step, setStep] = useState<SwapStep>("swap");
  const [fromToken, setFromToken] = useState("NEAR");
  const [toToken, setToToken] = useState("USDC");
  const [slippageBps, setSlippageBps] = useState(50); // 0.50%
  const [amount, setAmount] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const {
    accountId,
    depositInto,
    executeIntents,
    wrapNear,
    unwrapNear,
    registerToken,
    registerTokenFor,
    simulateIntents,
  } = usePrivateKeyWallet();
  const verifierId = process.env.NEXT_PUBLIC_NEAR_INTENTS_VERIFIER || "";

  const [error, setError] = useState<string | null>(null);

  const handleSwap = async () => {
    setError(null);
    if (!accountId) {
      setError("Wallet not connected");
      return;
    }
    if (!verifierId) {
      console.error(
        "Verifier not configured (NEXT_PUBLIC_NEAR_INTENTS_VERIFIER)"
      );
      setError("Verifier not configured");
      return;
    }
    // Resolve tokens
    const fromMeta = getKnownTokenBySymbol(fromToken) || DEFAULT_TOKENS[0];
    const toMeta = getKnownTokenBySymbol(toToken) || DEFAULT_TOKENS[0];
    const isFromNear = fromMeta.symbol === "NEAR";
    const isToNear = toMeta.symbol === "NEAR";
    const tokenInAddr = isFromNear ? "wrap.near" : fromMeta.address || "";
    const tokenOutAddr = isToNear ? "wrap.near" : toMeta.address || "";
    const decimalsIn = (isFromNear ? 24 : fromMeta.decimals) ?? 24;
    const decimalsOut = (isToNear ? 24 : toMeta.decimals) ?? 24;

    if (!tokenInAddr || !tokenOutAddr) {
      console.error("Missing token contract address for swap");
      setError("Missing token contract address");
      return;
    }

    const rawIn = toRawAmount(amount, decimalsIn);
    // Apply slippage to compute min receive for the intent
    const amountNum = Number(amount || 0) || 0;
    const minOutHuman = Math.max(
      0,
      amountNum * (1 - (slippageBps || 0) / 10000)
    );
    const minOutFinalRaw = toRawAmount(String(minOutHuman), decimalsOut);

    try {
      setSubmitting(true);
      // Ensure storage (skip for wrap.near which doesn't require FT storage for near_deposit)
      if (tokenInAddr !== "wrap.near") {
        try {
          await registerTokenFor(tokenInAddr, verifierId);
        } catch {}
      }
      if (tokenOutAddr !== "wrap.near") {
        try {
          await registerToken(tokenOutAddr);
        } catch {}
      }

      // 0) Wrap if sending NEAR (convert to WNEAR first)
      if (isFromNear) {
        await wrapNear(rawIn);
      }
      // 1) Deposit input tokens (tokenInAddr) to verifier
      await depositInto(tokenInAddr, verifierId, rawIn);
      // 2) Build intents (multi-leg example; use one or many legs as needed)
      const intents = [
        buildTokenDiff(
          tokenInAddr,
          rawIn,
          tokenOutAddr,
          minOutFinalRaw,
          5 * 60 * 1000
        ),
      ];
      // 2.5) Simulate and log response
      try {
        const sim = await simulateIntents(verifierId, {
          intents,
          beneficiary: accountId,
        });
        console.log("simulate_intents response:", sim);
      } catch (e: any) {
        const msg = typeof e?.message === "string" ? e.message : String(e);
        // Some verifiers require signed payloads for simulation; skip hard error
        if (msg.includes("missing field `signed")) {
          console.info(
            "simulate_intents requires signed payload; skipping simulation"
          );
        } else {
          console.warn("simulate_intents failed:", e);
        }
      }
      // 3) Execute intents
      await executeIntents(verifierId, { intents, beneficiary: accountId });
      // 4) Unwrap if receiving NEAR (convert from WNEAR)
      if (isToNear) {
        try {
          await unwrapNear(minOutFinalRaw);
        } catch (e) {
          console.warn("Unwrap NEAR failed (will remain WNEAR):", e);
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

  const selectable = DEFAULT_TOKENS; // include NEAR + FTs

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
                    <div className="text-white/70 text-sm">From token</div>
                    <select
                      value={fromToken}
                      onChange={(e) => setFromToken(e.target.value)}
                      className="w-full bg-[#1a1f3a] text-white/90 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {selectable.map((t) => (
                        <option key={t.symbol} value={t.symbol}>
                          {t.symbol} - {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-center">
                    <button className="w-12 h-12 bg-[#1a1f3a] rounded-full flex items-center justify-center hover:bg-[#252a4a] transition-colors">
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
                    <div className="text-white/70 text-sm">To token</div>
                    <select
                      value={toToken}
                      onChange={(e) => setToToken(e.target.value)}
                      className="w-full bg-[#1a1f3a] text-white/90 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {selectable
                        .filter((t) => t.symbol !== fromToken)
                        .map((t) => (
                          <option key={t.symbol} value={t.symbol}>
                            {t.symbol} - {t.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-white/70 text-sm">Amount</div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#1a1f3a] text-white/90 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                    />
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
    const fromMeta = getKnownTokenBySymbol(fromToken) || DEFAULT_TOKENS[0];
    const toMeta = getKnownTokenBySymbol(toToken) || DEFAULT_TOKENS[0];
    const amountNum = Number(amount || 0) || 0;
    const minReceiveNum = Math.max(
      0,
      amountNum * (1 - (slippageBps || 0) / 10000)
    );
    const verifierLabel = verifierId || "(not configured)";
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
                  <div className="text-white/70">Verifier</div>
                  <div className="text-white/60 text-sm font-mono truncate max-w-[55%] text-right">
                    {verifierLabel}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-sm">From token</div>
                  <div className="text-white text-sm">
                    {fromMeta.symbol}{" "}
                    {fromMeta.address ? `(${fromMeta.address})` : "(native)"}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-sm">To token</div>
                  <div className="text-white text-sm">
                    {toMeta.symbol}{" "}
                    {toMeta.address ? `(${toMeta.address})` : "(native)"}
                  </div>
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

              <div className="bg-[#1a1f3a] rounded-xl p-4 flex items-start gap-3">
                <div className="w-5 h-5 border-2 border-[#0075EA] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-[#0075EA] rounded-full" />
                </div>
                <p className="text-white/70 text-sm">
                  Please double check recipient address
                </p>
              </div>

              <button
                onClick={handleSwap}
                className="w-full py-4 bg-[#0075EA] text-white rounded-full text-lg font-bold hover:bg-cyan-600 transition-colors"
              >
                {submitting ? "SWAPPING..." : "CONFIRM"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SwapFlow;
