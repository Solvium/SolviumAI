-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "contests_participated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "experience_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_level_up" TIMESTAMP(3),
ADD COLUMN     "tasks_completed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."user_activities" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "activity_type" TEXT NOT NULL,
    "points_earned" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."level_config" (
    "id" SERIAL NOT NULL,
    "level" INTEGER NOT NULL,
    "points_required" INTEGER NOT NULL,
    "rewards" JSONB,

    CONSTRAINT "level_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "level_config_level_key" ON "public"."level_config"("level");

-- AddForeignKey
ALTER TABLE "public"."user_activities" ADD CONSTRAINT "user_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
