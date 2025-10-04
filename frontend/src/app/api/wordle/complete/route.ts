import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getISOWeekNumber, getCurrentYear } from "@/app/utils/utils";

export async function POST(req: NextRequest) {
  try {
    const {
      dailyId,
      won,
      guesses,
      level,
      difficulty,
      completionTime,
      hintUsed,
      rewards,
      targetWord,
      userId,
    } = await req.json();

    console.log("📊 Wordle Game Complete API:", {
      dailyId,
      won,
      guesses,
      level,
      difficulty,
      completionTime,
      hintUsed,
      rewards,
      targetWord: targetWord ? `${targetWord.substring(0, 2)}***` : "none",
      userId,
    });

    if (!dailyId || typeof won !== "boolean" || typeof guesses !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid fields" },
        { status: 400 }
      );
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
      const newExperiencePoints = (currentUser?.experience_points || 0) + 1;

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

    // Save game result to database
    try {
      const gameResult = await prisma.wordleGame.create({
        data: {
          userId: userId || 1,
          dailyId,
          level: expectedLevel, // Use calculated level instead of request level
          difficulty: difficulty || "easy",
          won,
          guesses,
          completionTime: completionTime || 0,
          hintUsed: hintUsed || false,
          rewards: rewards || 0,
          targetWord: targetWord || "",
          playedAt: new Date(),
        },
      });

      console.log("✅ Game result saved to database:", gameResult.id);

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
            wordUsages: {
              take: 10,
            },
          },
        });

        console.log("👤 User Data BEFORE Update:", {
          id: userBefore?.id,
          username: userBefore?.username,
          name: userBefore?.name,
          totalSOLV: userBefore?.totalSOLV,
          gamesPlayed: userBefore?.gamesPlayed,
          gamesWon: userBefore?.gamesWon,
          level: userBefore?.level,
          difficulty: userBefore?.difficulty,
          recentGames: userBefore?.wordleGames?.map((game) => ({
            id: game.id,
            won: game.won,
            level: game.level,
            difficulty: game.difficulty,
            rewards: game.rewards,
            playedAt: game.playedAt,
          })),
          wordUsages: userBefore?.wordUsages?.length || 0,
        });

        const expectedDifficulty =
          expectedLevel <= 5 ? 1 : expectedLevel <= 10 ? 2 : 3;

        // Update user stats including level progression
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            totalSOLV: {
              increment: rewards || 0,
            },
            totalPoints: {
              increment: rewards || 0,
            },
            experience_points: {
              increment: 1, // 1 XP per game win
            },
            weeklyPoints: {
              increment: rewards || 0,
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
            wordUsages: {
              take: 10,
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
              increment: rewards || 0,
            },
          },
          create: {
            userId: userId,
            weekNumber: currentWeek,
            year: currentYear,
            points: rewards || 0,
          },
        });

        // Log activity for Wordle game completion
        await prisma.userActivity.create({
          data: {
            userId: userId,
            activity_type: "WORDLE_WIN",
            points_earned: 1, // 1 XP for winning
            metadata: {
              gameType: "wordle",
              level: expectedLevel,
              difficulty: difficulty,
              guesses: guesses,
              completionTime: completionTime,
              targetWord: targetWord,
              hintUsed: hintUsed,
              solvEarned: rewards || 0, // SOLV earned separately
            },
          },
        });

        console.log("👤 User Data AFTER Update:", {
          id: updatedUser.id,
          username: updatedUser.username,
          name: updatedUser.name,
          totalSOLV: updatedUser.totalSOLV,
          totalPoints: updatedUser.totalPoints,
          experience_points: updatedUser.experience_points,
          weeklyPoints: updatedUser.weeklyPoints,
          gamesPlayed: updatedUser.gamesPlayed,
          gamesWon: updatedUser.gamesWon,
          level: updatedUser.level,
          difficulty: updatedUser.difficulty,
          recentGames: updatedUser.wordleGames?.map((game) => ({
            id: game.id,
            won: game.won,
            level: game.level,
            difficulty: game.difficulty,
            rewards: game.rewards,
            playedAt: game.playedAt,
          })),
          wordUsages: updatedUser.wordUsages?.length || 0,
          changes: {
            totalSOLVChange: rewards || 0,
            totalPointsChange: rewards || 0,
            experiencePointsChange: rewards || 0,
            weeklyPointsChange: rewards || 0,
            gamesPlayedChange: 1,
            gamesWonChange: 1,
          },
        });
      } else if (userId) {
        // Log user data for lost games too
        const userData = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            wordleGames: {
              orderBy: { playedAt: "desc" },
              take: 5,
            },
            wordUsages: {
              take: 10,
            },
          },
        });

        console.log("👤 User Data (Game Lost):", {
          id: userData?.id,
          username: userData?.username,
          name: userData?.name,
          totalSOLV: userData?.totalSOLV,
          gamesPlayed: userData?.gamesPlayed,
          gamesWon: userData?.gamesWon,
          level: userData?.level,
          difficulty: userData?.difficulty,
          recentGames: userData?.wordleGames?.map((game) => ({
            id: game.id,
            won: game.won,
            level: game.level,
            difficulty: game.difficulty,
            rewards: game.rewards,
            playedAt: game.playedAt,
          })),
          wordUsages: userData?.wordUsages?.length || 0,
        });
      }

      return NextResponse.json({
        success: true,
        level: expectedLevel,
        gameId: gameResult.id,
        totalGamesWon: totalGamesWon,
        levelUp: expectedLevel > (Number(level) || 1),
      });
    } catch (dbError) {
      console.error("❌ Database error:", dbError);
      return NextResponse.json(
        { error: "Failed to save game result" },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error("❌ API error:", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
