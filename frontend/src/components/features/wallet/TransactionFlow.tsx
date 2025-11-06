"use client";

import { useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useWalletPortfolioContext } from "@/contexts/WalletPortfolioContext";
import { formatDistanceToNow } from "date-fns";

interface TransactionFlowProps {
  onClose: () => void;
}

export default function TransactionFlow({ onClose }: TransactionFlowProps) {
  const { txns } = useWalletPortfolioContext();
  const [selectedTxn, setSelectedTxn] = useState<string | null>(null);

  const formatTimestamp = (ts?: number | string) => {
    if (!ts) return "Unknown";
    try {
      const date = typeof ts === "string" ? new Date(parseInt(ts) / 1e6) : new Date(ts / 1e6);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case "send":
        return "📤";
      case "receive":
        return "📥";
      case "interact":
        return "🔗";
      default:
        return "📋";
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "send":
        return "text-red-400";
      case "receive":
        return "text-green-400";
      case "interact":
        return "text-blue-400";
      default:
        return "text-white/60";
    }
  };

  const openExplorer = (txnId: string) => {
    window.open(`https://nearblocks.io/txns/${txnId}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0b2e] flex items-center justify-center">
      <div className="w-full max-w-[630px] h-full flex flex-col bg-[#0a0b2e]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0a0b2e] border-b border-white/5 px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs">Back</span>
            </button>
            <h1
              className="text-lg font-bold text-white tracking-[0.2em]"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                textShadow: "0 0 15px rgba(99, 102, 241, 0.5)",
              }}
            >
              TRANSACTIONS
            </h1>
            <div className="w-12" />
          </div>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!txns || txns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <div className="text-white/60 text-sm mb-2">No transactions yet</div>
              <div className="text-white/40 text-xs">
                Your transaction history will appear here
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {txns.map((txn) => (
                <div
                  key={txn.id}
                  className="bg-[#1a1d3f] rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors"
                  onClick={() => setSelectedTxn(selectedTxn === txn.id ? null : txn.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-2xl">{getTransactionTypeIcon(txn.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={`font-semibold text-sm ${getTransactionTypeColor(txn.type)}`}>
                            {txn.description || txn.type}
                          </div>
                          {txn.status === "failed" && (
                            <span className="text-red-500 text-xs">Failed</span>
                          )}
                        </div>
                        <div className="text-white/50 text-xs mt-1">
                          {formatTimestamp(txn.timestamp)}
                        </div>
                        {txn.amount && parseFloat(txn.amount) > 0 && (
                          <div className="text-white/70 text-xs mt-1">
                            {txn.amount} {txn.token}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openExplorer(txn.id);
                      }}
                      className="text-white/40 hover:text-white/80 transition-colors p-1"
                      title="View on NearBlocks"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {selectedTxn === txn.id && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-white/50">Type</div>
                          <div className="text-white">{txn.type}</div>
                        </div>
                        <div>
                          <div className="text-white/50">Status</div>
                          <div className={txn.status === "completed" ? "text-green-400" : "text-red-400"}>
                            {txn.status || "Unknown"}
                          </div>
                        </div>
                        {txn.from && (
                          <div className="col-span-2">
                            <div className="text-white/50">From</div>
                            <div className="text-white break-all">{txn.from}</div>
                          </div>
                        )}
                        {txn.to && (
                          <div className="col-span-2">
                            <div className="text-white/50">To</div>
                            <div className="text-white break-all">{txn.to}</div>
                          </div>
                        )}
                        {txn.method && (
                          <div className="col-span-2">
                            <div className="text-white/50">Method</div>
                            <div className="text-white">{txn.method}</div>
                          </div>
                        )}
                        {txn.fee && (
                          <div>
                            <div className="text-white/50">Fee</div>
                            <div className="text-white">{txn.fee} NEAR</div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openExplorer(txn.id);
                        }}
                        className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View on NearBlocks Explorer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

