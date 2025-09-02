import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProviderWrapper from "./providers/AuthProviderWrapper";
import { MultiLoginProvider } from "./contexts/MultiLoginContext";
import { SimpleWalletProvider } from "@/app/contexts/SimpleWalletContext";
import { PrivateKeyWalletProvider } from "./contexts/PrivateKeyWalletContext";

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
      <body className={inter.className}>
        <SimpleWalletProvider>
          <AuthProviderWrapper>
            <MultiLoginProvider>
              <PrivateKeyWalletProvider>{children}</PrivateKeyWalletProvider>
            </MultiLoginProvider>
          </AuthProviderWrapper>
        </SimpleWalletProvider>
      </body>
    </html>
  );
}
