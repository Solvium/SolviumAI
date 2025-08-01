import { create } from "zustand";

type WalletType = "TON" | "NEAR" | null;

interface WalletState {
  selectedWallet: WalletType;
  setSelectedWallet: (wallet: WalletType) => void;
}

export const useWalletStore = create<WalletState>()((set) => ({
  selectedWallet: null,
  setSelectedWallet: (wallet) => set({ selectedWallet: wallet }),
}));
