/*
  Warnings:

  - You are about to drop the column `chain` on the `User` table. All the data in the column will be lost.
  - The `wallet` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `rank` on the `WeeklyScore` table. All the data in the column will be lost.
  - You are about to drop the `LoginMethod` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RateLimit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Wallet` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Task` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."LoginMethod" DROP CONSTRAINT "LoginMethod_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserTask" DROP CONSTRAINT "UserTask_taskId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserTask" DROP CONSTRAINT "UserTask_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Wallet" DROP CONSTRAINT "Wallet_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WeeklyScore" DROP CONSTRAINT "WeeklyScore_userId_fkey";

-- DropIndex
DROP INDEX "public"."User_wallet_key";

-- AlterTable
ALTER TABLE "public"."Task" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "chain",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "referredBy" DROP NOT NULL,
ALTER COLUMN "lastClaim" DROP NOT NULL,
ALTER COLUMN "lastClaim" DROP DEFAULT,
DROP COLUMN "wallet",
ADD COLUMN     "wallet" JSONB,
ALTER COLUMN "puzzleCount" SET DEFAULT 0,
ALTER COLUMN "lastSpinClaim" DROP NOT NULL,
ALTER COLUMN "lastSpinClaim" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."UserTask" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."WeeklyScore" DROP COLUMN "rank",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "public"."LoginMethod";

-- DropTable
DROP TABLE "public"."RateLimit";

-- DropTable
DROP TABLE "public"."Session";

-- DropTable
DROP TABLE "public"."Wallet";

-- CreateTable
CREATE TABLE "public"."wallet_cache" (
    "id" SERIAL NOT NULL,
    "telegramUserId" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "encryptionIv" TEXT NOT NULL,
    "encryptionTag" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "network" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_cache_telegramUserId_key" ON "public"."wallet_cache"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_name_key" ON "public"."Task"("name");

-- AddForeignKey
ALTER TABLE "public"."UserTask" ADD CONSTRAINT "UserTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserTask" ADD CONSTRAINT "UserTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyScore" ADD CONSTRAINT "WeeklyScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
