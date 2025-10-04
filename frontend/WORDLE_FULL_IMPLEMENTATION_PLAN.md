# Solvium Wordle - Full Implementation Plan

## 🎯 Overview

This document outlines the complete implementation plan for integrating the Solvium Wordle game with the backend database, implementing random word fetching, and achieving full functionality.

## 📊 Current Status

### ✅ Completed

- [x] Basic Wordle game mechanics
- [x] Frontend validation and UI
- [x] Local storage for game state
- [x] SOLV token integration (replaced coins/points)
- [x] Progressive difficulty system
- [x] Daily limits and streak tracking
- [x] Word fetching package structure
- [x] Basic API endpoints (`/api/wordle/daily`, `/api/wordle/validate`, `/api/wordle/complete`)

### 🔄 Partially Implemented

- [x] API endpoints exist but not fully integrated with database
- [x] Word fetching package created but not integrated
- [x] SOLV rewards system in place but not connected to user accounts

### ❌ Not Implemented

- [ ] Database integration for game results
- [ ] User authentication integration
- [ ] SOLV token persistence
- [ ] Random word fetching integration
- [ ] Activity logging system
- [ ] Leaderboards
- [ ] Anti-cheat measures

## 🗄️ Database Integration

### 1. Prisma Schema Updates

Add the following tables to `prisma/schema.prisma`:

```prisma
model WordleResult {
  id            Int      @id @default(autoincrement())
  userId        Int?
  dailyId       String
  level         Int
  wordLength    Int
  word          String   // Store the actual word for verification
  guesses       Int
  won           Boolean
  completionTime Int?    // in seconds
  hintsUsed     Int      @default(0)
  solvEarned    Int      @default(0)
  createdAt     DateTime @default(now())

  user          User?    @relation(fields: [userId], references: [id])

  @@unique([userId, dailyId, level])
  @@index([dailyId])
  @@index([userId])
}

model WordleStats {
  id              Int      @id @default(autoincrement())
  userId          Int      @unique
  gamesPlayed     Int      @default(0)
  gamesWon        Int      @default(0)
  currentStreak   Int      @default(0)
  bestStreak      Int      @default(0)
  totalSolvEarned Int      @default(0)
  averageGuesses  Float    @default(0)
  fastestTime     Int?     // in seconds
  lastPlayed      DateTime?

  user            User     @relation(fields: [userId], references: [id])

  @@index([userId])
}

model WordleDailyChallenge {
  id          Int      @id @default(autoincrement())
  dailyId     String   @unique
  date        DateTime
  word        String
  level       Int
  wordLength  Int
  difficulty  String   // 'easy', 'medium', 'hard'
  createdAt   DateTime @default(now())

  @@index([dailyId])
  @@index([date])
}

// Update User model to include SOLV balance
model User {
  // ... existing fields ...
  solvBalance    Int      @default(0)
  wordleStats    WordleStats?
  wordleResults  WordleResult[]
}
```

### 2. Database Migration

```bash
npx prisma migrate dev --name add_wordle_tables
npx prisma generate
```

## 🔌 API Integration

