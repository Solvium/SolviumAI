"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as ed from "@noble/ed25519";

type SimpleWalletState = {
  accountId: string | null;
  publicKeyB64: string | null;
  hasKey: boolean;
};

type SimpleWalletCtx = SimpleWalletState & {
  loadOnLogin: (accountId: string) => Promise<void>;
  loadOnTelegramLogin?: (telegramUserId: string) => Promise<void>;
  sign: (message: Uint8Array | string) => Promise<string>; // returns base64 signature
  clear: () => void;
};

const WalletContext = createContext<SimpleWalletCtx | null>(null);

const KEY_CACHE = "__simple_wallet_key_b64";
const KEY_ACC = "__simple_wallet_account";
const KEY_PUB = "__simple_wallet_pub_b64";

export function SimpleWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<SimpleWalletState>({
    accountId: null,
    publicKeyB64: null,
    hasKey: false,
  });

  useEffect(() => {
    try {
      const cachedKey = sessionStorage.getItem(KEY_CACHE);
      const cachedAcc = sessionStorage.getItem(KEY_ACC);
      const cachedPub = sessionStorage.getItem(KEY_PUB);
      if (cachedKey && cachedAcc) {
        setState({
          accountId: cachedAcc,
          publicKeyB64: cachedPub,
          hasKey: true,
        });
        console.log(
          "[SimpleWallet] Restored cached private key for account:",
          cachedAcc
        );
      }
    } catch {}
  }, []);

  async function fetchPrivateKey(
    accountId: string
  ): Promise<{ privB64: string; pubB64?: string }> {
    // Use decrypt=1 route to get privateKey; this is simple for now
    const res = await fetch(
      `/api/wallet/${encodeURIComponent(accountId)}?decrypt=1`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Failed to fetch wallet");
    }
    const data = await res.json();
    if (!data?.privateKey) throw new Error("Private key missing");
    console.log("[SimpleWallet] Fetched private key for account:", accountId);
    return {
      privB64: Buffer.from(data.privateKey, "utf8").toString("base64"),
      pubB64: data.publicKey,
    };
  }

  async function loadOnLogin(accountId: string) {
    const { privB64, pubB64 } = await fetchPrivateKey(accountId);
    // Cache for session only
    try {
      sessionStorage.setItem(KEY_CACHE, privB64);
      sessionStorage.setItem(KEY_ACC, accountId);
      if (pubB64) sessionStorage.setItem(KEY_PUB, pubB64);
    } catch {}
    console.log(
      "[SimpleWallet] Cached private key in session for account:",
      accountId
    );
    setState({ accountId, publicKeyB64: pubB64 ?? null, hasKey: true });
  }

  // Optional: load using Telegram user id (uses by-telegram route)
  async function loadOnTelegramLogin(telegramUserId: string) {
    const res = await fetch(
      `/api/wallet/by-telegram/${encodeURIComponent(telegramUserId)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Failed to fetch wallet by telegramUserId");
    }
    const data = await res.json();
    if (!data?.privateKey || !data?.accountId)
      throw new Error("Private key or account missing");
    const privB64 = Buffer.from(data.privateKey, "utf8").toString("base64");
    try {
      sessionStorage.setItem(KEY_CACHE, privB64);
      sessionStorage.setItem(KEY_ACC, data.accountId);
      if (data.publicKey) sessionStorage.setItem(KEY_PUB, data.publicKey);
    } catch {}
    console.log(
      "[SimpleWallet] Cached private key in session for TG user, account:",
      data.accountId
    );
    setState({
      accountId: data.accountId,
      publicKeyB64: data.publicKey ?? null,
      hasKey: true,
    });
  }

  function parseKeyStringToSeedBytes(privB64: string): Uint8Array {
    // First, decode our stored base64 into original string
    const privStr = Buffer.from(privB64, "base64").toString("utf8");
    // Try base64 of raw bytes
    try {
      const b = Buffer.from(privStr, "base64");
      if (b.length === 32 || b.length === 64)
        return new Uint8Array(b.length === 64 ? b.subarray(0, 32) : b);
    } catch {}
    // Try hex
    try {
      const h = Buffer.from(privStr, "hex");
      if (h.length === 32 || h.length === 64)
        return new Uint8Array(h.length === 64 ? h.subarray(0, 32) : h);
    } catch {}
    // Fallback to utf8 bytes as last resort
    const u = Buffer.from(privStr, "utf8");
    if (u.length >= 32) return new Uint8Array(u.subarray(0, 32));
    throw new Error("Invalid private key data");
  }

  async function sign(message: Uint8Array | string): Promise<string> {
    const privB64 =
      typeof window !== "undefined" ? sessionStorage.getItem(KEY_CACHE) : null;
    if (!privB64) throw new Error("Private key not loaded");

    const seed = parseKeyStringToSeedBytes(privB64);
    const msg =
      typeof message === "string" ? new TextEncoder().encode(message) : message;
    const signature = await ed.sign(msg, seed);
    console.log(
      "[SimpleWallet] Locally signed message for account",
      state.accountId
    );
    return Buffer.from(signature).toString("base64");
  }

  function clear() {
    try {
      sessionStorage.removeItem(KEY_CACHE);
      sessionStorage.removeItem(KEY_ACC);
      sessionStorage.removeItem(KEY_PUB);
    } catch {}
    setState({ accountId: null, publicKeyB64: null, hasKey: false });
  }

  const value = useMemo<SimpleWalletCtx>(
    () => ({ ...state, loadOnLogin, loadOnTelegramLogin, sign, clear }),
    [state]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useSimpleWallet(): SimpleWalletCtx {
  const ctx = useContext(WalletContext);
  if (!ctx)
    throw new Error("useSimpleWallet must be used within SimpleWalletProvider");
  return ctx;
}
