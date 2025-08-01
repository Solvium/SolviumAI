// // import { useState, useCallback, useEffect } from "react";
// // import {
// //   setupWalletSelector,
// //   WalletSelector,
// //   WalletModuleFactory,
// //   AccountState,
// // } from "@near-wallet-selector/core";
// // import {
// //   setupModal,
// //   WalletSelectorModal,
// // } from "@near-wallet-selector/modal-ui";
// // import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
// // import "@near-wallet-selector/modal-ui/styles.css";

// // interface WalletHookState {
// //   accountId: string | null;
// //   connected: boolean;
// //   loading: boolean;
// //   error: Error | null;
// //   accounts: AccountState[];
// // }

// // interface WalletConfig {
// //   contractId: string;
// //   network: "testnet" | "mainnet";
// // }

// // export const DEFAULT_CONFIG: WalletConfig = {
// //   contractId: process.env.NEXT_PUBLIC_CONTRACT_ID || "finehare4946.testnet",
// //   network:
// //     (process.env.NEXT_PUBLIC_NETWORK as "testnet" | "mainnet") || "mainnet",
// // };

// // export function useNearWallet(config: WalletConfig = DEFAULT_CONFIG) {
// //   const [state, setState] = useState<WalletHookState>({
// //     accountId: null,
// //     connected: false,
// //     loading: true,
// //     error: null,
// //     accounts: [],
// //   });
// //   const [selector, setSelector] = useState<WalletSelector | null>(null);
// //   const [modal, setModal] = useState<WalletSelectorModal | null>(null);

// //   useEffect(() => {
// //     const initWallet = async () => {
// //       try {
// //         const selector = await setupWalletSelector({
// //           network: config.network,
// //           modules: [setupMeteorWallet() as WalletModuleFactory],
// //         });

// //         const modal = setupModal(selector, {
// //           contractId: config.contractId,
// //         });

// //         const { accounts } = selector.store.getState();
// //         const accountId = accounts.find((a) => a.active)?.accountId || null;

// //         setSelector(selector);
// //         setModal(modal);
// //         setState((prev) => ({
// //           ...prev,
// //           accountId,
// //           connected: !!accountId,
// //           accounts,
// //           loading: false,
// //         }));

// //         // Subscribe to account changes
// //         const subscription = selector.store.observable.subscribe((state) => {
// //           const accountId =
// //             state.accounts.find((a) => a.active)?.accountId || null;
// //           setState((prev) => ({
// //             ...prev,
// //             accountId,
// //             connected: !!accountId,
// //             accounts: state.accounts,
// //           }));
// //         });

// //         return () => subscription.unsubscribe();
// //       } catch (error) {
// //         setState((prev) => ({
// //           ...prev,
// //           error: error as Error,
// //           loading: false,
// //         }));
// //       }
// //     };

// //     initWallet();
// //   }, [config.network, config.contractId]);

// //   const connectWallet = useCallback(async () => {
// //     if (!modal) return;
// //     try {
// //       setState((prev) => ({ ...prev, loading: true }));
// //       await modal.show();
// //     } catch (error) {
// //       setState((prev) => ({
// //         ...prev,
// //         error: error as Error,
// //       }));
// //     } finally {
// //       setState((prev) => ({ ...prev, loading: false }));
// //     }
// //   }, [modal]);

// //   const disconnectWallet = useCallback(async () => {
// //     if (!selector) return;
// //     try {
// //       setState((prev) => ({ ...prev, loading: true }));
// //       const wallet = await selector.wallet();
// //       await wallet.signOut();
// //       setState((prev) => ({
// //         ...prev,
// //         accountId: null,
// //         connected: false,
// //         accounts: [],
// //       }));
// //     } catch (error) {
// //       setState((prev) => ({
// //         ...prev,
// //         error: error as Error,
// //       }));
// //     } finally {
// //       setState((prev) => ({ ...prev, loading: false }));
// //     }
// //   }, [selector]);

