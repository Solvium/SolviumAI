import { prismaWallet } from "./prismaWallet";
import { decryptAes256Gcm, parseEncryptionKey } from "./crypto";

function parsePrivateKeyBytes(decrypted: string): Uint8Array {
  // Try base64
  try {
    const b64 = Buffer.from(decrypted, "base64");
    if (b64.length === 32 || b64.length === 64) return new Uint8Array(b64);
  } catch {}
  // Try hex
  try {
    const hex = Buffer.from(decrypted, "hex");
    if (hex.length === 32 || hex.length === 64) return new Uint8Array(hex);
  } catch {}
  // Fallback to utf8 bytes
  const raw = Buffer.from(decrypted, "utf8");
  return new Uint8Array(raw);
}

export async function getDecryptedPrivateKeyByAccount(
  accountId: string
): Promise<Uint8Array> {
  const rows: Array<any> = await prismaWallet.$queryRaw`
    SELECT ws.encrypted_private_key, ws.encryption_iv, ws.encryption_tag
    FROM public.user_wallets uw
    JOIN public.wallet_security ws ON ws.wallet_id = uw.id
    WHERE uw.account_id = ${accountId}
    LIMIT 1;
  `;

  if (!rows || rows.length === 0) {
    throw new Error("Wallet not found");
  }
  const row = rows[0];
  const key = parseEncryptionKey(process.env.WALLET_ENCRYPTION_KEY);
  if (!key) {
    throw new Error("WALLET_ENCRYPTION_KEY not set or invalid");
  }
  const decrypted = decryptAes256Gcm(
    row.encrypted_private_key,
    row.encryption_iv,
    row.encryption_tag,
    key
  );
  const bytes = parsePrivateKeyBytes(decrypted);
  // If 64 bytes NEAR-style (priv32 + pub32), take first 32 for signing
  if (bytes.length === 64) return bytes.slice(0, 32);
  if (bytes.length === 32) return bytes;
  throw new Error("Unsupported private key length; expected 32 or 64 bytes");
}

export async function getDecryptedPrivateKeyByTelegramUserId(
  telegramUserId: string
): Promise<Uint8Array> {
  const rows: Array<any> = await prismaWallet.$queryRaw`
    SELECT ws.encrypted_private_key, ws.encryption_iv, ws.encryption_tag
    FROM public.user_wallets uw
    JOIN public.wallet_security ws ON ws.wallet_id = uw.id
    WHERE uw.telegram_user_id = ${telegramUserId} AND uw.is_active = true
    ORDER BY uw.last_used_at DESC NULLS LAST
    LIMIT 1;
  `;

  if (!rows || rows.length === 0) {
    throw new Error("Wallet not found for telegram user");
  }
  const row = rows[0];
  const key = parseEncryptionKey(process.env.WALLET_ENCRYPTION_KEY);
  if (!key) {
    throw new Error("WALLET_ENCRYPTION_KEY not set or invalid");
  }
  const decrypted = decryptAes256Gcm(
    row.encrypted_private_key,
    row.encryption_iv,
    row.encryption_tag,
    key
  );
  const bytes = parsePrivateKeyBytes(decrypted);
  if (bytes.length === 64) return bytes.slice(0, 32);
  if (bytes.length === 32) return bytes;
  throw new Error("Unsupported private key length; expected 32 or 64 bytes");
}
