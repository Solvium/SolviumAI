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

  return <div>Wallet</div>;
};

export default WalletPage;