// //   return {
// //     ...state,
// //     connectWallet,
// //     disconnectWallet,
// //     selector,
// //     modal,
// //   };
// // }

// import {
//   createContext,
//   useContext,
//   useState,
//   useEffect,
//   useCallback,
// } from "react";
// import {
//   setupWalletSelector,
//   WalletSelector,
//   AccountState,
//   WalletModuleFactory,
// } from "@near-wallet-selector/core";
// import { setupModal } from "@near-wallet-selector/modal-ui";
// import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
// import { CONTRACTID } from "../components/constants/contractId";

// interface WalletConfig {
//   contractId: string;
//   network: "testnet" | "mainnet";
// }

// export const DEFAULT_CONFIG: WalletConfig = {
//   contractId: CONTRACTID,
//   network:
//     (process.env.NEXT_PUBLIC_NETWORK as "testnet" | "mainnet") || "testnet",
// };

// interface WalletState {
//   selector: WalletSelector | null;
//   accounts: AccountState[];
//   accountId: string | null;
//   connected: boolean;
//   loading: boolean;
// }

// const NearWalletContext = createContext<{
//   state: WalletState;
//   connect: () => Promise<void>;
//   disconnect: () => Promise<void>;
// } | null>(null);

// export function NearWalletProvider({
//   children,
//   config = DEFAULT_CONFIG,
// }: {
//   children: React.ReactNode;
//   config?: WalletConfig;
// }) {
//   const [state, setState] = useState<WalletState>({
//     selector: null,
//     accounts: [],
//     accountId: null,
//     connected: false,
//     loading: true,
//   });

//   useEffect(() => {
//     setupWalletSelector({
//       network: config.network,
//       modules: [setupMeteorWallet() as WalletModuleFactory],
//     }).then((selector) => {
//       const { accounts } = selector.store.getState();
//       setState((prev) => ({
//         ...prev,
//         selector,
//         accounts,
//         accountId: accounts[0]?.accountId || null,
//         connected: accounts.length > 0,
//         loading: false,
//       }));
//     });
//   }, [config.network]);

//   const connect = useCallback(async () => {
//     if (!state.selector) return;
//     const modal = setupModal(state.selector, { contractId: config.contractId });
//     modal.show();
//   }, [state.selector, config.contractId]);

//   const disconnect = useCallback(async () => {
//     if (!state.selector) return;
//     const wallet = await state.selector.wallet();
//     await wallet.signOut();
//     setState((prev) => ({
//       ...prev,
//       accounts: [],
//       accountId: null,
//       connected: false,
//     }));
//   }, [state.selector]);

//   return (
//     <NearWalletContext.Provider value={{ state, connect, disconnect }}>
//       {children}
//     </NearWalletContext.Provider>
//   );
// }

// export function useNearWallet() {
//   const context = useContext(NearWalletContext);
//   if (!context) {
//     throw new Error("useNearWallet must be used within NearWalletProvider");
//   }
//   return context;
// }
// import {
//   createContext,
//   useContext,
//   useState,
//   useCallback,
//   useEffect,
// } from "react";
// import {
//   setupWalletSelector,
//   WalletSelector,
//   WalletModuleFactory,
//   AccountState,
// } from "@near-wallet-selector/core";
// import {
//   setupModal,
//   WalletSelectorModal,
// } from "@near-wallet-selector/modal-ui";
// import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
// import "@near-wallet-selector/modal-ui/styles.css";
// import { CONTRACTID } from "../components/constants/contractId";

// interface WalletHookState {
//   accountId: string | null;
//   connected: boolean;
//   loading: boolean;
//   error: Error | null;
//   accounts: AccountState[];
// }

// interface WalletConfig {
//   contractId: string;
//   network: "testnet" | "mainnet";
// }

