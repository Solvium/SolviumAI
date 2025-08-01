import { useMemo } from "react";
import { WalletState } from "../types/wallet";

export function useWalletState(
  nearWallet: WalletState,
  tonWallet: WalletState,
  selectedWallet: string | null
) {
  return useMemo(() => {
    if (!selectedWallet) {
      return {
        isConnected: false,
        accountId: null,
        balance: null,
        loading: false,
        error: null,
      };
    }

    const currentWallet = selectedWallet === "NEAR" ? nearWallet : tonWallet;

    return {
      ...currentWallet,
      isConnected: Boolean(currentWallet.isConnected),
      accountId: currentWallet.accountId || null,
    };
  }, [nearWallet, tonWallet, selectedWallet]);
}
