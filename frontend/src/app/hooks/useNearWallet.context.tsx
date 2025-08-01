import { createContext, useReducer, useCallback, useEffect } from "react";
import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { WalletContextValue } from "../types/wallet";
import "@near-wallet-selector/modal-ui/styles.css";

import {
  initialState,
  walletReducer,
} from "@/components/reducers/useNearWallet.reducer";
import { BLOCKCHAIN_NET, CONTRACTID } from "@/components/constants/contractId";
import { map } from "rxjs";

export const WalletContext = createContext<WalletContextValue | null>(null);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(walletReducer, initialState);

  const initWallet = useCallback(async () => {
    try {
      dispatch({ type: "SET_LOADING" });

      const selector = await setupWalletSelector({
        network: BLOCKCHAIN_NET,
        modules: [setupMeteorWallet({}) as any],
      });

      const modal = setupModal(selector, {
        contractId: CONTRACTID,
      });

      const { accounts } = selector.store.getState();

      dispatch({
        type: "INIT_SUCCESS",
        payload: { selector, modal, accounts },
      });

      // Subscribe to account changes
      selector.store.observable
        .pipe(map((state: any) => state.accounts))
        .subscribe((accounts) => {
          if (accounts.some((acc: any) => acc.active)) {
            dispatch({
              type: "SET_CONNECTED",
              payload: {
                accounts,
                accountId: accounts.find((acc: any) => acc.active)?.accountId,
              },
            });
          }
        });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error });
    }
  }, []);

  const connect = useCallback(async () => {
    if (!state.modal) return;
    try {
      dispatch({ type: "SET_LOADING" });
      await state.modal.show();
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error });
    }
  }, [state.modal]);

  const disconnect = useCallback(async () => {
    if (!state.selector) return;
    try {
      dispatch({ type: "SET_LOADING" });
      const wallet = await state.selector.wallet();
      await wallet.signOut();
      dispatch({ type: "SET_DISCONNECTED" });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error });
    }
  }, [state.selector]);

  const getActiveAccount = useCallback(() => {
    return state.accounts.find((acc) => acc.active);
  }, [state.accounts]);

  useEffect(() => {
    initWallet();
  }, [initWallet]);

  return (
    <WalletContext.Provider
      value={{
        state,
        connect,
        disconnect,
        getActiveAccount,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
