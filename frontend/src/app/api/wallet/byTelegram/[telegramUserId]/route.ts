import { NextRequest, NextResponse } from "next/server";
import { prismaWallet } from "@/lib/prismaWallet";
import { decryptAes256Gcm, parseEncryptionKey } from "@/lib/crypto";

const FILE_NAME = "wallet/byTelegram/[telegramUserId]/route.ts";

export async function GET(
  request: NextRequest,
  { params }: { params: { telegramUserId: string } }
) {
  try {
    const telegramUserId = decodeURIComponent(params.telegramUserId);
    const { searchParams } = new URL(request.url);
    const shouldDecrypt = searchParams.get("decrypt") === "1";

    if (!telegramUserId) {
      console.error(`[${FILE_NAME}:GET] Missing telegramUserId in path`);
      return NextResponse.json(
        { error: "Missing telegramUserId in path" },
        { status: 400 }
      );
    }
    const result: Array<any> = await prismaWallet.$queryRaw`
      SELECT 
        uw.id,
        uw.telegram_user_id,
        uw.account_id,
        uw.public_key,
        uw.is_demo,
        uw.is_active,
        uw.network,
        uw.created_at,
        uw.last_used_at,
        ws.encrypted_private_key,
        ws.encryption_iv,
        ws.encryption_tag
      FROM public.user_wallets uw
      LEFT JOIN public.wallet_security ws ON ws.wallet_id = uw.id
      WHERE uw.telegram_user_id = ${telegramUserId} AND uw.is_active = true
      ORDER BY uw.last_used_at DESC NULLS LAST
      LIMIT 1;
    `;
    if (!result || result.length === 0) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    const row = result[0];
    let decryptedPrivateKey: string | null = null;
    if (
      shouldDecrypt &&
      row.encrypted_private_key &&
      row.encryption_iv &&
      row.encryption_tag
    ) {
      const key = parseEncryptionKey(process.env.WALLET_ENCRYPTION_KEY);
      if (!key) {
        console.error(
          `[${FILE_NAME}:GET] WALLET_ENCRYPTION_KEY not set or invalid`
        );
        return NextResponse.json(
          { error: "WALLET_ENCRYPTION_KEY not set or invalid" },
          { status: 500 }
        );
      }
      try {
        decryptedPrivateKey = decryptAes256Gcm(
          row.encrypted_private_key,
          row.encryption_iv,
          row.encryption_tag,
          key
        );
      } catch (e: any) {
        console.error(`[${FILE_NAME}:GET] Decryption failed:`, {
          error: e?.message || e,
          stack: e?.stack,
        });
        return NextResponse.json(
          { error: `Failed to decrypt private key: ${e?.message || e}` },
          { status: 500 }
        );
      }
    } else {
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
    console.error(`[${FILE_NAME}:GET] Internal server error:`, {
      error: error?.message || error,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
