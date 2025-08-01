import React, { useState } from "react";
import { Lightbulb, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PopoverClose, PopoverContent } from "@radix-ui/react-popover";
import { Popover, PopoverTrigger } from "../../ui/popover";

interface HintSystemProps {
  hintCost: number;
  hint: string;
  userCoins: number;
  onUseHint: () => void;
}

const HintSystem: React.FC<HintSystemProps> = ({
  hintCost,
  hint,
  userCoins,
  onUseHint,
}) => {
  const [hintRevealed, setHintRevealed] = useState(false);

  const handleUseHint = () => {
    if (userCoins < hintCost) {
      toast.error("Not enough coins!", {
        description: "Purchase more coins to use hints.",
      });
      return;
    }

    setHintRevealed(true);
    onUseHint();
    toast.success("Hint unlocked!", {
      description: `${hintCost} coins have been deducted.`,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700"
        >
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          Hint
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <h4 className="font-medium">Need a hint?</h4>
            <PopoverClose className="rounded-full p-1 hover:bg-gray-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </PopoverClose>
          </div>

          {hintRevealed ? (
            <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100">
              <p className="text-sm text-yellow-800">{hint}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Stuck? Use {hintCost} coins to get a helpful hint.
              </p>
              <div className="flex justify-between items-center gap-2">
                <div className="text-sm">
                  Your balance:{" "}
                  <span className="font-medium">{userCoins} coins</span>
                </div>
                <Button size="sm" onClick={handleUseHint}>
                  Use {hintCost} coins
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default HintSystem;