### 1. Enhanced Daily API (`/api/wordle/daily/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDailyId, getDailyAnswer } from "@/lib/wordle/service";
import { getDailyWord } from "@/lib/wordle/wordFetcher";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const level = Number(searchParams.get("level") || 1);
  const dailyId = getDailyId();

  try {
    // Check if daily challenge already exists
    let dailyChallenge = await prisma.wordleDailyChallenge.findUnique({
      where: { dailyId },
    });

    if (!dailyChallenge) {
      // Create new daily challenge with random word
      const word = await getDailyWord(dailyId, level);
      const difficulty = level <= 5 ? "easy" : level <= 10 ? "medium" : "hard";

      dailyChallenge = await prisma.wordleDailyChallenge.create({
        data: {
          dailyId,
          date: new Date(),
          word,
          level,
          wordLength: word.length,
          difficulty,
        },
      });
    }

    return NextResponse.json({
      dailyId,
      level,
      length: dailyChallenge.wordLength,
      hardModeEnabled: process.env.WORDLE_HARD_MODE === "true",
      // Don't send the actual word to client
    });
  } catch (error) {
    console.error("Daily API error:", error);
    return NextResponse.json(
      { error: "Failed to get daily challenge" },
      { status: 500 }
    );
  }
}
```

### 2. Enhanced Complete API (`/api/wordle/complete/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    const {
      dailyId,
      level,
      won,
      guesses,
      completionTime,
      hintsUsed,
      solvEarned,
    } = await req.json();

    if (!dailyId || typeof won !== "boolean" || typeof guesses !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid fields" },
        { status: 400 }
      );
    }

    const userId = session?.user?.id ? parseInt(session.user.id) : null;

    // Get the daily challenge
    const dailyChallenge = await prisma.wordleDailyChallenge.findUnique({
      where: { dailyId },
    });

    if (!dailyChallenge) {
      return NextResponse.json(
        { error: "Daily challenge not found" },
        { status: 404 }
      );
    }

    // Store game result
    const result = await prisma.wordleResult.create({
      data: {
        userId,
        dailyId,
        level,
        wordLength: dailyChallenge.wordLength,
        word: dailyChallenge.word,
        guesses,
        won,
        completionTime,
        hintsUsed: hintsUsed || 0,
        solvEarned: solvEarned || 0,
      },
    });

    // Update user stats if logged in
    if (userId) {
      await updateUserStats(userId, won, guesses, completionTime, solvEarned);

      // Update SOLV balance
      await prisma.user.update({
        where: { id: userId },
        data: {
          solvBalance: {
            increment: solvEarned || 0,
          },
        },
      });

      // Log activity
      await logWordleActivity(userId, won, solvEarned, dailyId);
    }

    return NextResponse.json({
      success: true,
      level: Number(level) || 1,
      resultId: result.id,
    });
  } catch (error) {
    console.error("Complete API error:", error);
    return NextResponse.json(
      { error: "Failed to save result" },
      { status: 500 }
    );
  }
}

async function updateUserStats(
  userId: number,
  won: boolean,
  guesses: number,
  completionTime?: number,
  solvEarned?: number
) {
  const stats = await prisma.wordleStats.upsert({
    where: { userId },
    update: {
      gamesPlayed: { increment: 1 },
      gamesWon: won ? { increment: 1 } : undefined,
      currentStreak: won ? { increment: 1 } : 0,
      bestStreak: won ? { increment: 1 } : undefined,
      totalSolvEarned: { increment: solvEarned || 0 },
      lastPlayed: new Date(),
      fastestTime: completionTime ? { min: completionTime } : undefined,
    },
    create: {
      userId,
      gamesPlayed: 1,
      gamesWon: won ? 1 : 0,
      currentStreak: won ? 1 : 0,
      bestStreak: won ? 1 : 0,
      totalSolvEarned: solvEarned || 0,
      lastPlayed: new Date(),
      fastestTime: completionTime,
    },
  });

  // Update best streak if current streak is higher
  if (won && stats.currentStreak > stats.bestStreak) {
    await prisma.wordleStats.update({
      where: { userId },
      data: { bestStreak: stats.currentStreak },
    });
  }
}

async function logWordleActivity(
  userId: number,
  won: boolean,
  solvEarned: number,
  dailyId: string
) {
  // Log to activities table
  await prisma.activity.create({
    data: {
      userId,
      activityType: won ? "WORDLE_WIN" : "WORDLE_PLAY",
      pointsEarned: solvEarned,
      metadata: {
        dailyId,
        won,
        timestamp: new Date().toISOString(),
      },
    },
  });
}
```

### 3. New Words API (`/api/wordle/words/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getHardcodedWords } from "@/lib/wordle/wordFetcher";

export async function POST(req: NextRequest) {
  try {
    const { length, difficulty, count } = await req.json();

    const words = getHardcodedWords({
      length: length || 5,
      difficulty: difficulty || "medium",
      count: count || 1,
    });

    return NextResponse.json({ words });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get words" }, { status: 500 });
  }
}
```

## 🔐 Authentication Integration

### 1. Update WordleGame Component

```typescript
// Add to WordleGame.tsx
import { useSession } from "next-auth/react";

const WordleGame: React.FC = () => {
  const { data: session } = useSession();
  const { config, dailyProgress, updateWordleConfig, updateDailyProgress } =
    useGameConfig();

  // Load user SOLV balance from session
  const [userSOLV, setUserSOLV] = useState(session?.user?.solvBalance || 150);

  // Update SOLV balance when session changes
  useEffect(() => {
    if (session?.user?.solvBalance) {
      setUserSOLV(session.user.solvBalance);
    }
  }, [session]);

  // Rest of component...
};
```

### 2. User SOLV Balance API (`/api/user/solv/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      select: { solvBalance: true },
    });

    return NextResponse.json({ solvBalance: user?.solvBalance || 0 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get SOLV balance" },
      { status: 500 }
    );
  }
}
```

## 🎲 Random Word Integration

### 1. Update Wordle Service

```typescript
// Update src/lib/wordle/service.ts
import { getDailyWord } from "./wordFetcher";

