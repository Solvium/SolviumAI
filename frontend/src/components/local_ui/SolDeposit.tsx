// "use client";

import { useState, FormEvent, ChangeEvent, useEffect } from "react";
import {
  Check,
  X,
  ChevronRight,
  Wallet,
  CreditCard,
  Settings,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useUserWallet } from "@/app/hooks/useUserWallet";
import { usePrivateKeyWallet } from "@/app/contexts/PrivateKeyWalletContext";

// Modal component
export function SolDepositModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { sendTransaction, balance } = useUserWallet();
  const { isConnected, accountId, autoConnect } = usePrivateKeyWallet();
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [newFactor, setNewFactor] = useState<string>("");
  const [txSignature, setTxSignature] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"deposit" | "admin" | "info">(
    "deposit"
  );

  const handleDeposit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const amount = parseFloat(depositAmount);
      if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount");
        return;
      }

      const transaction = await sendTransaction("deposit", amount);
      setTxSignature(transaction.id);
      setDepositAmount("");
    } catch (err) {
      console.error("Deposit error:", err);
    }
  };

  const handleWithdraw = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount");
        return;
      }

      const transaction = await sendTransaction("withdraw", amount);
      setTxSignature(transaction.id);
      setWithdrawAmount("");
    } catch (err) {
      console.error("Withdraw error:", err);
    }
  };

  const handleUpdateFactor = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const factor = parseInt(newFactor);
      if (isNaN(factor) || factor <= 0) {
        alert("Please enter a valid factor");
        return;
      }

      // This would be handled by the backend
      console.log("Update factor:", factor);
      setNewFactor("");
    } catch (err) {
      console.error("Update factor error:", err);
    }
  };

  const isOwner = false; // Removed programData?.owner as it's no longer available

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h1 className="text-2xl font-bold">Solvium Multiplier</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="md:w-64 border-r bg-muted/30">
            <div className="p-4">
              {/* Removed WalletMultiButton as it's no longer needed */}
            </div>

            <nav className="px-2 py-4">
              <button
                onClick={() => setActiveTab("deposit")}
                className={cn(
                  "flex items-center w-full px-4 py-3 mb-2 rounded-lg text-left transition-colors",
                  activeTab === "deposit"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <Wallet className="mr-3 h-5 w-5" />
                <span className="font-medium">Deposit</span>
              </button>

              {isOwner && (
                <button
                  onClick={() => setActiveTab("admin")}
                  className={cn(
                    "flex items-center w-full px-4 py-3 mb-2 rounded-lg text-left transition-colors",
                    activeTab === "admin"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <Settings className="mr-3 h-5 w-5" />
                  <span className="font-medium">Admin Controls</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab("info")}
                className={cn(
                  "flex items-center w-full px-4 py-3 mb-2 rounded-lg text-left transition-colors",
                  activeTab === "info"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <CreditCard className="mr-3 h-5 w-5" />
                <span className="font-medium">Info & History</span>
              </button>
            </nav>

            {/* Program Info Summary */}
            {/* Removed programData display as it's no longer available */}
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Error Notification */}
            {/* Error handling is now client-side or handled by useUserWallet */}

            {/* Loading State */}
            {/* Loading state is handled by useUserWallet */}

            {/* Deposit Tab */}
            {activeTab === "deposit" && (
              <div className="space-y-6">
                {/* NEAR Wallet Info */}
                <div className="bg-card border rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm text-muted-foreground mb-1">
                        NEAR Wallet
                      </h3>
                      <p className="font-mono text-sm">
                        {accountId || "Not connected"}
                      </p>
                      {!isConnected && (
                        <button
                          onClick={() => autoConnect()}
                          className="mt-2 text-xs text-primary hover:underline"
                        >
                          Connect NEAR wallet
                        </button>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!accountId) return;
                        try {
                          await navigator.clipboard.writeText(accountId);
                        } catch {
                          const ta = document.createElement("textarea");
                          ta.value = accountId;
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand("copy");
                          document.body.removeChild(ta);
                        }
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="bg-card border rounded-xl p-6 shadow-sm">
                  <h2 className="text-xl font-semibold mb-4">Make a Deposit</h2>
                  <form onSubmit={handleDeposit}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">
                        Amount (SOL)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={depositAmount}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setDepositAmount(e.target.value)
                          }
                          className=" text-black p-2 w-full"
                          placeholder="Enter amount"
                          required
                        />
                      </div>
                    </div>

                    {/* Removed multiplier display as it's no longer available */}

                    <Button
                      type="submit"
                      className="w-full"
                      // Disabled state is handled by useUserWallet
                    >
                      {/* isLoading ? "Processing..." : "Deposit SOL" */}
                      Deposit SOL
                    </Button>
                  </form>
                </div>

                {/* User Deposit Summary */}
                {/* Removed userDeposits display as it's no longer available */}
              </div>
            )}

            {/* Admin Tab */}
            {activeTab === "admin" && isOwner && (
              <div className="space-y-6">
                {/* Withdraw Form */}
                <div className="bg-card border rounded-xl p-6 shadow-sm">
                  <h2 className="text-xl font-semibold mb-4">Withdraw Funds</h2>
                  <form onSubmit={handleWithdraw}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">
                        Amount (SOL)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={withdrawAmount}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setWithdrawAmount(e.target.value)
                          }
                          className="pr-16"
                          placeholder="Enter amount"
                          required
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                          SOL
                        </span>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full"
                      // Disabled state is handled by useUserWallet
                    >
                      {/* isLoading ? "Processing..." : "Withdraw Funds" */}
                      Withdraw Funds
                    </Button>
                  </form>
                </div>

                {/* Update Factor Form */}
                <div className="bg-card border rounded-xl p-6 shadow-sm">
                  <h2 className="text-xl font-semibold mb-4">
                    Update Multiplier Factor
                  </h2>
                  <form onSubmit={handleUpdateFactor}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">
                        New Multiplier Factor
                      </label>
                      <input
                        type="number"
                        value={newFactor}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setNewFactor(e.target.value)
                        }
                        placeholder="Enter new factor"
                        required
                      />
                    </div>
                    {/* Removed multiplier display as it's no longer available */}
                    <Button
                      type="submit"
                      className="w-full"
                      // Disabled state is handled by useUserWallet
                    >
                      {/* isLoading ? "Processing..." : "Update Factor" */}
                      Update Factor
                    </Button>
                  </form>
                </div>
              </div>
            )}

            {/* Info & History Tab */}
            {activeTab === "info" && (
              <div className="space-y-6">
                {/* Program Info */}
                {/* Removed programData display as it's no longer available */}

                {/* User Deposits */}
                {/* Removed userDeposits display as it's no longer available */}
              </div>
            )}

            {/* Not Connected */}
            {/* Removed wallet connection check as we're using database approach */}
            <div className="flex flex-col items-center justify-center h-[40vh]">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold mb-2">
                  Authentication Required
                </h2>
                <p className="text-muted-foreground mb-6">
                  Please log in to use this application
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ErrorNotificationProps {
  message: string;
  onDismiss?: () => void;
  autoClose?: boolean;
  duration?: number;
}

const ErrorNotification = ({
  message,
  onDismiss,
  autoClose = true,
  duration = 5000,
}: ErrorNotificationProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoClose && message) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onDismiss) onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, autoClose, duration, onDismiss]);

  if (!message || !visible) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg shadow-md",
        "bg-destructive/10 border border-destructive/20 text-destructive",
        "animate-in fade-in slide-in-from-top-2 duration-300",
        "w-full"
      )}
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm flex-1">{message}</p>
      {onDismiss && (
        <button
          onClick={() => {
            setVisible(false);
            onDismiss();
          }}
          className="p-1 rounded-full hover:bg-destructive/10"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
