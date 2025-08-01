// useWheelOfFortune.ts
import { useEffect, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { IDL, WheelOfFortune } from "../types/wheel_of_fortune";

// "DRBAQHfmMW9QpT6ibNUAUe6FGfVpL8r5Wa6A7ca2pm5U"
const PROGRAM_ID = new PublicKey(
  "6Ee8epax1K1irV8EFqbTzZurW5UGixjRoB46HJrF6Bgp"
);

export const useWheelOfFortune = (connection: Connection) => {
  const { publicKey, signTransaction } = useWallet();
  const [program, setProgram] = useState<Program<WheelOfFortune> | null>(null);
  const [statePDA, setStatePDA] = useState<PublicKey | null>(null);
  const [rewardVaultPDA, setRewardVaultPDA] = useState<PublicKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wheelState, setWheelState] = useState<any>(null);

  useEffect(() => {
    if (connection) {
      try {
        // Create provider
        const provider = new anchor.AnchorProvider(
          connection,
          {
            publicKey:
              publicKey || new PublicKey("11111111111111111111111111111111"),
            signTransaction:
              signTransaction ||
              (async () => {
                throw new Error("Wallet not connected");
              }),
          } as any,
          { commitment: "processed" }
        );

        // Create program instance
        const program = new Program<WheelOfFortune>(IDL, PROGRAM_ID, provider);
        setProgram(program);

        // Derive PDAs
        const [statePDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("state")],
          program.programId
        );

        const [rewardVaultPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("reward_vault")],
          program.programId
        );

        setStatePDA(statePDA);
        setRewardVaultPDA(rewardVaultPDA);
      } catch (err) {
        console.error("Failed to initialize program:", err);
        setError("Failed to initialize Wheel of Fortune program");
      }
    }
  }, [connection, publicKey, signTransaction]);

  // Initialize the wheel of fortune program
  const initialize = async (backendPubkey: PublicKey, tokenMint: PublicKey) => {
    if (!program || !publicKey || !statePDA || !rewardVaultPDA) {
      throw new Error("Program not initialized or wallet not connected");
    }

    setLoading(true);
    setError(null);

    try {
      await program.methods
        .initialize(backendPubkey)
        .accounts({
          state: statePDA,
          tokenMint: tokenMint,
          rewardVault: rewardVaultPDA,
          authority: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      return true;
    } catch (err) {
      console.error("Failed to initialize:", err);
      setError("Failed to initialize Wheel of Fortune");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Claim reward
  const claimReward = async (
    rewardAmount: anchor.BN,
    nonce: string,
    signature: number[],
    userTokenAccount: PublicKey
  ) => {
    if (!program || !publicKey || !statePDA || !rewardVaultPDA) {
      throw new Error("Program not initialized or wallet not connected");
    }

    setLoading(true);
    setError(null);

    console.log({ rewardAmount, nonce, signature, userTokenAccount });
    try {
      const ED25519_PROGRAM_ID = new PublicKey(
        "Ed25519SigVerify111111111111111111111111111"
      );

      await program.methods
        .claimReward(
          rewardAmount,
          nonce,
          signature as any // Convert to the expected format
        )
        .accounts({
          state: statePDA,
          rewardVault: rewardVaultPDA,
          user: publicKey,
          userTokenAccount: userTokenAccount,
          instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          ed25519Program: ED25519_PROGRAM_ID,
          // ed25519Program:
        })
        .rpc();

      return true;
    } catch (err) {
      console.error("Failed to claim reward:", err);
      setError(
        `Failed to claim reward: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Add rewards (admin function)
  const addRewards = async (
    amount: anchor.BN,
    authorityTokenAccount: PublicKey
  ) => {
    if (!program || !publicKey || !statePDA || !rewardVaultPDA) {
      throw new Error("Program not initialized or wallet not connected");
    }

    setLoading(true);
    setError(null);

    try {
      await program.methods
        .addRewards(amount)
        .accounts({
          state: statePDA,
          rewardVault: rewardVaultPDA,
          authority: publicKey,
          authorityTokenAccount: authorityTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      return true;
    } catch (err) {
      console.error("Failed to add rewards:", err);
      setError("Failed to add rewards to Wheel of Fortune");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Helper function to find or create user token account
  const getUserTokenAccount = async (mint: PublicKey) => {
    if (!publicKey) throw new Error("Wallet not connected");

    return await getAssociatedTokenAddress(mint, publicKey, false);
  };

  // Get wheel state data
  useEffect(() => {
    const getWheelState = async () => {
      if (!program || !statePDA) {
        console.log("Program not initialized");
        return;
      }

      try {
        setWheelState(await program.account.wheelState.fetch(statePDA));
      } catch (err) {
        console.error("Failed to fetch wheel state:", err);
        setError("Failed to fetch wheel state");
        return null;
      }
    };
    getWheelState();
  }, [program, statePDA]);

  return {
    program,
    statePDA,
    rewardVaultPDA,
    loading,
    wheelState,
    error,
    initialize,
    claimReward,
    addRewards,
    getUserTokenAccount,
  };
};
