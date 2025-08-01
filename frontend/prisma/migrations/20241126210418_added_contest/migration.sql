-- AlterTable
ALTER TABLE "User" ADD COLUMN     "weeklyPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WeeklyScore" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyScore_userId_weekNumber_year_key" ON "WeeklyScore"("userId", "weekNumber", "year");

-- AddForeignKey
ALTER TABLE "WeeklyScore" ADD CONSTRAINT "WeeklyScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