export async function getDailyAnswer(
  dailyId: string,
  level?: number
): Promise<string> {
  // Try to get from database first
  const dailyChallenge = await prisma.wordleDailyChallenge.findUnique({
    where: { dailyId },
  });

  if (dailyChallenge) {
    return dailyChallenge.word;
  }

  // Fallback to word fetcher
  return await getDailyWord(dailyId, level || 1);
}
```

### 2. Environment Variables

Add to `.env.local`:

```env
# Word fetching APIs
NEXT_PUBLIC_API_NINJAS_KEY=your_api_ninjas_key
NEXT_PUBLIC_WORDNIK_KEY=your_wordnik_key

# Wordle settings
WORDLE_SECRET=your_secret_key_for_daily_seeding
WORDLE_HARD_MODE=false
WORDLE_WORD_LEN=5
WORDLE_MAX_GUESSES=6
```

## 📊 Leaderboards

### 1. Leaderboard API (`/api/wordle/leaderboard/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "daily"; // daily, weekly, all-time
  const limit = Number(searchParams.get("limit") || 10);

  try {
    let leaderboard;

    switch (type) {
      case "daily":
        const today = new Date().toISOString().split("T")[0];
        leaderboard = await prisma.wordleResult.findMany({
          where: {
            dailyId: { startsWith: today },
            won: true,
          },
          include: { user: { select: { name: true, avatar: true } } },
          orderBy: [{ completionTime: "asc" }, { guesses: "asc" }],
          take: limit,
        });
        break;

      case "weekly":
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        leaderboard = await prisma.wordleStats.findMany({
          where: {
            lastPlayed: { gte: weekStart },
          },
          include: { user: { select: { name: true, avatar: true } } },
          orderBy: [{ currentStreak: "desc" }, { totalSolvEarned: "desc" }],
          take: limit,
        });
        break;

      case "all-time":
        leaderboard = await prisma.wordleStats.findMany({
          include: { user: { select: { name: true, avatar: true } } },
          orderBy: [{ bestStreak: "desc" }, { totalSolvEarned: "desc" }],
          take: limit,
        });
        break;
    }

    return NextResponse.json({ leaderboard, type });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get leaderboard" },
      { status: 500 }
    );
  }
}
```

### 2. Leaderboard Component

```typescript
// src/components/wordle/Leaderboard.tsx
import React, { useState, useEffect } from "react";

interface LeaderboardEntry {
  id: number;
  user: { name: string; avatar?: string };
  currentStreak?: number;
  bestStreak?: number;
  totalSolvEarned?: number;
  completionTime?: number;
  guesses?: number;
}

