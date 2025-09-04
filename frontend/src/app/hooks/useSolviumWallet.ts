import { usePrivateKeyWallet } from "@/app/contexts/PrivateKeyWalletContext";

/**
 * Hook to access solvium wallet data from PrivateKeyWalletContext
 * @returns Object containing solvium wallet data and refresh function
 */
export const useSolviumWallet = () => {
  const { solviumWallet, refreshSolviumWallet, isLoading, error } =
    usePrivateKeyWallet();

  return {
    solviumWallet,
    refreshSolviumWallet,
    isLoading,
    error,
    hasWallet: solviumWallet?.has_wallet || false,
    walletInfo: solviumWallet?.wallet_info,
    message: solviumWallet?.message,
  };
};
