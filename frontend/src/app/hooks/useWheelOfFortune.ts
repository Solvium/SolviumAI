// useWheelOfFortune.ts
import { useEffect, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";

interface WheelState {
  isInitialized: boolean;
  backendPubkey: string;
  tokenMint: string;
  totalRewards: number;
  totalSpins: number;
}

interface SpinResult {
  id: string;
  reward: number;
  timestamp: Date;
  txHash?: string;
}

export const useWheelOfFortune = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wheelState, setWheelState] = useState<WheelState | null>(null);
  const [spinHistory, setSpinHistory] = useState<SpinResult[]>([]);

  // Get wheel state from database
  const getWheelState = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/wheel/state`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch wheel state");
      }

      const data = await response.json();
      setWheelState(data.wheelState);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to fetch wheel state"
      );
    } finally {
      setLoading(false);
    }
  };

  // Initialize the wheel of fortune
  const initialize = async (backendPubkey: string, tokenMint: string) => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/wheel/initialize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          backendPubkey,
          tokenMint,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to initialize wheel");
      }

      const data = await response.json();
      setWheelState(data.wheelState);
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to initialize wheel"
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Spin the wheel
  const spinWheel = async () => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/wheel/spin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to spin wheel");
      }

      const data = await response.json();

      // Add spin result to history
      setSpinHistory((prev) => [data.spinResult, ...prev]);

      // Update wheel state
      if (data.wheelState) {
        setWheelState(data.wheelState);
      }

      return data.spinResult;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to spin wheel");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Claim reward
  const claimReward = async (spinId: string) => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/wheel/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spinId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to claim reward");
      }

      const data = await response.json();
      return data.transaction;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to claim reward"
      );
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Add rewards (admin function)
  const addRewards = async (amount: number) => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/wheel/add-rewards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add rewards");
      }

      const data = await response.json();

      // Update wheel state
      if (data.wheelState) {
        setWheelState(data.wheelState);
      }

      return data.transaction;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to add rewards"
      );
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get spin history
  const getSpinHistory = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/wheel/history`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch spin history");
      }

      const data = await response.json();
      setSpinHistory(data.spinHistory);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to fetch spin history"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      getWheelState();
      getSpinHistory();
    }
  }, [user?.id]);

  return {
    // State
    wheelState,
    spinHistory,
    loading,
    error,

    // Actions
    initialize,
    spinWheel,
    claimReward,
    addRewards,
    getWheelState,
    getSpinHistory,

    // Computed
    isConnected: !!user?.id,
    userId: user?.id,
  };
};
