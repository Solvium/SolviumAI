import { NextRequest, NextResponse } from "next/server";
import {
  getDecryptedPrivateKeyByAccount,
  getDecryptedPrivateKeyByTelegramUserId,
} from "@/lib/walletServer";
import * as ed from "@noble/ed25519";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, telegramUserId, message } = body || {};

    if ((!accountId && !telegramUserId) || !message) {
      return NextResponse.json(
        { error: "Provide accountId or telegramUserId and message" },
        { status: 400 }
      );
    }

    // Get private key bytes (32 bytes seed)
    const privateKeySeed = accountId
      ? await getDecryptedPrivateKeyByAccount(accountId)
      : await getDecryptedPrivateKeyByTelegramUserId(telegramUserId);

    // Normalize message to bytes
    const messageBytes =
      typeof message === "string"
        ? new TextEncoder().encode(message)
        : new Uint8Array(message);

    const signature = await ed.sign(messageBytes, privateKeySeed);
    const publicKey = await ed.getPublicKey(privateKeySeed);

    return NextResponse.json({
      accountId: accountId ?? null,
      publicKey: Buffer.from(publicKey).toString("base64"),
      signature: Buffer.from(signature).toString("base64"),
      algorithm: "ed25519",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
