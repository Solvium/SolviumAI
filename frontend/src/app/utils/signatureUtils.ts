// utils/signatureUtils.ts
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

// Create message for signing (same format as the Rust program)
export const createMessageToSign = (
  userPublicKey: PublicKey,
  rewardAmount: number,
  nonce: string
): Uint8Array => {
  const message = `${userPublicKey.toString()}:${rewardAmount}:${nonce}`;
  return new TextEncoder().encode(message);
};

// Parse hex signature to Uint8Array
export const parseHexSignature = (hexSignature: string): Uint8Array => {
  // Remove '0x' prefix if present
  const cleanHex = hexSignature.startsWith("0x")
    ? hexSignature.slice(2)
    : hexSignature;

  // Convert hex to Uint8Array
  const signatureArray = new Uint8Array(64);
  for (let i = 0; i < Math.min(cleanHex.length / 2, 64); i++) {
    signatureArray[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }

  return signatureArray;
};

// Parse base58 signature to Uint8Array
export const parseBase58Signature = (base58Signature: string): Uint8Array => {
  const decoded = bs58.decode(base58Signature);
  if (decoded.length !== 64) {
    throw new Error("Signature must be 64 bytes");
  }
  return decoded;
};

// Verify signature (for client-side validation before sending transaction)
export const verifySignature = (
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean => {
  return nacl.sign.detached.verify(message, signature, publicKey);
};

// Convert a PublicKey to the format needed for Ed25519 verification
export const publicKeyToEd25519PublicKey = (
  publicKey: PublicKey
): Uint8Array => {
  return new Uint8Array(publicKey.toBytes());
};
