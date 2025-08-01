import "@twa-dev/sdk";
import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import App from "@/components/App";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Solvium Task Bot",
  description: "Earn with Solvium Tasks on NEAR Blockchain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={spaceGrotesk.className}>
      <body className="bg-[#0B0B14]">
        <App>{children}</App>
      </body>
    </html>
  );
}
