import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";
import { SimpleWalletProvider } from "@/app/contexts/SimpleWalletContext";
import { PrivateKeyWalletProvider } from "./contexts/PrivateKeyWalletContext";
import { GameConfigProvider } from "./contexts/GameConfigContext";

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
        <SimpleWalletProvider>
          <AuthProvider>
            <PrivateKeyWalletProvider>
              <GameConfigProvider>{children}</GameConfigProvider>
            </PrivateKeyWalletProvider>
          </AuthProvider>
        </SimpleWalletProvider>
      </body>
    </html>
  );
}
