import { prisma } from "@/lib/prisma";

export interface LevelInfo {
  currentLevel: number;
  nextLevelPoints: number;
  progressPercentage: number;
  pointsToNext: number;
  levelTitle: string;
}

export class LevelService {
  static async calculateLevelInfo(totalPoints: number): Promise<LevelInfo> {
    const levelConfigs = await prisma.levelConfig.findMany({
      orderBy: { level: "asc" },
    });

    let currentLevel = 1;
    let nextLevelPoints = levelConfigs[1]?.points_required || 1000;

    // Find current level
    for (let i = levelConfigs.length - 1; i >= 0; i--) {
      if (totalPoints >= levelConfigs[i].points_required) {
        currentLevel = levelConfigs[i].level;
        nextLevelPoints =
          levelConfigs[i + 1]?.points_required ||
          levelConfigs[i].points_required;
        break;
      }
    }

    const currentLevelPoints =
      levelConfigs.find((l) => l.level === currentLevel)?.points_required || 0;
    const pointsToNext = nextLevelPoints - totalPoints;
    const progressPercentage =
      ((totalPoints - currentLevelPoints) /
        (nextLevelPoints - currentLevelPoints)) *
      100;

    const levelTitle =
      levelConfigs.find((l) => l.level === currentLevel)?.rewards?.title ||
      "Beginner";

    return {
      currentLevel,
      nextLevelPoints,
      progressPercentage: Math.min(progressPercentage, 100),
      pointsToNext,
      levelTitle,
    };
  }

  static async checkLevelUp(
    userId: string,
    newPoints: number
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) return false;

    const oldLevelInfo = await this.calculateLevelInfo(
      user.experience_points - (newPoints - user.experience_points)
    );
    const newLevelInfo = await this.calculateLevelInfo(newPoints);

    if (newLevelInfo.currentLevel > oldLevelInfo.currentLevel) {
      // User leveled up!
      await prisma.user.update({
        where: { id: parseInt(userId) },
        data: {
          level: newLevelInfo.currentLevel,
          last_level_up: new Date(),
        },
      });

      // TODO: Send level up notification
      return true;
    }

    return false;
  }
}
