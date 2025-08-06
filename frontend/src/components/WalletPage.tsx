"use client"

import { useState } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const WalletPage = () => {
  const [selectedNetwork, setSelectedNetwork] = useState("NEAR")
  const [showBalance, setShowBalance] = useState(true)
  const [isConnected, setIsConnected] = useState(false)

  // Mock data
  const walletAddress = "solvium.near"
  const balances = {
    NEAR: { amount: "125.45", usd: "892.15" },
    TON: { amount: "2,340.12", usd: "4,680.24" },
    SOL: { amount: "45.67", usd: "3,654.36" },
  }

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
      amount: "100.00",
      token: "TON",
      to: "bob.ton",
      timestamp: "1 day ago",
      status: "completed",
    },
    {
      id: 3,
      type: "receive",
      amount: "5.25",
      token: "SOL",
      from: "charlie.sol",
      timestamp: "3 days ago",
      status: "completed",
    },
  ]

  const networks = [
    { name: "NEAR", color: "bg-green-500", icon: "🟢" },
    { name: "TON", color: "bg-blue-500", icon: "🔵" },
    { name: "SOL", color: "bg-purple-500", icon: "🟣" },
  ]

  const WalletConnectSection = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
      <div className="w-24 h-24 bg-[#1A1A2F] rounded-full flex items-center justify-center border-2 border-[#4C6FFF]">
        <Wallet className="w-12 h-12 text-[#4C6FFF]" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-white">Connect Your Wallet</h3>
        <p className="text-[#8E8EA8] text-sm max-w-xs">
          Connect your wallet to view balances, send tokens, and manage your assets
        </p>
      </div>
      <div className="space-y-3 w-full max-w-xs">
        {networks.map((network) => (
          <Button
            key={network.name}
            onClick={() => setIsConnected(true)}
            className="w-full bg-[#1A1A2F] hover:bg-[#2A2A45] border border-[#2A2A45] text-white"
          >
            <span className="mr-2">{network.icon}</span>
            Connect {network.name} Wallet
          </Button>
        ))}
      </div>
    </div>
  )

  const WalletHeader = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Wallet</h1>
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

      {/* Network Selector */}
      <div className="flex space-x-2">
        {networks.map((network) => (
          <Button
            key={network.name}
            onClick={() => setSelectedNetwork(network.name)}
            variant={selectedNetwork === network.name ? "default" : "outline"}
            size="sm"
            className={`${
              selectedNetwork === network.name
                ? "bg-[#4C6FFF] text-white"
                : "bg-[#1A1A2F] border-[#2A2A45] text-[#8E8EA8] hover:text-white"
            }`}
          >
            <span className="mr-1">{network.icon}</span>
            {network.name}
          </Button>
        ))}
      </div>
    </div>
  )

  const BalanceCard = () => (
    <Card className="bg-gradient-to-br from-[#1A1A2F] to-[#151524] border-[#2A2A45]">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${networks.find((n) => n.name === selectedNetwork)?.color}`} />
              <span className="text-[#8E8EA8] text-sm">{selectedNetwork} Balance</span>
            </div>
            <Badge variant="secondary" className="bg-[#0B0B14] text-[#4C6FFF]">
              Connected
            </Badge>
          </div>

          <div className="space-y-1">
            <div className="text-3xl font-bold text-white">
              {showBalance
                ? `${balances[selectedNetwork as keyof typeof balances].amount} ${selectedNetwork}`
                : "••••••"}
            </div>
            <div className="text-[#8E8EA8] text-sm">
              {showBalance ? `≈ $${balances[selectedNetwork as keyof typeof balances].usd}` : "••••••"}
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
  )

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
  )

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
        <div className={`font-medium ${transaction.type === "receive" ? "text-green-500" : "text-red-500"}`}>
          {transaction.type === "receive" ? "+" : "-"}
          {transaction.amount} {transaction.token}
        </div>
        <Badge variant="secondary" className="bg-green-500/20 text-green-500 text-xs">
          {transaction.status}
        </Badge>
      </div>
    </div>
  )

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
  )

  const TokensList = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Your Tokens</h3>
      <div className="space-y-3">
        {Object.entries(balances).map(([token, balance]) => (
          <div
            key={token}
            className="flex items-center justify-between p-4 bg-[#1A1A2F] rounded-lg border border-[#2A2A45]"
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  networks.find((n) => n.name === token)?.color
                }`}
              >
                <span className="text-white font-bold text-sm">{token}</span>
              </div>
              <div>
                <div className="text-white font-medium">{token}</div>
                <div className="text-[#8E8EA8] text-sm">
                  {token === "NEAR" ? "NEAR Protocol" : token === "TON" ? "The Open Network" : "Solana"}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-medium">{balance.amount}</div>
              <div className="text-[#8E8EA8] text-sm">${balance.usd}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (!isConnected) {
    return (
      <div className="p-4">
        <WalletConnectSection />
      </div>
    )
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
          <TabsTrigger value="tokens" className="data-[state=active]:bg-[#4C6FFF] data-[state=active]:text-white">
            Tokens
          </TabsTrigger>
        </TabsList>
        <TabsContent value="transactions" className="mt-6">
          <TransactionsSection />
        </TabsContent>
        <TabsContent value="tokens" className="mt-6">
          <TokensList />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default WalletPage
