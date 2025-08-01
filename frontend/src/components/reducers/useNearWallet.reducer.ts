import { WalletAction, WalletState } from "@/app/types/wallet";

export const initialState: WalletState = {
  status: "idle",
  error: null,
  selector: null,
  modal: null,
  accounts: [],
  accountId: null,
  isConnected: false,
};

export function walletReducer(
  state: WalletState,
  action: WalletAction
): WalletState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, status: "loading", error: null };

    case "SET_ERROR":
      return { ...state, status: "error", error: action.payload };

    case "SET_CONNECTED":
      return {
        ...state,
        status: "connected",
        isConnected: true,
        accountId: action.payload.accountId,
        accounts: action.payload.accounts,
      };

    case "SET_DISCONNECTED":
      return {
        ...state,
        status: "idle",
        isConnected: false,
        accountId: null,
        accounts: [],
      };

    case "INIT_SUCCESS":
      return {
        ...state,
        status: "idle",
        selector: action.payload.selector,
        modal: action.payload.modal,
        accounts: action.payload.accounts,
      };

    default:
      return state;
  }
}
