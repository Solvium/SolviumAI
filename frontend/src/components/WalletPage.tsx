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
const BalanceCard = () => (
  <Card className="bg-gradient-to-br from-[#1A1A2F] to-[#151524] border-[#2A2A45]">
    <CardContent className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-[#8E8EA8] text-sm">NEAR Balance</span>
          </div>
          <Badge variant="secondary" className="bg-[#0B0B14] text-[#4C6FFF]">
            Connected
          </Badge>
        </div>

        <div className="space-y-1">
          <div className="text-3xl font-bold text-white">
            {showBalance ? `${balance.amount} NEAR` : "••••••"}
          </div>
          <div className="text-[#8E8EA8] text-sm">
            {showBalance ? `≈ $${balance.usd} USD` : "••••••"}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2 text-xs text-[#8E8EA8]">
            <Copy className="w-3 h-3" />
            <span className="font-mono">{walletAddress}</span>
          </div>
          <Button variant="ghost" size="sm" className="text-[#8E8EA8] hover:text-white p-1">
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);

const ActionButtons = () => (
  <div className="grid grid-cols-4 gap-3">
    <Button className="flex flex-col items-center space-y-2 h-auto py-4 bg-[#1A1A2F] hover:bg-[#2A2A45] border border-[#2A2A45]">
      <Send className="w-5 h-5 text-[#4C6FFF]" />
      <span className="text-xs text-white">Send</span>
    </Button>
    <Button className="flex flex-col items-center space-y-2 h-auto py-4 bg-[#1A1A2F] hover:bg-[#2A2A45] border border-[#2A2A45]">
      <Download className="w-5 h-5 text-[#4C6FFF]" />
      <span className="text-xs text-white">Receive</span>
    </Button>
    <Button className="flex flex-col items-center space-y-2 h-auto py-4 bg-[#1A1A2F] hover:bg-[#2A2A45] border border-[#2A2A45]">
      <Plus className="w-5 h-5 text-[#4C6FFF]" />
      <span className="text-xs text-white">Buy</span>
    </Button>
    <Button className="flex flex-col items-center space-y-2 h-auto py-4 bg-[#1A1A2F] hover:bg-[#2A2A45] border border-[#2A2A45]">
      <QrCode className="w-5 h-5 text-[#4C6FFF]" />
      <span className="text-xs text-white">Scan</span>
    </Button>
  </div>
);

const TransactionItem = ({ transaction }: { transaction: any }) => (
  <div className="flex items-center justify-between p-4 bg-[#1A1A2F] rounded-lg border border-[#2A2A45]">
    <div className="flex items-center space-x-3">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          transaction.type === "receive" ? "bg-green-500/20" : "bg-red-500/20"
        }`}
      >
        {transaction.type === "receive" ? (
          <ArrowDownLeft className="w-5 h-5 text-green-500" />
        ) : (
          <ArrowUpRight className="w-5 h-5 text-red-500" />
        )}
      </div>
      <div>
        <div className="text-white font-medium">{transaction.type === "receive" ? "Received" : "Sent"}</div>
        <div className="text-[#8E8EA8] text-sm">
          {transaction.type === "receive" ? `From ${transaction.from}` : `To ${transaction.to}`}
        </div>
        <div className="text-[#8E8EA8] text-xs">{transaction.timestamp}</div>
      </div>
    </div>
    <div className="text-right">
      <div
        className={`font-medium ${transaction.type === "receive" ? "text-green-500" : "text-red-500"}`}
      >
        {transaction.type === "receive" ? "+" : "-"}
        {transaction.amount} NEAR
      </div>
      <Badge variant="secondary" className="bg-green-500/20 text-green-500 text-xs">
        {transaction.status}
      </Badge>
    </div>
  </div>
);

const TransactionsSection = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
      <Button variant="ghost" size="sm" className="text-[#4C6FFF]">
        <History className="w-4 h-4 mr-1" />
        View All
      </Button>
    </div>
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <TransactionItem key={transaction.id} transaction={transaction} />
      ))}
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
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-[#1A1A2F] border border-[#2A2A45]">
          <TabsTrigger value="transactions" className="data-[state=active]:bg-[#4C6FFF] data-[state=active]:text-white">
            Transactions
          </TabsTrigger>
          <TabsTrigger value="account" className="data-[state=active]:bg-[#4C6FFF] data-[state=active]:text-white">
            Account
          </TabsTrigger>
        </TabsList>
        <TabsContent value="transactions" className="mt-6">
          <TransactionsSection />
        </TabsContent>
        <TabsContent value="account" className="mt-6">
          {/* <AccountInfo /> */}
        </TabsContent>
      </Tabs>
    </div>
  );
};





export default WalletPage;