// interface NearWalletContextType {
//   selector: WalletSelector | null;
//   modal: any;
//   accounts: AccountState[];
//   accountId: string | null;
//   connected: boolean;
//   loading: boolean;
//   error: Error | null;
//   connectWallet: () => Promise<void>;
//   disconnectWallet: () => Promise<void>;
// }

// export const DEFAULT_CONFIG: WalletConfig = {
//   contractId: CONTRACTID,
//   network:
//     (process.env.NEXT_PUBLIC_NETWORK as "testnet" | "mainnet") || "testnet",
// };

// const NearWalletContext = createContext<NearWalletContextType | null>(null);

// export function NearWalletProvider({
//   children,
// }: {
//   children: React.ReactNode;
//   config?: WalletConfig;
// }) {
//   const [state, setState] = useState({
//     selector: null as WalletSelector | null,
//     modal: null as WalletSelectorModal | null,
//     accounts: [] as AccountState[],
//     accountId: null as string | null,
//     connected: false,
//     loading: true,
//     error: null as Error | null,
//   });

//   //   useEffect(() => {
//   //     const initWallet = async () => {
//   //       try {
//   //         const selector = await setupWalletSelector({
//   //           network: config.network,
//   //           modules: [setupMeteorWallet() as WalletModuleFactory],
//   //         });

//   //         const modal = setupModal(selector, {
//   //           contractId: config.contractId,
//   //         });

//   //         const { accounts } = selector.store.getState();
//   //         const accountId = accounts.find((a) => a.active)?.accountId || null;

//   //         setSelector(selector);
//   //         setModal(modal);
//   //         setState((prev) => ({
//   //           ...prev,
//   //           accountId,
//   //           connected: !!accountId,
//   //           accounts,
//   //           loading: false,
//   //         }));

//   //         const subscription = selector.store.observable.subscribe((state) => {
//   //           const accountId =
//   //             state.accounts.find((a) => a.active)?.accountId || null;
//   //           setState((prev) => ({
//   //             ...prev,
//   //             accountId,
//   //             connected: !!accountId,
//   //             accounts: state.accounts,
//   //           }));
//   //         });

//   //         return () => subscription.unsubscribe();
//   //       } catch (error) {
//   //         setState((prev) => ({
//   //           ...prev,
//   //           error: error as Error,
//   //           loading: false,
//   //         }));
//   //       }
//   //     };

//   //     initWallet();
//   //   }, [config.network, config.contractId]);

//   useEffect(() => {
//     setupWalletSelector({
//       network: "testnet",
//       modules: [setupMeteorWallet() as WalletModuleFactory],
//     })
//       .then((selector) => {
//         const modal = setupModal(selector, { contractId: "your-contract-id" });
//         const { accounts } = selector.store.getState();

//         setState((prev) => ({
//           ...prev,
//           selector,
//           modal,
//           accounts,
//           accountId: accounts[0]?.accountId || null,
//           connected: accounts.length > 0,
//           loading: false,
//         }));

//         // Subscribe to changes
//         const subscription = selector.store.observable.subscribe((state) => {
//           setState((prev) => ({
//             ...prev,
//             accounts: state.accounts,
//             accountId: state.accounts[0]?.accountId || null,
//             connected: state.accounts.length > 0,
//           }));
//         });

//         return () => subscription.unsubscribe();
//       })
//       .catch((error) => {
//         setState((prev) => ({ ...prev, error, loading: false }));
//       });
//   }, []);

//   const connectWallet = useCallback(async () => {
//     if (!state.modal) return;
//     try {
//       state.modal.show();
//     } catch (error) {
//       setState((prev) => ({ ...prev, error: error as Error }));
//     }
//   }, [state.modal]);

