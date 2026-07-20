import { Server, Socket } from 'socket.io';
import { roomStore, Player } from '../models/roomStore';
import prisma from '../utils/prisma';

export function handleRoom(io: Server, socket: Socket) {
  // Create Room
  socket.on('create_room', async ({
    userId,
    username,
    name,
    gameType,
    type,
    maxPlayers,
    voiceChat,
    allowSpectators,
  }: {
    userId: string;
    username: string;
    name: string;
    gameType: 'RAMUDU_SEETHA' | 'LUDO';
    type: 'PUBLIC' | 'PRIVATE';
    maxPlayers: number;
    voiceChat: boolean;
    allowSpectators: boolean;
  }) => {
    try {
      // Generate alphanumeric 6-digit room code
      let code = '';
      let isUnique = false;
      while (!isUnique) {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
        if (!roomStore.getRoom(code)) isUnique = true;
      }

      // Fetch user profile info (avatar, frames)
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      const hostPlayer: Player = {
        id: userId,
        username: username,
        socketId: socket.id,
        avatar: user?.avatar || 'default_avatar',
        profileFrame: user?.profileFrame || 'default_frame',
        ready: true, // host is ready by default
      };

      const room = roomStore.createRoom(code, {
        code,
        name: name || `${username}'s Room`,
        gameType,
        type,
        maxPlayers: maxPlayers || 4,
        voiceChat: voiceChat || false,
        allowSpectators: allowSpectators || false,
        hostId: userId,
      });

      roomStore.addPlayer(code, hostPlayer);
      socket.join(code);

      socket.emit('room_created', room);
      io.to(code).emit('room_state_updated', room);
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Join Room
  socket.on('join_room', async ({
    roomCode,
    userId,
    username,
  }: {
    roomCode: string;
    userId: string;
    username: string;
  }) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);

      if (!room) {
        return socket.emit('error', 'Room not found');
      }

      if (room.status === 'PLAYING') {
        return socket.emit('error', 'Game already in progress');
      }

      if (room.players.length >= room.maxPlayers) {
        return socket.emit('error', 'Room is full');
      }

      // Fetch user profile info
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      const player: Player = {
        id: userId,
        username: username,
        socketId: socket.id,
        avatar: user?.avatar || 'default_avatar',
        profileFrame: user?.profileFrame || 'default_frame',
        ready: false,
      };

      const updatedRoom = roomStore.addPlayer(upperCode, player);
      if (!updatedRoom) {
        return socket.emit('error', 'Failed to join room');
      }

      socket.join(upperCode);
      socket.emit('room_joined', updatedRoom);
      io.to(upperCode).emit('room_state_updated', updatedRoom);

      // System Message
      io.to(upperCode).emit('chat_message', {
        id: Math.random().toString(),
        senderName: 'SYSTEM',
        content: `${username} joined the room.`,
        createdAt: new Date(),
      });
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Leave Room
  socket.on('leave_room', ({ roomCode, userId }: { roomCode: string; userId: string }) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return;

      const player = room.players.find((p) => p.id === userId);
      const username = player?.username || 'A player';

      const updatedRoom = roomStore.removePlayer(upperCode, userId);
      socket.leave(upperCode);

      if (updatedRoom) {
        io.to(upperCode).emit('room_state_updated', updatedRoom);
        io.to(upperCode).emit('chat_message', {
          id: Math.random().toString(),
          senderName: 'SYSTEM',
          content: `${username} left the room.`,
          createdAt: new Date(),
        });
      } else {
        // Room empty and deleted
        io.to(upperCode).emit('room_deleted');
      }
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Toggle Ready Status
  socket.on('toggle_ready', ({ roomCode, userId, ready }: { roomCode: string; userId: string; ready: boolean }) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');

      const updatedRoom = roomStore.setPlayerReady(upperCode, userId, ready);
      if (updatedRoom) {
        io.to(upperCode).emit('room_state_updated', updatedRoom);
      }
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Chat message in Room
  socket.on('send_room_message', ({ roomCode, senderName, content }: { roomCode: string; senderName: string; content: string }) => {
    const upperCode = roomCode.trim().toUpperCase();
    io.to(upperCode).emit('chat_message', {
      id: Math.random().toString(),
      senderName,
      content,
      createdAt: new Date(),
    });
  });

  // Simple RTC voice chat signaling placeholder
  socket.on('voice_signal', ({ roomCode, targetSocketId, signal }: { roomCode: string; targetSocketId: string; signal: any }) => {
    io.to(targetSocketId).emit('voice_signal_received', {
      senderSocketId: socket.id,
      signal,
    });
  });
}
