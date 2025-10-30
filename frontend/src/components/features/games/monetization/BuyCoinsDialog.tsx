import React from "react";
import { Coins, Info, CreditCard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CoinPackage {
  id: string;
  amount: number;
  price: string;
  popular?: boolean;
  bonus?: string;
}

interface BuyCoinsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuyCoins: (amount: number) => void;
}

const coinPackages: CoinPackage[] = [
  { id: "small", amount: 100, price: "$0.99", popular: false },
  { id: "medium", amount: 500, price: "$4.99", popular: true },
  { id: "large", amount: 1200, price: "$9.99", popular: false },
  {
    id: "mega",
    amount: 3000,
    price: "$19.99",
    bonus: "+500 FREE",
    popular: false,
  },
];

const BuyCoinsDialog: React.FC<BuyCoinsDialogProps> = ({
  open,
  onOpenChange,
  onBuyCoins,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-game-accent" />
            Buy Game Coins
          </DialogTitle>
          <DialogDescription>
            Game coins let you unlock premium games, get hints, and more!
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {coinPackages.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative rounded-lg border p-4 flex justify-between items-center ${
                pkg.popular ? "border-game-accent bg-game-accent/5" : ""
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-2 -right-2 bg-game-accent text-white text-xs px-2 py-0.5 rounded-full">
                  Best Value
                </div>
              )}
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-game-primary/10 flex items-center justify-center mr-3">
                  <Coins className="w-5 h-5 text-game-accent" />
                </div>
                <div>
                  <p className="font-medium">{pkg.amount} Coins</p>
                  <p className="text-sm text-muted-foreground">{pkg.price}</p>
                  {pkg.bonus && (
                    <p className="text-xs text-game-accent font-medium">
                      {pkg.bonus}
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={() => onBuyCoins(pkg.amount)} size="sm">
                Buy
              </Button>
            </div>
          ))}
        </div>

        <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2 text-sm">
          <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            Purchases are processed securely. Game coins are non-refundable and
            for use within this application only.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="w-4 h-4" />
            Secure Payment
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BuyCoinsDialog;
