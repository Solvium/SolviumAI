import { PrismaClient } from "@prisma/client";

// Use a separate database URL for wallet tables
const walletDbUrl =
  process.env.WALLET_DATABASE_URL ||
  process.env.PRISMA_ACCELERATE_URL ||
  process.env.DATABASE_URL;

if (!walletDbUrl) {
  console.warn(
    "[prismaWallet] WALLET_DATABASE_URL not set; falling back to DATABASE_URL"
  );
}

const globalForPrismaWallet = globalThis as unknown as {
  prismaWallet: PrismaClient | undefined;
};

export const prismaWallet =
  globalForPrismaWallet.prismaWallet ??
  new PrismaClient({
    datasourceUrl: walletDbUrl,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production")
  globalForPrismaWallet.prismaWallet = prismaWallet;
