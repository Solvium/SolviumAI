import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SimpleWalletProvider } from "@/contexts/SimpleWalletContext";
import { PrivateKeyWalletProvider } from "@/contexts/PrivateKeyWalletContext";
import { GameConfigProvider } from "@/contexts/GameConfigContext";
import { GameProvider } from "@/contexts/GameContext";
import { WalletPortfolioProvider } from "@/contexts/WalletPortfolioContext";
import TelegramProvider from "@/components/providers/TelegramProvider";
import { RefSDKInitializer } from "@/components/providers/RefSDKProvider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Solvium - Gaming Platform",
  description: "Multi-chain gaming platform with rewards and competitions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} max-w-[630px] mx-auto`}>
        <RefSDKInitializer>
          <TelegramProvider>
            <SimpleWalletProvider>
              <AuthProvider>
                <PrivateKeyWalletProvider>
                  <WalletPortfolioProvider>
                    <GameConfigProvider>
                      <GameProvider>
                        {children}
                        <Toaster />
                      </GameProvider>
                    </GameConfigProvider>
                  </WalletPortfolioProvider>
                </PrivateKeyWalletProvider>
              </AuthProvider>
            </SimpleWalletProvider>
          </TelegramProvider>
        </RefSDKInitializer>
      </body>
    </html>
  );
}
