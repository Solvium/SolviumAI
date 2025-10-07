import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prefer Prisma Accelerate/proxy URL if provided to ensure safe pooling in serverless
const datasourceUrl =
  process.env.PRISMA_ACCELERATE_URL || process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
