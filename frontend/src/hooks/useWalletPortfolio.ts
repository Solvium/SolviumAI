"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAccountTxns,
  getAccountInventory,
  formatNearAmount,
} from "@/lib/nearblocks";
import { getAccountFull } from "@/lib/fastnear";

export type PortfolioToken = {
  id: string;
  symbol: string;
  decimals?: number;
  balance: string; // humanized
};

export type PortfolioTxn = {
  id: string;
  type: string;
  amount: string;
  token: string;
  from?: string;
  to?: string;
  timestamp?: number | string;
  status?: string;
  description?: string;
  method?: string;
  fee?: string;
};

export function useWalletPortfolio(accountId?: string | null) {
  const [nearBalance, setNearBalance] = useState<string | null>(null);
  const [tokens, setTokens] = useState<PortfolioToken[]>([]);
  const [txns, setTxns] = useState<PortfolioTxn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    if (!accountId) return;
    const now = Date.now();
    if (now - lastRef.current < 15000) return; // 15s debounce
    lastRef.current = now;

    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // Balance via FastNear; fallback to nearblocks info
        try {
          const full = await getAccountFull(accountId);
          if (!cancelled && full?.state?.balance) {
            const yocto = full.state.balance as string;
            // simple humanization like in WalletPage
            const padded = yocto.padStart(25, "0");
            const whole = padded.slice(0, -24).replace(/^0+/, "") || "0";
            const frac = padded.slice(-24, -20);
            setNearBalance(`${whole}.${frac}`);
          }
        } catch {}

        // Transactions
        const rawTxns = await getAccountTxns(accountId);
        if (!cancelled) {
          const normalized = Array.isArray(rawTxns)
            ? rawTxns.map((row: any): PortfolioTxn => {
                const action = row?.actions?.[0];
                const signer = row?.signer_account_id;
                const receiver = row?.receiver_account_id;
                const isSend = signer === accountId;
                const isReceive =
                  receiver === accountId && signer !== accountId;
                let amount = "";
                if (action?.deposit && action.deposit > 0) {
                  const nearAmount = action.deposit / 1e24;
                  amount = nearAmount.toFixed(4);
                }
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
                    type = signer && signer !== receiver ? "send" : "receive";
                    description =
                      type === "send" ? "NEAR Sent" : "NEAR Received";
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
              })
            : [];
          setTxns(normalized);
        }

        // Tokens via Nearblocks inventory (support array or inventory.fts)
        try {
          const inv = await getAccountInventory(accountId);
          if (!cancelled && inv) {
            const fromArray = Array.isArray(inv) ? inv : null;
            const fromFts = Array.isArray((inv as any)?.fts)
              ? (inv as any).fts
              : null;

            let mapped: PortfolioToken[] = [];
            if (fromFts) {
              mapped = fromFts.filter(Boolean).map((t: any) => {
                const decimals: number | undefined = t?.ft_meta?.decimals;
                const raw =
                  t?.amount ||
                  t?.balance ||
                  t?.quantity ||
                  t?.total ||
                  t?.balance_formatted ||
                  "0";
                // humanize up to 4 fractional digits
                let human = "0";
                const d =
                  typeof decimals === "number" && decimals > 0 ? decimals : 0;
                const str = String(raw);
                if (/^[0-9]+$/.test(str) && d > 0) {
                  const padded = str.padStart(d + 1, "0");
                  const whole = padded.slice(0, -d).replace(/^0+/, "") || "0";
                  const frac = padded.slice(
                    -d,
                    -Math.max(d - 4, 0) || undefined
                  );
                  human = `${whole}.${frac}`;
                } else {
                  human = str;
                }
                const id =
                  t?.contract || t?.token_contract || t?.token || t?.id || "";
                const symbol =
                  t?.ft_meta?.symbol || t?.symbol || t?.token || id;
                return { id, symbol, decimals, balance: human };
              });
            } else if (fromArray) {
              mapped = fromArray
                .filter(Boolean)
                .filter(
                  (it: any) =>
                    String(it?.token_id || "").toLowerCase() !== "near"
                )
                .map((it: any) => {
                  const id = it?.token_id || it?.contract || it?.id || "";
                  const symbol = it?.symbol || it?.metadata?.symbol || id;
                  const decimals = it?.decimals ?? it?.metadata?.decimals ?? 0;
                  const raw = it?.balance || it?.amount || "0";
                  let human = "0";
                  const d =
                    typeof decimals === "number" && decimals > 0 ? decimals : 0;
                  const str = String(raw);
                  if (/^[0-9]+$/.test(str) && d > 0) {
                    const padded = str.padStart(d + 1, "0");
                    const whole = padded.slice(0, -d).replace(/^0+/, "") || "0";
                    const frac = padded.slice(
                      -d,
                      -Math.max(d - 4, 0) || undefined
                    );
                    human = `${whole}.${frac}`;
                  } else {
                    human = str;
                  }
                  return { id, symbol, decimals, balance: human };
                });
            }
            setTokens(mapped);
          } else if (!cancelled) {
            setTokens([]);
          }
        } catch {}
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load wallet data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return useMemo(
    () => ({ nearBalance, tokens, txns, loading, error }),
    [nearBalance, tokens, txns, loading, error]
  );
}
