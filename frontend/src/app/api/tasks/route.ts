import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DAILY_LOGIN_SOLV, FIRST_GAME_SOLV } from "@/config/taskConfig";
import { JWTService } from "@/lib/auth/jwt";
import { calculatePointsWithMultiplier } from "@/lib/services/ServerMultiplierService";

export async function GET(request: NextRequest) {
  try {
    // Get user ID from JWT access token or legacy token
    const accessToken = request.cookies.get("accessToken");
    const legacyToken = request.cookies.get("auth_token");

    let userId: string | null = null;

    // Try JWT token first
    if (accessToken) {
      try {
        const payload = JWTService.verifyAccessToken(accessToken.value);
        userId = payload.userId;
        console.log(
          "Tasks API: JWT authentication successful for user:",
          userId
        );
      } catch (error) {
        console.log("Tasks API: JWT verification failed:", error);
        userId = null;
      }
    }

    // Fallback to legacy token
    if (!userId && legacyToken) {
      try {
        const uid = parseInt(legacyToken.value);
        if (!Number.isNaN(uid)) {
          userId = uid.toString();
          console.log(
            "Tasks API: Legacy token authentication successful for user:",
            userId
          );
        }
      } catch (error) {
        console.log("Tasks API: Legacy token verification failed:", error);
        userId = null;
      }
    }

    if (!userId) {
      console.log("Tasks API: No valid authentication token found");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Fetch all tasks
    const tasks = await prisma.task.findMany({
      where: {
        isCompleted: false, // Only show active tasks
      },
      orderBy: {
        points: "desc", // Sort by points descending
      },
    });

    // Fetch user's completed tasks
    const userTasks = await prisma.userTask.findMany({
      where: {
        userId: parseInt(userId), // Convert string to number
      },
      include: {
        task: true,
      },
    });

    return NextResponse.json({
      tasks: tasks,
      userTasks: userTasks,
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user ID from JWT access token or legacy token
    const accessToken = request.cookies.get("accessToken");
    const legacyToken = request.cookies.get("auth_token");

    let userId: string | null = null;

    // Try JWT token first
    if (accessToken) {
      try {
        const payload = JWTService.verifyAccessToken(accessToken.value);
        userId = payload.userId;
        console.log(
          "Tasks POST API: JWT authentication successful for user:",
          userId
        );
      } catch (error) {
        console.log("Tasks POST API: JWT verification failed:", error);
        userId = null;
      }
    }

    // Fallback to legacy token
    if (!userId && legacyToken) {
      try {
        const uid = parseInt(legacyToken.value);
        if (!Number.isNaN(uid)) {
          userId = uid.toString();
          console.log(
            "Tasks POST API: Legacy token authentication successful for user:",
            userId
          );
        }
      } catch (error) {
        console.log("Tasks POST API: Legacy token verification failed:", error);
        userId = null;
      }
    }

    if (!userId) {
      console.log("Tasks POST API: No valid authentication token found");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { username, type, data, userMultipler } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Task type is required" },
        { status: 400 }
      );
    }

    // Handle different task types
    switch (type) {
      case "daily_login":
        // Update user's last login date and streak
        const user = await prisma.user.findUnique({
          where: { id: parseInt(userId) }, // Convert string to number
          select: {
            id: true,
            lastClaim: true,
            claimCount: true,
            wallet: true,
            chatId: true,
          },
        });

        if (!user) {
          return NextResponse.json(
            { error: "User not found" },
            { status: 404 }
          );
        }

        // Resolve accountId for multiplier calculation
        let resolvedAccountId: string | undefined = undefined;
        try {
          const walletJson = (user.wallet || {}) as any;
          resolvedAccountId =
            walletJson?.account_id || walletJson?.accountId || walletJson?.near;
        } catch {}

        // Fallback: try wallet cache via telegram chatId
        if (!resolvedAccountId && user.chatId) {
          try {
            const chatNumeric = parseInt(user.chatId);
            if (!Number.isNaN(chatNumeric)) {
              const walletCache = await prisma.walletCache.findUnique({
                where: { telegramUserId: chatNumeric },
              });
              resolvedAccountId = walletCache?.accountId || undefined;
            }
          } catch (e) {
            console.log("WalletCache lookup failed:", e);
          }
        }

        // Calculate streak (using existing fields)
        const today = new Date();
        const lastLogin = user.lastClaim ? new Date(user.lastClaim) : null;
        // Compute next potential claim (next midnight)
        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 0, 0);
        const msUntilNextClaim = nextMidnight.getTime() - now.getTime();
        console.log(
          "[tasks POST daily_login] lastLogin=",
          lastLogin?.toISOString(),
          " nextPotentialClaim=",
          nextMidnight.toISOString(),
          " timeLeftMs=",
          msUntilNextClaim
        );
        const isConsecutive =
          lastLogin &&
          lastLogin.toDateString() ===
            new Date(today.getTime() - 24 * 60 * 60 * 1000).toDateString();

        // Use claimCount as streak counter for now
        const newStreak = isConsecutive ? (user.claimCount || 0) + 1 : 1;

        // Apply multiplier to daily login bonus using accountId
        const dailyLoginCalculation = await calculatePointsWithMultiplier(
          DAILY_LOGIN_SOLV,
          resolvedAccountId
        );

        const updatedUser = await prisma.user.update({
          where: { id: parseInt(userId) }, // Convert string to number
          data: {
            lastClaim: today,
            claimCount: newStreak,
            totalSOLV: {
              increment: dailyLoginCalculation.totalPoints,
            },
            totalPoints: {
              increment: dailyLoginCalculation.totalPoints,
            },
            weeklyPoints: {
              increment: dailyLoginCalculation.totalPoints,
            },
          },
        });

        return NextResponse.json({
          success: true,
          message: "Daily login recorded",
          streak: newStreak,
          solvEarned: dailyLoginCalculation.totalPoints,
          basePoints: dailyLoginCalculation.basePoints,
          boostAmount: dailyLoginCalculation.boostAmount,
          multiplier: dailyLoginCalculation.multiplier,
          lastLogin: lastLogin?.toISOString(),
          newLogin: today.toISOString(),
          nextClaimAt: nextMidnight.toISOString(),
          timeLeftMs: msUntilNextClaim,
          totalSOLV: updatedUser.totalSOLV,
          claimCount: updatedUser.claimCount,
        });

      case "first_game_completed":
        // Ensure we have a Task record (use name as unique key)
        const firstGameTask = await prisma.task.upsert({
          where: { name: "First Game Reward" },
          update: { points: FIRST_GAME_SOLV },
          create: {
            name: "First Game Reward",
            points: FIRST_GAME_SOLV,
            isCompleted: false,
          },
        });

        // Prevent multiple claims: check if userTask already exists and is completed
        const existingFirstGameClaim = await prisma.userTask.findFirst({
          where: {
            userId: parseInt(userId),
            taskId: firstGameTask.id,
            isCompleted: true,
          },
        });

        if (existingFirstGameClaim) {
          return NextResponse.json({
            success: true,
            message: "First game reward already claimed",
            solvEarned: 0,
            alreadyClaimed: true,
          });
        }

        // Check if user has already played games
        const userForFirstGame = await prisma.user.findUnique({
          where: { id: parseInt(userId) },
          select: { 
            gamesPlayed: true, 
            totalSOLV: true,
            wallet: true,
            chatId: true,
          },
        });

        if (!userForFirstGame) {
          return NextResponse.json(
            { error: "User not found" },
            { status: 404 }
          );
        }

        // Resolve accountId for multiplier calculation
        let firstGameAccountId: string | undefined = undefined;
        try {
          const walletJson = (userForFirstGame.wallet || {}) as any;
          firstGameAccountId =
            walletJson?.account_id || walletJson?.accountId || walletJson?.near;
        } catch {}

        // Fallback: try wallet cache via telegram chatId
        if (!firstGameAccountId && userForFirstGame.chatId) {
          try {
            const chatNumeric = parseInt(userForFirstGame.chatId);
            if (!Number.isNaN(chatNumeric)) {
              const walletCache = await prisma.walletCache.findUnique({
                where: { telegramUserId: chatNumeric },
              });
              firstGameAccountId = walletCache?.accountId || undefined;
            }
          } catch (e) {
            console.log("WalletCache lookup failed:", e);
          }
        }

        // If user has already played games, just award the bonus
        if (userForFirstGame.gamesPlayed > 0) {
          // Apply multiplier to first game bonus using accountId
          const firstGameCalculation = await calculatePointsWithMultiplier(
            FIRST_GAME_SOLV,
            firstGameAccountId
          );

          const updated = await prisma.user.update({
            where: { id: parseInt(userId) },
            data: {
              totalSOLV: {
                increment: firstGameCalculation.totalPoints,
              },
              totalPoints: {
                increment: firstGameCalculation.totalPoints,
              },
              weeklyPoints: {
                increment: firstGameCalculation.totalPoints,
              },
            },
          });

          // Mark claim completed for this task and user
          try {
            await prisma.userTask.create({
              data: {
                userId: parseInt(userId),
                taskId: firstGameTask.id,
                isCompleted: true,
              },
            });
          } catch (e) {
            // If a unique constraint exists, ignore duplicate create
          }

          return NextResponse.json({
            success: true,
            message: "First game completion bonus awarded",
            solvEarned: firstGameCalculation.totalPoints,
            basePoints: firstGameCalculation.basePoints,
            boostAmount: firstGameCalculation.boostAmount,
            multiplier: firstGameCalculation.multiplier,
            alreadyPlayed: true,
            alreadyClaimed: false,
          });
        } else {
          // If user hasn't played games yet, increment gamesPlayed and award bonus
          // Apply multiplier to first game bonus using accountId
          const firstGameCalculation = await calculatePointsWithMultiplier(
            FIRST_GAME_SOLV,
            firstGameAccountId
          );

          const updated = await prisma.user.update({
            where: { id: parseInt(userId) },
            data: {
              gamesPlayed: {
                increment: 1,
              },
              totalSOLV: {
                increment: firstGameCalculation.totalPoints,
              },
              totalPoints: {
                increment: firstGameCalculation.totalPoints,
              },
              weeklyPoints: {
                increment: firstGameCalculation.totalPoints,
              },
            },
          });

          try {
            await prisma.userTask.create({
              data: {
                userId: parseInt(userId),
                taskId: firstGameTask.id,
                isCompleted: true,
              },
            });
          } catch (e) {
            // ignore duplicates
          }

          return NextResponse.json({
            success: true,
            message: "First game completion recorded",
            solvEarned: firstGameCalculation.totalPoints,
            basePoints: firstGameCalculation.basePoints,
            boostAmount: firstGameCalculation.boostAmount,
            multiplier: firstGameCalculation.multiplier,
            alreadyPlayed: false,
            alreadyClaimed: false,
          });
        }

      case "start_task":
        // Mark task as started (in progress) without completing it
        if (!username || !data) {
          return NextResponse.json(
            { error: "Invalid start task payload" },
            { status: 400 }
          );
        }

        // Find task by name
        const startTask = await prisma.task.findFirst({
          where: { name: data.name },
        });
        if (!startTask) {
          return NextResponse.json(
            { error: "Task not found" },
            { status: 404 }
          );
        }

        // Check if already completed
        const existingCompleted = await prisma.userTask.findFirst({
          where: {
            userId: parseInt(userId),
            taskId: startTask.id,
            isCompleted: true,
          },
        });
        if (existingCompleted) {
          return NextResponse.json({ success: true, alreadyClaimed: true });
        }

        // Create or update user task as in progress (not completed)
        await prisma.userTask.upsert({
          where: {
            userId_taskId: {
              userId: parseInt(userId),
              taskId: startTask.id,
            },
          },
          update: {
            isCompleted: false, // Keep as in progress
          },
          create: {
            userId: parseInt(userId),
            taskId: startTask.id,
            isCompleted: false, // Mark as in progress
          },
        });

        return NextResponse.json({
          success: true,
          message: "Task started successfully",
        });

      default:
        // Treat default as social/engagement tasks by name
        // Validate task exists
        if (!username || !data) {
          return NextResponse.json(
            { error: "Invalid social task payload" },
            { status: 400 }
          );
        }

        // Find task by name (type holds the task key from UI)
        const socialTask = await prisma.task.findFirst({
          where: { name: type },
        });
        if (!socialTask) {
          return NextResponse.json(
            { error: "Task not found" },
            { status: 404 }
          );
        }

        // Check existing completion
        const existing = await prisma.userTask.findFirst({
          where: {
            userId: parseInt(userId),
            taskId: socialTask.id,
            isCompleted: true,
          },
        });
        if (existing) {
          return NextResponse.json({ success: true, alreadyClaimed: true });
        }

        // Get user data to resolve accountId for multiplier
        const userForTask = await prisma.user.findUnique({
          where: { id: parseInt(userId) },
          select: {
            wallet: true,
            chatId: true,
          },
        });

        // Resolve accountId for multiplier calculation
        let taskAccountId: string | undefined = undefined;
        if (userForTask) {
          try {
            const walletJson = (userForTask.wallet || {}) as any;
            taskAccountId =
              walletJson?.account_id || walletJson?.accountId || walletJson?.near;
          } catch {}

          // Fallback: try wallet cache via telegram chatId
          if (!taskAccountId && userForTask.chatId) {
            try {
              const chatNumeric = parseInt(userForTask.chatId);
              if (!Number.isNaN(chatNumeric)) {
                const walletCache = await prisma.walletCache.findUnique({
                  where: { telegramUserId: chatNumeric },
                });
                taskAccountId = walletCache?.accountId || undefined;
              }
            } catch (e) {
              console.log("WalletCache lookup failed:", e);
            }
          }
        }

        // Apply multiplier using accountId (same as games)
        const taskCalculation = await calculatePointsWithMultiplier(
          socialTask.points,
          taskAccountId
        );

        // Mark completed and award SOLV with multiplier
        await prisma.userTask.upsert({
          where: {
            userId_taskId: {
              userId: parseInt(userId),
              taskId: socialTask.id,
            },
          },
          update: {
            isCompleted: true,
          },
          create: {
            userId: parseInt(userId),
            taskId: socialTask.id,
            isCompleted: true,
          },
        });
        await prisma.user.update({
          where: { id: parseInt(userId) },
          data: {
            totalSOLV: { increment: taskCalculation.totalPoints },
            totalPoints: { increment: taskCalculation.totalPoints },
            weeklyPoints: { increment: taskCalculation.totalPoints },
          },
        });

        return NextResponse.json({
          success: true,
          solvEarned: taskCalculation.totalPoints,
          basePoints: taskCalculation.basePoints,
          boostAmount: taskCalculation.boostAmount,
          multiplier: taskCalculation.multiplier,
        });
    }
  } catch (error) {
    console.error("Error completing task:", error);
    return NextResponse.json(
      { error: "Failed to complete task" },
      { status: 500 }
    );
  }
}
