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
    <div className="text-center space-y-2">
      <h3 className="text-xl font-semibold text-white">Connect Your NEAR Wallet</h3>
      <p className="text-[#8E8EA8] text-sm max-w-xs">
        Connect your NEAR wallet to view balance, send tokens, and manage your assets
      </p>
    </div>
    <div className="space-y-3 w-full max-w-xs">
      <Button
        onClick={() => setIsConnected(true)}
        className="w-full bg-gradient-to-r from-[#4C6FFF] to-[#6B46C1] hover:from-[#3B4FE6] hover:to-[#5A3CB8] text-white font-medium"
      >
        <span className="mr-2">🟢</span>
        Connect NEAR Wallet
      </Button>
      <div className="text-center">
        <p className="text-xs text-[#8E8EA8]">Supports NEAR Wallet, MyNearWallet, and Meteor Wallet</p>
      </div>
    </div>
  </div>
);

const WalletHeader = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-white">NEAR Wallet</h1>
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowBalance(!showBalance)}
          className="text-[#8E8EA8] hover:text-white"
        >
          {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="sm" className="text-[#8E8EA8] hover:text-white">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>

    {/* NEAR Network Badge */}
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-2 px-3 py-1 bg-[#1A1A2F] border border-[#2A2A45] rounded-full">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-sm text-white">NEAR Protocol</span>
      </div>
      <Badge variant="secondary" className="bg-green-500/20 text-green-500">
        Mainnet
      </Badge>
    </div>
  </div>
);









  if (!isConnected) {
    return (
      <div className="p-4">
        <WalletConnectSection />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <WalletHeader />
      <BalanceCard />
      <ActionButtons />
    </div>
  );
};

};

export default WalletPage;
