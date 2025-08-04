// app/spin-page/components/SpinPurchase.tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@/app/contexts/AuthContext";

interface PurchaseButtonConfig {
  spinCount: 1 | 2 | 3 | 4;
  solvPrice: number;
}

export default function BuySpin({ setBuySpins }: { setBuySpins: any }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();
  const [solvBalance, setSolvBalance] = useState(0);

  const purchaseOptions: PurchaseButtonConfig[] = [
    { spinCount: 1, solvPrice: 500 },
    { spinCount: 2, solvPrice: 1000 },
    { spinCount: 3, solvPrice: 2000 },
    { spinCount: 4, solvPrice: 4000 },
  ];

  useEffect(() => {
    if (user) {
      setSolvBalance(user.totalPoints);
    }
  }, [user]);

  console.log(isProcessing);
  const handlePurchase = async (config: PurchaseButtonConfig) => {
    setIsProcessing(true);

    try {
      // TODO: Implement claim points with new auth system
      console.log("Buying spins:", config);
      toast.success(`Successfully purchased ${config.spinCount} spin(s)!`);
      setBuySpins(false);
    } catch (error) {
      toast.error(
        `Purchase failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      // setIsProcessing(false);
    }
  };

  return (
    <div className="w-screen  h-screen fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75">
      <div className="p-6 max-w-[350px] relative bg-gray-800 rounded-xl shadow-lg">
        <h2 className="text-xl text-center mt-8 font-bold mb-4 text-white">
          Buy Additional Spins
        </h2>
        <p
          onClick={() => setBuySpins(false)}
          className="bg-[#2ECC71] cursor-pointer font-bold w-fit rounded-[5px] p-2 py-1 absolute top-3 left-2 text-xl"
        >
          x
        </p>

        {isProcessing ? (
          <div className="flex flex-col justify-center items-center h-full">
            <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-2"> Processing...</p>
          </div>
        ) : (
          <div className="space-y-4 items-center flex flex-col">
            {purchaseOptions.map((option) => (
              <button
                key={option.spinCount}
                onClick={() => handlePurchase(option)}
                disabled={isProcessing || solvBalance < option.solvPrice}
                className={`w-full p-4 rounded-lg transition-all
              ${
                solvBalance >= option.solvPrice
                  ? "w-[60%] py-3 bg-[#2ECC71] hover:bg-[#27AE60] text-white font-bold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  : "bg-gray-600 cursor-not-allowed"
              }
              ${isProcessing ? "opacity-75 cursor-wait" : ""}
              flex items-center justify-between text-white`}
              >
                <span>
                  {option.spinCount} Spin{option.spinCount > 1 ? "s" : ""}
                </span>

                <div className="flex items-center gap-2">
                  <span className="font-mono">{option.solvPrice} SOLV</span>
                  {isProcessing && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-t-2 border-white animate-spin rounded-full"></div>
                      <span>Processing...</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 text-sm text-gray-400">
          Available balance: {solvBalance.toLocaleString()} SOLV
        </div>
      </div>
    </div>
  );
}
