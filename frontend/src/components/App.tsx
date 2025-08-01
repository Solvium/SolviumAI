"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import Script from "next/script";
import { useEffect, useMemo } from "react";
import { WalletProvider as TonWalletProvider } from "@/app/hooks/useNearWallet.context";

import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import "@solana/wallet-adapter-react-ui/styles.css";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  UnsafeBurnerWalletAdapter,
  PhantomWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { MultiLoginProvider } from "@/app/contexts/MultiLoginContext";

const manifestUrl = "https://solvium.xyz/tonconnect-manifest.json";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

export default function App({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Devnet;
  // You can also provide a custom RPC endpoint.
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(() => [], [network]);

  useEffect(() => {
    function sessionStorageSet(key: string, value: string) {
      try {
        window.sessionStorage.setItem(
          "__telegram__" + key,
          JSON.stringify(value)
        );
        return true;
      } catch (e) {}
      return false;
    }

    function sessionStorageGet(key: string) {
      try {
        return JSON.parse(window.sessionStorage.getItem("__telegram__" + key)!);
      } catch (e) {}
      return null;
    }

    const appTgVersion = 7.8;

    let initParams = sessionStorageGet("initParams");
    if (initParams) {
      if (!initParams.tgWebAppVersion) {
        initParams.tgWebAppVersion = appTgVersion;
      }
    } else {
      initParams = {
        tgWebAppVersion: appTgVersion,
      };
    }

    sessionStorageSet("initParams", initParams);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <TonConnectUIProvider manifestUrl={manifestUrl}>
            <QueryClientProvider client={queryClient}>
              <TonWalletProvider>
                <html lang="en">
                  <head>
                    <Script src="https://telegram.org/js/telegram-web-app.js"></Script>
                  </head>
                  <MultiLoginProvider>
                    <body>{children}</body>
                  </MultiLoginProvider>
                </html>
              </TonWalletProvider>
            </QueryClientProvider>
          </TonConnectUIProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
