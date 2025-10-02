"use client"

import { useState } from "react"
import { ArrowLeft, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SwapFlowProps {
  onClose: () => void
  onSuccess: () => void
}

type SwapStep = "select" | "swap" | "confirm"

const tokens = [
  { symbol: "BTC", name: "Bitcoin", amount: "0.0000013", usd: "$29.56", color: "bg-orange-500" },
  { symbol: "ETH", name: "Ethereum", amount: "0.17", usd: "$234", color: "bg-purple-500" },
  { symbol: "BNB", name: "Binance", amount: "0.01745", usd: "$4.98", color: "bg-yellow-500" },
  { symbol: "MATIC", name: "Polygon", amount: "34.3", usd: "$30", color: "bg-purple-600" },
  { symbol: "XRP", name: "Ripple", amount: "3.00912", usd: "$30", color: "bg-green-500" },
]

const SwapFlow = ({ onClose, onSuccess }: SwapFlowProps) => {
  const [step, setStep] = useState<SwapStep>("swap")
  const [fromToken, setFromToken] = useState("SOLV")
  const [toToken, setToToken] = useState("SOL")

  if (step === "swap") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] z-50 overflow-y-auto">
        <div className="max-w-md mx-auto min-h-screen pb-6">
          <div className="px-4 pt-6">
            <div className="flex items-center justify-between mb-8">
              <Button variant="ghost" className="text-white hover:bg-white/10 p-2" onClick={onClose}>
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
                  background: "linear-gradient(135deg, #00d4ff 0%, #9d4edd 100%)",
                }}
              >
                <div className="bg-[#0a0e27] rounded-3xl p-8 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-xl">$</span>
                    </div>
                    <div className="text-4xl font-bold text-white">{fromToken}</div>
                  </div>

                  <div className="flex items-center justify-center">
                    <button className="w-12 h-12 bg-[#1a1f3a] rounded-full flex items-center justify-center hover:bg-[#252a4a] transition-colors">
                      <svg className="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-b from-cyan-400 via-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                      <div className="w-14 h-14 bg-[#0a0e27] rounded-full flex items-center justify-center">
                        <div className="space-y-1">
                          <div className="h-1 w-8 bg-cyan-400 rounded" />
                          <div className="h-1 w-8 bg-purple-400 rounded" />
                          <div className="h-1 w-8 bg-pink-400 rounded" />
                        </div>
                      </div>
                    </div>
                    <div className="text-4xl font-bold text-white">{toToken}</div>
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
    )
  }

  if (step === "confirm") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] z-50 overflow-y-auto">
        <div className="max-w-md mx-auto min-h-screen pb-6">
          <div className="px-4 pt-6">
            <div className="flex items-center justify-between mb-8">
              <Button variant="ghost" className="text-white hover:bg-white/10 p-2" onClick={() => setStep("swap")}>
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
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">$</span>
                    </div>
                    <div>
                      <div className="text-white text-xl font-bold">0.1298 solv</div>
                      <div className="text-white/50 text-sm">$3.00912</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="w-10 h-10 bg-[#1a1f3a] rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#0075EA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-b from-cyan-400 via-purple-400 to-pink-400 rounded-full" />
                    <div>
                      <div className="text-white text-xl font-bold">0.1642 SOL</div>
                      <div className="text-white/50 text-sm">$3.00</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-sm">From:</div>
                  <div className="flex items-center gap-2">
                    <div className="text-white text-sm font-mono">0x8dfu8dfjfj8a289d93djd3...0Okdiwjd</div>
                    <button className="text-[#0075EA]">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-sm">To:</div>
                  <div className="flex items-center gap-2">
                    <div className="text-white text-sm font-mono">0x8dfu8dfjfj8a289d93djd3...0Okdiwjd</div>
                    <button className="text-[#0075EA]">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-sm">Network fees</div>
                  <div className="text-white text-sm">0.004BTC</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-white font-medium">Total</div>
                  <div className="text-white font-bold">0.1320BTC</div>
                </div>
              </div>

              <div className="bg-[#1a1f3a] rounded-xl p-4 flex items-start gap-3">
                <div className="w-5 h-5 border-2 border-[#0075EA] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-[#0075EA] rounded-full" />
                </div>
                <p className="text-white/70 text-sm">Please double check recipient address</p>
              </div>

              <button
                onClick={onSuccess}
                className="w-full py-4 bg-[#0075EA] text-white rounded-full text-lg font-bold hover:bg-cyan-600 transition-colors"
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default SwapFlow
