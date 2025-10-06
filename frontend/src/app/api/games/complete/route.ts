import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getISOWeekNumber, getCurrentYear } from "@/lib/utils/utils";
import fs from "fs";
import path from "path";

// Word validation function
let wordsSet: Set<string> | null = null;

function loadDictionary(): Set<string> {
  if (wordsSet) return wordsSet;
  const dictPath = path.join(process.cwd(), "src", "lib", "dictionary.json");
  const raw = fs.readFileSync(dictPath, "utf-8");
  const dictionary = JSON.parse(raw);
  // Flatten the dictionary structure
  const allWords = Object.values(dictionary as Record<string, string[]>).flat();
  wordsSet = new Set(allWords.map((w: string) => w.toUpperCase()));
  return wordsSet;
}

function validateWord(word: string): boolean {
  const set = loadDictionary();
  return set.has(word.toUpperCase());
}

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      gameType,
      gameId,
      level,
      difficulty,
      won,
      score,
      completionTime,
      hintUsed,
      hintCost,
      rewards,
      metadata,
    } = await req.json();

    console.log(`🎮 Game Complete API: ${gameType}`, {
      userId,
      gameType,
      gameId,
      level,
      difficulty,
      won,
      score,
      completionTime,
      hintUsed,
      hintCost,
      rewards,
    });

    // Validate input
    if (!userId || !gameType || typeof won !== "boolean") {
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 }
      );
    }

    // For Wordle games, validate the target word if provided
    if (gameType === "wordle" && metadata?.targetWord) {
      const targetWord = metadata.targetWord.replace(/•/g, "").toUpperCase();
      if (targetWord.length > 0 && !validateWord(targetWord)) {
        console.log(
          `❌ Invalid target word in game completion: "${targetWord}"`
        );
        return NextResponse.json(
          { error: "Invalid target word" },
          { status: 400 }
        );
      }
      console.log(`✅ Target word validated: "${targetWord}"`);
    }

    // Calculate expected level based on experience points
    let expectedLevel = Number(level) || 1;
    let totalGamesWon = 0;

    if (won && userId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      totalGamesWon = (currentUser?.gamesWon || 0) + 1;

      // Calculate new experience points after this game
      const newExperiencePoints = (currentUser?.experience_points || 0) + 5;

      // Get level configurations to calculate proper level
      const levelConfigs = await prisma.levelConfig.findMany({
        orderBy: { level: "asc" },
      });

      // Find the correct level based on experience points
      expectedLevel = 1;
      for (let i = levelConfigs.length - 1; i >= 0; i--) {
        if (newExperiencePoints >= levelConfigs[i].points_required) {
          expectedLevel = levelConfigs[i].level;
          break;
        }
      }
    }

    // Save game result to appropriate table based on game type
    let gameResult;
    try {
      switch (gameType) {
        case "wordle":
          gameResult = await prisma.wordleGame.create({
            data: {
              userId: userId,
              dailyId: gameId || `daily_${Date.now()}`,
              level: expectedLevel,
              difficulty: difficulty || "easy",
              won,
              guesses: score || 0,
              completionTime: completionTime || 0,
              hintUsed: hintUsed || false,
              rewards: rewards || 0,
              targetWord: metadata?.targetWord || "",
              playedAt: new Date(),
            },
          });
          break;

        // Future game types will be added here
        // case "puzzle":
        //   gameResult = await prisma.puzzleGame.create({...});
        //   break;
        // case "quiz":
        //   gameResult = await prisma.quizGame.create({...});
        //   break;

        default:
          return NextResponse.json(
            { error: `Unsupported game type: ${gameType}` },
            { status: 400 }
          );
      }

      console.log(`✅ Game result saved to database:`, gameResult.id);
    } catch (error) {
      console.error("Error saving game result:", error);
      return NextResponse.json(
        { error: "Failed to save game result" },
        { status: 500 }
      );
    }

    // Update user stats if game was won
    if (won && userId) {
      // Get user data before update
      const userBefore = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          wordleGames: {
            orderBy: { playedAt: "desc" },
            take: 5,
          },
        },
      });

      console.log("👤 User Data BEFORE Update:", {
        id: userBefore?.id,
        username: userBefore?.username,
        totalSOLV: userBefore?.totalSOLV,
        gamesPlayed: userBefore?.gamesPlayed,
        gamesWon: userBefore?.gamesWon,
        level: userBefore?.level,
        difficulty: userBefore?.difficulty,
      });

      const expectedDifficulty =
        expectedLevel <= 5 ? 1 : expectedLevel <= 10 ? 2 : 3;

      // Calculate final rewards (subtract hint cost if hint was used)
      const finalRewards =
        (rewards || 0) - (hintUsed && hintCost ? hintCost : 0);

      // Update user stats including level progression
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          totalSOLV: {
            increment: finalRewards,
          },
          totalPoints: {
            increment: finalRewards,
          },
          experience_points: {
            increment: 5, // 5 XP per game win
          },
          weeklyPoints: {
            increment: finalRewards,
          },
          gamesPlayed: {
            increment: 1,
          },
          gamesWon: {
            increment: 1,
          },
          level: expectedLevel,
          difficulty: expectedDifficulty,
        },
        include: {
          wordleGames: {
            orderBy: { playedAt: "desc" },
            take: 5,
          },
        },
      });

      // Update weekly score for contests
      const currentWeek = getISOWeekNumber(new Date());
      const currentYear = getCurrentYear();

      await prisma.weeklyScore.upsert({
        where: {
          userId_weekNumber_year: {
            userId: userId,
            weekNumber: currentWeek,
            year: currentYear,
          },
        },
        update: {
          points: {
            increment: finalRewards,
          },
        },
        create: {
          userId: userId,
          weekNumber: currentWeek,
          year: currentYear,
          points: finalRewards,
        },
      });

      // Log activity for game completion
      await prisma.userActivity.create({
        data: {
          userId: userId,
          activity_type: `${gameType.toUpperCase()}_WIN`,
          points_earned: 5, // 5 XP for winning
          metadata: {
            gameType: gameType,
            level: expectedLevel,
            difficulty: difficulty,
            score: score,
            completionTime: completionTime,
            hintUsed: hintUsed,
            hintCost: hintCost || 0,
            solvEarned: finalRewards,
            gameId: gameId,
            ...metadata,
          },
        },
      });

      console.log("👤 User Data AFTER Update:", {
        id: updatedUser.id,
        username: updatedUser.username,
        totalSOLV: updatedUser.totalSOLV,
        totalPoints: updatedUser.totalPoints,
        experience_points: updatedUser.experience_points,
        weeklyPoints: updatedUser.weeklyPoints,
        gamesPlayed: updatedUser.gamesPlayed,
        gamesWon: updatedUser.gamesWon,
        level: updatedUser.level,
        difficulty: updatedUser.difficulty,
        changes: {
          totalSOLVChange: finalRewards,
          totalPointsChange: finalRewards,
          experiencePointsChange: 5,
          weeklyPointsChange: finalRewards,
          gamesPlayedChange: 1,
          gamesWonChange: 1,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Game completed successfully",
        gameResult: {
          id: gameResult.id,
          gameType: gameType,
        },
        userUpdate: {
          levelUp: expectedLevel > (userBefore?.level || 1),
          newLevel: expectedLevel,
          totalGamesWon: totalGamesWon,
          rewardsEarned: finalRewards,
          newBalance: updatedUser.totalSOLV,
        },
      });
    } else if (userId) {
      // Log user data for lost games too
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, totalSOLV: true, level: true },
      });

      // Log activity for game loss
      await prisma.userActivity.create({
        data: {
          userId: userId,
          activity_type: `${gameType.toUpperCase()}_LOSS`,
          points_earned: 0, // No XP for losing
          metadata: {
            gameType: gameType,
            level: level,
            difficulty: difficulty,
            score: score,
            completionTime: completionTime,
            hintUsed: hintUsed,
            hintCost: hintCost || 0,
            gameId: gameId,
            ...metadata,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Game completed (lost)",
        gameResult: {
          id: gameResult.id,
          gameType: gameType,
        },
        userUpdate: {
          levelUp: false,
          newLevel: userData?.level || 1,
          totalGamesWon: 0,
          rewardsEarned: 0,
          newBalance: userData?.totalSOLV || 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Game completed (no user data)",
      gameResult: {
        id: gameResult.id,
        gameType: gameType,
      },
    });
  } catch (error) {
    console.error("Game completion API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