//   //   const connectWallet = useCallback(async () => {
//   //     if (!state.modal) return;
//   //     try {
//   //       setState((prev) => ({ ...prev, loading: true }));
//   //       state.modal.show();
//   //     } catch (error) {
//   //       setState((prev) => ({
//   //         ...prev,
//   //         error: error as Error,
//   //       }));
//   //     } finally {
//   //       setState((prev) => ({ ...prev, loading: false }));
//   //     }
//   //   }, [modal]);

//   const disconnectWallet = useCallback(async () => {
//     if (!state.selector) return;
//     try {
//       const wallet = await state.selector.wallet();
//       await wallet.signOut();
//       setState((prev) => ({
//         ...prev,
//         accounts: [],
//         accountId: null,
//         connected: false,
//       }));
//     } catch (error) {
//       setState((prev) => ({ ...prev, error: error as Error }));
//     }
//   }, [state.selector]);
//   //   const disconnectWallet = useCallback(async () => {
//   //     if (!selector) return;
//   //     try {
//   //       setState((prev) => ({ ...prev, loading: true }));
//   //       const wallet = await selector.wallet();
//   //       await wallet.signOut();
//   //       setState((prev) => ({
//   //         ...prev,
//   //         accountId: null,
//   //         connected: false,
//   //         accounts: [],
//   //       }));
//   //     } catch (error) {
//   //       setState((prev) => ({
//   //         ...prev,
//   //         error: error as Error,
//   //       }));
//   //     } finally {
//   //       setState((prev) => ({ ...prev, loading: false }));
//   //     }
//   //   }, [selector]);

//   return (
//     <NearWalletContext.Provider
//       value={{
//         ...state,
//         connectWallet,
//         disconnectWallet,
//       }}
//     >
//       {children}
//     </NearWalletContext.Provider>
//   );
// }

// export function useNearWallet() {
//   const context = useContext(NearWalletContext);
//   if (!context) {
//     throw new Error("useNearWallet must be used within NearWalletProvider");
//   }
//   return context;
// }

// import { setupCoin98Wallet } from "@near-wallet-selector/coin98-wallet";
import type {
  AccountState,
  WalletModuleFactory,
  WalletSelector,
} from "@near-wallet-selector/core";
import { setupWalletSelector } from "@near-wallet-selector/core";
// import { setupHereWallet } from "@near-wallet-selector/here-wallet";
// import { setupMathWallet } from "@near-wallet-selector/math-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
// import { setupNarwallets } from "@near-wallet-selector/narwallets";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { setupModal } from "@near-wallet-selector/modal-ui";
// import { setupNearFi } from "@near-wallet-selector/nearfi";
// import { setupNightly } from "@near-wallet-selector/nightly";
// import { setupSender } from "@near-wallet-selector/sender";
// import { setupBitgetWallet } from "@near-wallet-selector/bitget-wallet";
// // import { setupWalletConnect } from "@near-wallet-selector/wallet-connect";
// import { setupWelldoneWallet } from "@near-wallet-selector/welldone-wallet";
// import { setupNearSnap } from "@near-wallet-selector/near-snap";
// import { setupNeth } from "@near-wallet-selector/neth";
// import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
// // import { setupLedger } from "@near-wallet-selector/ledger";
// import { setupXDEFI } from "@near-wallet-selector/xdefi";
// import { setupRamperWallet } from "@near-wallet-selector/ramper-wallet";
// import { setupNearMobileWallet } from "@near-wallet-selector/near-mobile-wallet";
// import { setupMintbaseWallet } from "@near-wallet-selector/mintbase-wallet";
import "@near-wallet-selector/modal-ui/styles.css";

