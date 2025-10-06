
import React, { useState } from 'react';
import { Coins, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BuyCoinsDialog from './BuyCoinsDialog';

interface CoinBalanceProps {
  balance: number;
  onAddCoins: () => void;
}

const CoinBalance: React.FC<CoinBalanceProps> = ({ balance, onAddCoins }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const handleBuyCoins = (amount: number) => {
    // In a real app, this would connect to payment processing
    setDialogOpen(false);
    onAddCoins();
  };
  
  return (
    <>
      <div className="flex items-center bg-secondary/60 rounded-full px-3 py-1.5 mr-2">
        <Coins className="h-4 w-4 text-game-accent mr-1.5" />
        <span className="text-sm font-medium mr-1">{balance}</span>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-5 w-5 p-0 rounded-full bg-primary/10 hover:bg-primary/20"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-3 w-3" />
          <span className="sr-only">Add Coins</span>
        </Button>
      </div>
      
      <BuyCoinsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onBuyCoins={handleBuyCoins}
      />
    </>
  );
};

export default CoinBalance;
