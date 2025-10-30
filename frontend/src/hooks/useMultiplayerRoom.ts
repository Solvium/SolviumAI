import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface Player {
  id: string;
  userId: number;
  username: string;
  status: string;
  isReady: boolean;
}

interface Room {
  id: number;
  roomCode: string;
  gameType: string;
  status: string;
  hostUserId: number;
  players: Player[];
  createdAt: string;
}

export const useMultiplayerRoom = () => {
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create a new room
  const createRoom = useCallback(
    async (gameType: string = "wordle") => {
      if (!user?.id) {
        setError("User not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/multiplayer/rooms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hostUserId: user.id,
            gameType,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to create room");
        }

        setRoom(data.room);
        return data.room;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create room";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  // Join an existing room
  const joinRoom = useCallback(
    async (roomCode: string) => {
      if (!user?.id) {
        setError("User not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/multiplayer/rooms/join", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomCode,
            userId: user.id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to join room");
        }

        // Fetch updated room data
        await fetchRoomStatus(roomCode);
        return data.room;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to join room";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  // Fetch room status
  const fetchRoomStatus = useCallback(async (roomCode: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/multiplayer/rooms?roomCode=${roomCode}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch room status");
      }

      setRoom(data.room);
      return data.room;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch room status";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Leave room
  const leaveRoom = useCallback(() => {
    setRoom(null);
    setError(null);
  }, []);

  // Poll room status for real-time updates
  useEffect(() => {
    if (!room?.roomCode) return;

    const interval = setInterval(() => {
      fetchRoomStatus(room.roomCode);
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [room?.roomCode, fetchRoomStatus]);

  return {
    room,
    loading,
    error,
    createRoom,
    joinRoom,
    fetchRoomStatus,
    leaveRoom,
    isHost: room?.hostUserId === user?.id,
  };
};

