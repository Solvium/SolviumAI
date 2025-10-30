-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_referredBy_fkey";

-- DropIndex
DROP INDEX "User_referredBy_idx";