export const WordleLeaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [type, setType] = useState<"daily" | "weekly" | "all-time">("daily");

  useEffect(() => {
    fetchLeaderboard();
  }, [type]);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(
        `/api/wordle/leaderboard?type=${type}&limit=10`
      );
      const data = await response.json();
      setLeaderboard(data.leaderboard);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    }
  };

  return (
    <div className="bg-white/10 rounded-lg p-4">
      <h3 className="text-lg font-bold text-white mb-4">Leaderboard</h3>

      <div className="flex gap-2 mb-4">
        {(["daily", "weekly", "all-time"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-3 py-1 rounded text-sm ${
              type === t
                ? "bg-[#1EC7FF] text-white"
                : "bg-white/20 text-gray-300"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {leaderboard.map((entry, index) => (
          <div
            key={entry.id}
            className="flex items-center justify-between bg-white/5 rounded p-2"
          >
            <div className="flex items-center gap-3">
              <span className="text-[#1EC7FF] font-bold">#{index + 1}</span>
              <span className="text-white">{entry.user.name}</span>
            </div>
            <div className="text-right">
              {type === "daily" && (
                <div className="text-sm text-gray-300">
                  {entry.completionTime}s • {entry.guesses} guesses
                </div>
              )}
              {type === "weekly" && (
                <div className="text-sm text-gray-300">
                  🔥 {entry.currentStreak} • {entry.totalSolvEarned} SOLV
                </div>
              )}
              {type === "all-time" && (
                <div className="text-sm text-gray-300">
                  🔥 {entry.bestStreak} • {entry.totalSolvEarned} SOLV
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## 🛡️ Anti-Cheat Measures

### 1. Server-Side Validation

```typescript
// Enhanced validation in /api/wordle/validate/route.ts
export async function POST(req: NextRequest) {
  try {
    const { dailyId, guess, level } = await req.json();

    // Get the actual word from database
    const dailyChallenge = await prisma.wordleDailyChallenge.findUnique({
      where: { dailyId },
    });

    if (!dailyChallenge) {
      return NextResponse.json(
        { error: "Daily challenge not found" },
        { status: 404 }
      );
    }

    // Validate word exists in dictionary
    const isValidWord = await validateWordInDictionary(guess);
    if (!isValidWord) {
      return NextResponse.json({
        valid: false,
        error: "Word not in dictionary",
      });
    }

    // Compute colors server-side
    const colors = computeGuessColors(dailyChallenge.word, guess.toUpperCase());

    return NextResponse.json({
      valid: true,
      colors,
      length: dailyChallenge.wordLength,
    });
  } catch (error) {
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
```

### 2. Rate Limiting

```typescript
// Add rate limiting middleware
import rateLimit from "express-rate-limit";

const wordleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP",
});

// Apply to wordle routes
export { wordleLimiter };
```

## 🚀 Implementation Steps

### Phase 1: Database Setup (Week 1)

1. [ ] Update Prisma schema
2. [ ] Run database migration
3. [ ] Test database connections

### Phase 2: API Integration (Week 1-2)

1. [ ] Implement enhanced daily API
2. [ ] Implement enhanced complete API
3. [ ] Add words API endpoint
4. [ ] Test API endpoints

### Phase 3: Authentication (Week 2)

1. [ ] Integrate user session
2. [ ] Implement SOLV balance API
3. [ ] Update frontend to use authenticated data
4. [ ] Test authentication flow

### Phase 4: Word Fetching (Week 2-3)

1. [ ] Set up external API keys
2. [ ] Integrate word fetcher package
3. [ ] Test word fetching reliability
4. [ ] Implement fallback mechanisms

### Phase 5: Leaderboards (Week 3)

1. [ ] Implement leaderboard API
2. [ ] Create leaderboard component
3. [ ] Add leaderboard to game UI
4. [ ] Test leaderboard functionality

### Phase 6: Anti-Cheat (Week 3-4)

1. [ ] Implement server-side validation
2. [ ] Add rate limiting
3. [ ] Test anti-cheat measures
4. [ ] Monitor for abuse

### Phase 7: Testing & Polish (Week 4)

1. [ ] End-to-end testing
2. [ ] Performance optimization
3. [ ] Bug fixes
4. [ ] Documentation

## 📈 Success Metrics

- [ ] 100% of games saved to database
- [ ] < 2s API response times
- [ ] 99.9% uptime for word fetching
- [ ] Zero successful cheating attempts
- [ ] User engagement metrics (games per day, retention)

## 🔧 Configuration

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# Authentication
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="..."

# Word APIs
NEXT_PUBLIC_API_NINJAS_KEY="..."
NEXT_PUBLIC_WORDNIK_KEY="..."

# Wordle Settings
WORDLE_SECRET="your_secret_key"
WORDLE_HARD_MODE=false
```

### Feature Flags

```typescript
// src/lib/featureFlags.ts
export const FEATURE_FLAGS = {
  WORDLE_ENABLED: process.env.WORDLE_ENABLED === "true",
  WORDLE_LEADERBOARDS: process.env.WORDLE_LEADERBOARDS === "true",
  WORDLE_EXTERNAL_WORDS: process.env.WORDLE_EXTERNAL_WORDS === "true",
  WORDLE_ANTI_CHEAT: process.env.WORDLE_ANTI_CHEAT === "true",
};
```

## 🎯 Next Steps

1. **Immediate**: Update Prisma schema and run migration
2. **This Week**: Implement enhanced APIs with database integration
3. **Next Week**: Add authentication and SOLV balance integration
4. **Following Week**: Implement leaderboards and anti-cheat measures

This plan provides a comprehensive roadmap for achieving full Wordle functionality with proper backend integration, random word fetching, and all the features needed for a production-ready game.
