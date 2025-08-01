/*
  Warnings:

  - You are about to drop the column `difficulty` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `puzzleCount` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `stage` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "difficulty",
DROP COLUMN "puzzleCount",
DROP COLUMN "stage";
