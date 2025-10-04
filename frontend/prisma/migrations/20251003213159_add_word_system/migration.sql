-- CreateTable
CREATE TABLE "public"."words" (
    "id" SERIAL NOT NULL,
    "word" TEXT NOT NULL,
    "length" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "meaning" TEXT,
    "examples" JSONB,
    "synonyms" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."word_usages" (
    "id" SERIAL NOT NULL,
    "wordId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameType" TEXT NOT NULL DEFAULT 'wordle',

    CONSTRAINT "word_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."word_fetch_logs" (
    "id" SERIAL NOT NULL,
    "fetchDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "difficulty" TEXT NOT NULL,
    "wordsCount" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "word_fetch_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "words_word_key" ON "public"."words"("word");

-- CreateIndex
CREATE UNIQUE INDEX "word_usages_wordId_userId_gameType_key" ON "public"."word_usages"("wordId", "userId", "gameType");

-- AddForeignKey
ALTER TABLE "public"."word_usages" ADD CONSTRAINT "word_usages_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "public"."words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."word_usages" ADD CONSTRAINT "word_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
