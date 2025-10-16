"use client";

import { createContext, useContext, useMemo } from "react";
import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { useWalletPortfolio } from "@/hooks/useWalletPortfolio";

type WalletPortfolioValue = ReturnType<typeof useWalletPortfolio>;

const WalletPortfolioContext = createContext<WalletPortfolioValue | null>(null);

export function WalletPortfolioProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { accountId } = usePrivateKeyWallet();
  const value = useWalletPortfolio(accountId);
  const memo = useMemo(() => value, [value]);
  return (
    <WalletPortfolioContext.Provider value={memo}>
      {children}
    </WalletPortfolioContext.Provider>
  );
}

export function useWalletPortfolioContext(): WalletPortfolioValue {
  const ctx = useContext(WalletPortfolioContext);
  if (!ctx) {
    throw new Error(
      "useWalletPortfolioContext must be used within WalletPortfolioProvider"
    );
  }
  return ctx;
}
