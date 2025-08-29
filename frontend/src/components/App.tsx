"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Script from "next/script";
import { useEffect } from "react";
import { MultiLoginProvider } from "@/app/contexts/MultiLoginContext";
import { SimpleWalletProvider } from "@/app/contexts/SimpleWalletContext";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

export default function App({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    <QueryClientProvider client={queryClient}>
      <html lang="en">
        <head>
          <Script src="https://telegram.org/js/telegram-web-app.js"></Script>
        </head>
        <SimpleWalletProvider>
          <MultiLoginProvider>
            <body>{children}</body>
          </MultiLoginProvider>
        </SimpleWalletProvider>
      </html>
    </QueryClientProvider>
  );
}
