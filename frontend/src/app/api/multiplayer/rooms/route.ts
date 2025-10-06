import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Create a new game room
export async function POST(req: Request) {
  try {
    const { hostUserId, gameType = "wordle" } = await req.json();

    if (!hostUserId) {
      return NextResponse.json(
        { error: "Host user ID is required" },
        { status: 400 }
      );
    }

    // Generate unique room code
    const roomCode = generateRoomCode();

    // Create the room
    const room = await prisma.gameRoom.create({
      data: {
        roomCode,
        hostUserId: parseInt(hostUserId),
        gameType,
        status: "waiting",
      },
    });

    // Add host as first player
    await prisma.roomPlayer.create({
      data: {
        roomId: room.id,
        userId: parseInt(hostUserId),
        status: "joined",
        isReady: false,
      },
    });

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        roomCode: room.roomCode,
        gameType: room.gameType,
        status: room.status,
        hostUserId: room.hostUserId,
      },
    });
  } catch (error) {
    console.error("Create room error:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}

// Get room status
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const roomCode = searchParams.get("roomCode");

    if (!roomCode) {
      return NextResponse.json(
        { error: "Room code is required" },
        { status: 400 }
      );
    }

    const room = await prisma.gameRoom.findUnique({
      where: { roomCode },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        roomCode: room.roomCode,
        gameType: room.gameType,
        status: room.status,
        hostUserId: room.hostUserId,
        players: room.players.map((player) => ({
          id: player.id,
          userId: player.userId,
          username: player.user.username,
          status: player.status,
          isReady: player.isReady,
        })),
        createdAt: room.createdAt,
      },
    });
  } catch (error) {
    console.error("Get room error:", error);
    return NextResponse.json({ error: "Failed to get room" }, { status: 500 });
  }
}

// Generate unique 6-character room code
function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