import type { ReactNode } from "react";
import React, {
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import { distinctUntilChanged, map } from "rxjs";
import { CONTRACTID } from "@/components/constants/contractId";

declare global {
  interface Window {
    selector: WalletSelector;
    modal: WalletSelectorModal;
  }
}

interface WalletSelectorContextValue {
  selector: WalletSelector;
  modal: WalletSelectorModal;
  accounts: Array<AccountState>;
  accountId: string | null;
  isConnectedNear: boolean | null;
  isUserSignedIn: boolean;
  setUserSignedIn: React.Dispatch<React.SetStateAction<boolean>>;
}

const WalletSelectorContext =
  React.createContext<WalletSelectorContextValue | null>(null);

export const WalletSelectorContextProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [accounts, setAccounts] = useState<Array<AccountState>>([]);
  const [, setLoading] = useState<boolean>(true);
  const [isConnectedNear, setIsConnected] = useState<boolean | null>(null);
  const [isUserSignedIn, setUserSignedIn] = useState(false);
  const init = useCallback(async () => {
    const _selector = await setupWalletSelector({
      network: "mainnet",
      //   debug: true,
      modules: [
        // setupMyNearWallet(),
        // setupLedger(),
        // setupSender(),
        // setupBitgetWallet(),
        // setupMathWallet(),
        // setupNightly(),
        setupMeteorWallet() as WalletModuleFactory,
        // setupNearSnap(),
        // setupNarwallets(),
        // setupWelldoneWallet(),
        // setupHereWallet(),
        // setupCoin98Wallet(),
        // setupNearFi(),
        // setupRamperWallet(),
        // setupNeth({
        //   gas: "300000000000000",
        //   bundle: false,
        // }),
        // setupXDEFI(),
        // setupWalletConnect({
        //   projectId: "c4f79cc...",
        //   metadata: {
        //     name: "NEAR Wallet Selector",
        //     description: "Example dApp used by NEAR Wallet Selector",
        //     url: "https://github.com/near/wallet-selector",
        //     icons: ["https://avatars.githubusercontent.com/u/37784886"],
        //   },
        // }),
        // setupNearMobileWallet(),
        // setupMintbaseWallet({
        //   contractId: CONTRACTID,
        // }),
      ],
    });
    const _modal = setupModal(_selector, {
      contractId: CONTRACTID,
    });
    const state = _selector.store.getState();
    setAccounts(state.accounts);

    // this is added for debugging purpose only
    // for more information (https://github.com/near/wallet-selector/pull/764#issuecomment-1498073367)
    // window.selector = _selector;
    window.modal = _modal;

    setSelector(_selector);
    setModal(_modal);
    setLoading(false);
  }, []);

  useEffect(() => {
    init().catch((err) => {
      console.error(err);
      alert("Failed to initialise wallet selector");
    });
  }, [init]);

  useEffect(() => {
    if (!selector) {
      return;
    }

    const subscription = selector.store.observable
      .pipe(
        map((state) => state.accounts),
        distinctUntilChanged()
      )
      .subscribe((nextAccounts) => {
        console.log("Accounts Update", nextAccounts);
        console.log(nextAccounts.some((account) => account.active));
        setIsConnected(nextAccounts.some((account) => account.active));

        setAccounts(nextAccounts);
      });

    const onHideSubscription = modal!.on("onHide", ({ hideReason }) => {
      console.log(`The reason for hiding the modal ${hideReason}`);
    });

    return () => {
      subscription.unsubscribe();
      onHideSubscription.remove();
    };
  }, [selector, modal]);

  const walletSelectorContextValue = useMemo<WalletSelectorContextValue>(
    () => ({
      selector: selector!,
      modal: modal!,
      accounts,
      isUserSignedIn,
      setUserSignedIn,
      isConnectedNear: isConnectedNear,
      accountId: accounts.find((account) => account.active)?.accountId || null,
    }),
    [selector, modal, accounts, isConnectedNear]
  );

  return (
    <WalletSelectorContext.Provider value={walletSelectorContextValue}>
      {children}
    </WalletSelectorContext.Provider>
  );
};

export function useWalletSelector() {
  const context = useContext(WalletSelectorContext);

  if (!context) {
    throw new Error(
      "useWalletSelector must be used within a WalletSelectorContextProvider"
    );
  }

  return context;
}
