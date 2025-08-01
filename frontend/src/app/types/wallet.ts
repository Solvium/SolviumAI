import { AccountState, WalletSelector } from "@near-wallet-selector/core";
import { WalletSelectorModal } from "@near-wallet-selector/modal-ui";

export interface WalletState {
  status: "idle" | "loading" | "connected" | "error";
  error: Error | null;
  selector: WalletSelector | null;
  modal: WalletSelectorModal | null;
  accounts: Array<AccountState>;
  accountId: string | null;
  isConnected: boolean;
}

export interface WalletAction {
  type:
    | "SET_LOADING"
    | "SET_ERROR"
    | "SET_CONNECTED"
    | "SET_DISCONNECTED"
    | "SET_ACCOUNTS"
    | "INIT_SUCCESS"
    | "INIT_ERROR";
  payload?: any;
}

export interface WalletContextValue {
  state: WalletState;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  getActiveAccount: () => AccountState | undefined;
}
