import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { configDotenv } from "dotenv";

configDotenv();

// utils/date-utils.ts
export function getISOWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * Transfers tokens from the backend wallet to a user
 * @param userWallet The user's wallet public key
 * @param amount Amount of tokens to send (in smallest units)
 * @param mintAddress The token mint address
 * @returns Transaction signature
 */
export async function sendTokensToUser(
  userWallet: string,
  amount: number,
  mintAddress: string
): Promise<string> {
  // Initialize connection to Solana
  const connection = new Connection(
    process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    "confirmed"
  );

  // Load backend wallet from keypair file (in production use secure key management)
  const backendKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(process.env.WALLET_KEY ?? ""))
  );

  try {
    // Parse addresses
    const userPublicKey = new PublicKey(userWallet);
    const tokenMint = new PublicKey(mintAddress);

    // Get the backend's token account
    const backendTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      backendKeypair.publicKey
    );

    // Get the user's token account
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      userPublicKey
    );

    // Create transaction
    const transaction = new Transaction();

    // Check if the user's token account exists
    const userAccountInfo = await connection.getAccountInfo(userTokenAccount);

    // If user token account doesn't exist, create it
    if (!userAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          backendKeypair.publicKey, // payer
          userTokenAccount, // associated token account address
          userPublicKey, // owner
          tokenMint // mint
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        backendTokenAccount, // source
        userTokenAccount, // destination
        backendKeypair.publicKey, // owner
        amount * 10 ** 9 // amount
      )
    );

    // Send and confirm transaction
    const txSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [backendKeypair]
    );

    console.log(`Tokens transferred successfully. Signature: ${txSignature}`);
    return txSignature;
  } catch (error) {
    console.error("Error sending tokens:", error);
    throw new Error(`Failed to send tokens: ${error}`);
  }
}

// Express route example
// app.post('/send-tokens', async (req, res) => {
//   try {
//     const { userWallet, amount, mintAddress } = req.body;
//     const signature = await sendTokensToUser(userWallet, amount, mintAddress);
//     res.json({ success: true, signature });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// });
