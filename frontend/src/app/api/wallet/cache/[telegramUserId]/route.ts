import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptAes256Gcm, parseEncryptionKey } from "@/lib/crypto";

const FILE_NAME = "wallet/cache/[telegramUserId]/route.ts";

export async function GET(
  request: NextRequest,
  { params }: { params: { telegramUserId: string } }
) {
  try {
    const telegramUserId = parseInt(params.telegramUserId);
    const { searchParams } = new URL(request.url);
    const shouldDecrypt = searchParams.get("decrypt") === "1";

    if (!telegramUserId || isNaN(telegramUserId)) {
      console.error(
        `[${FILE_NAME}:GET] Invalid telegramUserId: ${params.telegramUserId}`
      );
      return NextResponse.json(
        { error: "Invalid telegramUserId" },
        { status: 400 }
      );
    }

    // Get wallet from WalletCache table
    const walletCache = await prisma.walletCache.findUnique({
      where: {
        telegramUserId: telegramUserId,
      },
    });

    if (!walletCache) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    let decryptedPrivateKey: string | null = null;

    if (shouldDecrypt) {
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
          walletCache.encryptedPrivateKey,
          walletCache.encryptionIv,
          walletCache.encryptionTag,
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
    }

    const response = {
      id: walletCache.id,
      telegramUserId: walletCache.telegramUserId,
      accountId: walletCache.accountId,
      publicKey: walletCache.publicKey,
      isDemo: walletCache.isDemo,
      network: walletCache.network,
      lastUpdated: walletCache.lastUpdated,
      expiresAt: walletCache.expiresAt,
      encrypted: shouldDecrypt
        ? undefined
        : {
            encryptedPrivateKey: walletCache.encryptedPrivateKey,
            encryptionIv: walletCache.encryptionIv,
            encryptionTag: walletCache.encryptionTag,
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

export async function POST(
  request: NextRequest,
  { params }: { params: { telegramUserId: string } }
) {
  try {
    const telegramUserId = parseInt(params.telegramUserId);
    const body = await request.json();
    const {
      accountId,
      publicKey,
      encryptedPrivateKey,
      encryptionIv,
      encryptionTag,
      isDemo = false,
      network = "testnet",
    } = body;

    if (!telegramUserId || isNaN(telegramUserId)) {
      return NextResponse.json(
        { error: "Invalid telegramUserId" },
        { status: 400 }
      );
    }

    if (
      !accountId ||
      !publicKey ||
      !encryptedPrivateKey ||
      !encryptionIv ||
      !encryptionTag
    ) {
      return NextResponse.json(
        { error: "Missing required wallet fields" },
        { status: 400 }
      );
    }

    // Set expiration to 30 minutes from now
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Upsert wallet cache
    const walletCache = await prisma.walletCache.upsert({
      where: {
        telegramUserId: telegramUserId,
      },
      update: {
        accountId,
        publicKey,
        encryptedPrivateKey,
        encryptionIv,
        encryptionTag,
        isDemo,
        network,
        lastUpdated: new Date(),
        expiresAt,
      },
      create: {
        telegramUserId,
        accountId,
        publicKey,
        encryptedPrivateKey,
        encryptionIv,
        encryptionTag,
        isDemo,
        network,
        lastUpdated: new Date(),
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      walletId: walletCache.id,
      expiresAt: walletCache.expiresAt,
    });
  } catch (error: any) {
    console.error(`[${FILE_NAME}:POST] Internal server error:`, {
      error: error?.message || error,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
