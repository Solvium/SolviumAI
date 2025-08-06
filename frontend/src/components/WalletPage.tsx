"use client";

import { useState } from "react";
import {
  Wallet,
  Send,
  Download,
  Copy,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Settings,
  History,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const WalletPage = () => {
  const [showBalance, setShowBalance] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  // Mock data for NEAR only
  const walletAddress = "solvium.near";
  const balance = { amount: "125.45", usd: "892.15" };

  const transactions = [
    {
      id: 1,
      type: "receive",
      amount: "25.50",
      token: "NEAR",
      from: "alice.near",
      timestamp: "2 hours ago",
      status: "completed",
    },
    {
      id: 2,
      type: "send",
      amount: "50.00",
      token: "NEAR",
      to: "bob.near",
      timestamp: "1 day ago",
      status: "completed",
    },
    {
      id: 3,
      type: "receive",
      amount: "15.25",
      token: "NEAR",
      from: "charlie.near",
      timestamp: "3 days ago",
      status: "completed",
    },
    {
      id: 4,
      type: "send",
      amount: "100.00",
      token: "NEAR",
      to: "david.near",
      timestamp: "5 days ago",
      status: "completed",
    },
  ];

  const WalletConnectSection = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
    <div className="w-24 h-24 bg-[#1A1A2F] rounded-full flex items-center justify-center border-2 border-[#4C6FFF]">
      <Wallet className="w-12 h-12 text-[#4C6FFF]" />
    </div>
  </div>
);



  return <div>Wallet</div>;
};

export default WalletPage;
