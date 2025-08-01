import { Sender, SenderArguments } from "@ton/core";
import { CHAIN } from "@tonconnect/protocol";
import {
  ITonConnect,
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";

export function useTonConnect(): {
  sender: Sender;
  connectWallet: () => object;
  connected: boolean;
  wallet: string | null;
  network: CHAIN | null;
} {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  return {
    connectWallet: async () => {
      const connected = !!wallet?.account.address;
      if (connected) {
        tonConnectUI.disconnect();
      } else {
        tonConnectUI.openModal();
      }
    },
    sender: {
      send: async (args: SenderArguments) => {
        tonConnectUI.sendTransaction({
          messages: [
            {
              address: args.to.toString(),
              amount: args.value.toString(),
              payload: args.body?.toBoc().toString("base64"),
            },
          ],
          validUntil: Date.now() + 5 * 60 * 1000, // 5 minutes for user to approve
        });
      },
    },
    connected: !!wallet?.account.address,
    wallet: wallet?.account.address ?? null,
    network: wallet?.account.chain ?? null,
  };
}
