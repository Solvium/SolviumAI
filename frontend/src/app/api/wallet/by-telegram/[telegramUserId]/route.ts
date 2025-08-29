import { NextRequest, NextResponse } from "next/server";
import { prismaWallet } from "@/lib/prismaWallet";
import { decryptAes256Gcm } from "@/lib/crypto";
import crypto from "crypto";

// Test encryption function to verify our key works
function encryptAes256Gcm(
  plaintext: string,
  key: Buffer
): { ciphertext: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { telegramUserId: string } }
) {
  try {
    console.log("params", params);

    const telegramUserId = decodeURIComponent(params.telegramUserId);
    const { searchParams } = new URL(request.url);
    console.log("searchParams", searchParams);
    const shouldDecrypt = true; // searchParams.get("decrypt") === "1";

    if (!telegramUserId) {
      return NextResponse.json(
        { error: "Missing telegramUserId in path" },
        { status: 400 }
      );
    }

    // Mock data for testing - replace with your actual wallet data
    const row = {
      id: 5,
      telegram_user_id: "724141849",
      account_id: "troll5e0b.kindpuma8958.testnet",
      public_key: "ed25519:55AdhjAYJ76bbHZiQoxRYiXFwGD7i9db4EaEHjTW7Hx6",
      is_demo: false,
      is_active: true,
      network: "testnet",
      created_at: new Date("2025-08-24T15:11:05.003Z"),
      last_used_at: new Date("2025-08-24T15:11:05.003Z"),
      encrypted_private_key:
        "JqL3Bq9cEtXmyUv5izy6Jq2xxwXvCOEg1jSLLj/cXRWZDbuC4lBagUuCvRXlY1iWgdObAb+m5SANWmVB2bOM6be/GTjNVgMhSqP/ZdkvHnJmS+K6aNKitdbEqJsIligA",
      encryption_iv: "svzm/B4h5WXW/r1J",
      encryption_tag: "YAYu2qt12BzXq73gtkJAxg==",
    };

    console.log("Using mock wallet data:", {
      telegramUserId,
      accountId: row.account_id,
      hasEncryptedData: !!(
        row.encrypted_private_key &&
        row.encryption_iv &&
        row.encryption_tag
      ),
    });
    console.log("[API] Wallet lookup by TG", {
      telegramUserId,
      hasSecurity: !!row.encrypted_private_key,
    });

    let decryptedPrivateKey: string | null = null;
    if (
      shouldDecrypt &&
      row.encrypted_private_key &&
      row.encryption_iv &&
      row.encryption_tag
    ) {
      // Parse encryption key from environment variable
      const keyInput = process.env.WALLET_ENCRYPTION_KEY;

      if (!keyInput) {
        console.log("❌ WALLET_ENCRYPTION_KEY not set");
        return NextResponse.json(
          { error: "WALLET_ENCRYPTION_KEY not set" },
          { status: 500 }
        );
      }

      // Try different formats to get 32 bytes
      let encryptionKey: Buffer;
      try {
        // Try base64 first
        encryptionKey = Buffer.from(keyInput, "base64");

        // TEST: Try encrypting and decrypting a test message to verify the key works
        console.log("🧪 Testing encryption/decryption with current key...");
        const testMessage = "test-private-key-123";
        const testEncrypted = encryptAes256Gcm(testMessage, encryptionKey);
        const testDecrypted = decryptAes256Gcm(
          testEncrypted.ciphertext,
          testEncrypted.iv,
          testEncrypted.tag,
          encryptionKey
        );
        console.log(
          "🧪 Test encryption/decryption successful:",
          testDecrypted === testMessage
        );
        console.log("🧪 Test decrypted:", testDecrypted);
      } catch (e) {
        console.log("❌ Error parsing encryption key:", e);
        return NextResponse.json(
          { error: "Invalid WALLET_ENCRYPTION_KEY format" },
          { status: 500 }
        );
      }
      try {
        console.log("🔓 Starting decryption...");
        console.log(
          "🔓 Encrypted data length:",
          row.encrypted_private_key.length
        );
        console.log("🔓 IV length:", row.encryption_iv.length);
        console.log("🔓 Tag length:", row.encryption_tag.length);

        // Log the actual values for debugging
        console.log(
          "🔓 Encrypted data (first 50 chars):",
          row.encrypted_private_key.substring(0, 50)
        );
        console.log("🔓 IV:", row.encryption_iv);
        console.log("🔓 Tag:", row.encryption_tag);

        decryptedPrivateKey = decryptAes256Gcm(
          row.encrypted_private_key,
          row.encryption_iv,
          row.encryption_tag,
          encryptionKey
        );

        console.log("✅ Decryption successful!");
        console.log(
          "✅ Decrypted private key length:",
          decryptedPrivateKey.length
        );
        console.log(
          "✅ Decrypted private key preview:",
          decryptedPrivateKey.substring(0, 20) + "..."
        );
        console.log("[API] Decrypted private key for TG user", telegramUserId);
      } catch (e: any) {
        console.log("❌ Decryption failed:", e);
        console.log("❌ Error message:", e?.message);
        console.log("❌ Error stack:", e?.stack);
        return NextResponse.json(
          { error: `Failed to decrypt private key: ${e?.message || e}` },
          { status: 500 }
        );
      }
    }

    const response = {
      id: row.id,
      telegramUserId: row.telegram_user_id,
      accountId: row.account_id,
      publicKey: row.public_key,
      isDemo: row.is_demo,
      isActive: row.is_active,
      network: row.network,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      encrypted: shouldDecrypt
        ? undefined
        : {
            encryptedPrivateKey: row.encrypted_private_key,
            encryptionIv: row.encryption_iv,
            encryptionTag: row.encryption_tag,
          },
      privateKey: decryptedPrivateKey || undefined,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
