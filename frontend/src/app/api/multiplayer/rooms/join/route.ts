import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Join a game room
export async function POST(req: Request) {
  try {
    const { roomCode, userId } = await req.json();

    if (!roomCode || !userId) {
      return NextResponse.json(
        { error: "Room code and user ID are required" },
        { status: 400 }
      );
    }

    // Find the room
    const room = await prisma.gameRoom.findUnique({
      where: { roomCode },
      include: {
        players: true,
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status !== "waiting") {
      return NextResponse.json(
        { error: "Room is not accepting new players" },
        { status: 400 }
      );
    }

    // Check if user is already in the room
    const existingPlayer = room.players.find(
      (p) => p.userId === parseInt(userId)
    );
    if (existingPlayer) {
      return NextResponse.json({
        success: true,
        message: "Already in room",
        room: {
          id: room.id,
          roomCode: room.roomCode,
          gameType: room.gameType,
          status: room.status,
        },
      });
    }

    // Check room capacity (max 8 players)
    if (room.players.length >= 8) {
      return NextResponse.json({ error: "Room is full" }, { status: 400 });
    }

    // Add player to room
    const newPlayer = await prisma.roomPlayer.create({
      data: {
        roomId: room.id,
        userId: parseInt(userId),
        status: "joined",
        isReady: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Successfully joined room",
      room: {
        id: room.id,
        roomCode: room.roomCode,
        gameType: room.gameType,
        status: room.status,
      },
    });
  } catch (error) {
    console.error("Join room error:", error);
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
  }
}

