import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Get user ID from auth token
    const authToken = request.cookies.get("auth_token");

    if (!authToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = parseInt(authToken.value);

    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
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
        userId: userId,
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
