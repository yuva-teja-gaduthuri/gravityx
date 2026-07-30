import { Server, Socket } from 'socket.io';
import { roomStore, Player, playerDisconnectTimeouts } from '../models/roomStore';
import prisma from '../utils/prisma';
import { clearRSRoundTimeout } from './ramuduSeethaHandler';

export function handleRoom(io: Server, socket: Socket) {
  // Check active room for reconnection
  socket.on('check_active_room', ({ userId }: { userId: string }) => {
    try {
      const allRooms = roomStore.getAllRooms();
      const activeRoom = allRooms.find((r) => r.players.some((p) => p.id === userId));
      if (activeRoom) {
        socket.emit('active_room_found', { roomCode: activeRoom.code });
      }
    } catch (err: any) {
      console.error('Error checking active room:', err);
    }
  });

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
    timeControl,
  }: {
    userId: string;
    username: string;
    name: string;
    gameType: 'RAMUDU_SEETHA' | 'LUDO' | 'CHESS';
    type: 'PUBLIC' | 'PRIVATE';
    maxPlayers: number;
    voiceChat: boolean;
    allowSpectators: boolean;
    timeControl?: number | 'UNLIMITED';
  }) => {
    try {
      // Check auth
      if (!socket.data.user || socket.data.user.id !== userId) {
        return socket.emit('error', 'Unauthorized room operation');
      }

      // Generate alphanumeric 6-digit room code
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      let isUnique = false;
      while (!isUnique) {
        code = '';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
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
        maxPlayers: gameType === 'CHESS' ? 2 : (maxPlayers || 4),
        voiceChat: voiceChat || false,
        allowSpectators: allowSpectators || false,
        hostId: userId,
        timeControl: timeControl !== undefined ? timeControl : 'UNLIMITED',
      });

      roomStore.addPlayer(code, hostPlayer);
      await socket.join(code);
      await socket.join(userId);

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
    displayName,
    color,
  }: {
    roomCode: string;
    userId: string;
    username: string;
    displayName?: string;
    color?: 'red' | 'green' | 'yellow' | 'blue';
  }) => {
    try {
      // Check auth
      if (!socket.data.user || socket.data.user.id !== userId) {
        return socket.emit('error', 'Unauthorized room operation');
      }

      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);

      if (!room) {
        return socket.emit('error', 'Room not found');
      }

      const existingPlayer = room.players.find((p) => p.id === userId);

      // Bypass PLAYING check if rejoining, otherwise block
      if (room.status === 'PLAYING' && !existingPlayer) {
        return socket.emit('error', 'Game already in progress');
      }

      if (!existingPlayer && room.players.length >= room.maxPlayers) {
        return socket.emit('error', 'Room is full');
      }

      // Cancel any pending disconnect grace timeouts for this user in this room
      const timeoutKey = `${upperCode}_${userId}`;
      if (playerDisconnectTimeouts.has(timeoutKey)) {
        clearTimeout(playerDisconnectTimeouts.get(timeoutKey)!);
        playerDisconnectTimeouts.delete(timeoutKey);
      }

      // Enforce exactly one active socket per player (kick older socket if present)
      if (existingPlayer && existingPlayer.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existingPlayer.socketId);
        if (oldSocket) {
          oldSocket.emit('error', 'You have joined this room from another tab or device.');
          oldSocket.leave(upperCode);
        }
      }

      // Fetch user profile info synchronously before adding to room (eliminates default avatar flash)
      const userProfile = await prisma.user.findUnique({
        where: { id: userId },
      });

      const cleanDisplayName = displayName && displayName.trim() ? displayName.trim().slice(0, 20) : undefined;
      const validColors: ('red' | 'green' | 'yellow' | 'blue')[] = ['red', 'green', 'yellow', 'blue'];
      const reqColor = color && validColors.includes(color) ? color : undefined;

      const player: Player = {
        id: userId,
        username: username,
        displayName: cleanDisplayName || (existingPlayer ? existingPlayer.displayName : undefined),
        color: reqColor || (existingPlayer ? existingPlayer.color : undefined),
        socketId: socket.id,
        avatar: userProfile?.avatar || 'default_avatar',
        profileFrame: userProfile?.profileFrame || 'default_frame',
        ready: existingPlayer ? existingPlayer.ready : false,
      };

      let updatedRoom: any = room;
      const isNewJoin = !existingPlayer;
      if (isNewJoin) {
        updatedRoom = roomStore.addPlayer(upperCode, player);
      } else {
        existingPlayer.socketId = socket.id;
        existingPlayer.disconnected = false; // Mark as active
        if (room.gameState && room.gameState.players) {
          const gp = room.gameState.players.find((p: any) => p.id === userId);
          if (gp) gp.socketId = socket.id;
        }
        existingPlayer.avatar = userProfile?.avatar || existingPlayer.avatar;
        existingPlayer.profileFrame = userProfile?.profileFrame || existingPlayer.profileFrame;
        if (cleanDisplayName) {
          existingPlayer.displayName = cleanDisplayName;
        }
        if (reqColor) {
          const taken = room.players.some(p => p.id !== existingPlayer.id && p.color === reqColor);
          if (!taken) {
            existingPlayer.color = reqColor;
          }
        }
      }

      if (!updatedRoom) {
        return socket.emit('error', 'Failed to join room');
      }

      await socket.join(upperCode);
      await socket.join(userId);
      socket.emit('room_joined', updatedRoom);
      io.to(upperCode).emit('room_state_updated', updatedRoom);

      // System Message - ONLY if player newly joined
      if (isNewJoin) {
        io.to(upperCode).emit('chat_message', {
          id: Math.random().toString(),
          senderName: 'SYSTEM',
          content: `${username} joined the room.`,
          createdAt: new Date(),
        });
      }

      // Asynchronous background profile enrichment to eliminate database loading delays
      prisma.user.findUnique({
        where: { id: userId },
      }).then((user) => {
        if (user) {
          const currentRoom = roomStore.getRoom(upperCode);
          if (currentRoom) {
            const p = currentRoom.players.find((pl) => pl.id === userId);
            if (p) {
              p.avatar = user.avatar;
              p.profileFrame = user.profileFrame;
              io.to(upperCode).emit('room_state_updated', currentRoom);
            }
          }
        }
      }).catch((err) => {
        console.error("Error fetching user profile for socket join:", err);
      });
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Leave Room
  socket.on('leave_room', async ({ roomCode, userId }: { roomCode: string; userId: string }) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return;

      const player = room.players.find((p) => p.id === userId);
      const username = player?.username || 'A player';

      const updatedRoom = roomStore.removePlayer(upperCode, userId);
      await socket.leave(upperCode);

      if (updatedRoom) {
        if (updatedRoom.status === 'LOBBY') {
          clearRSRoundTimeout(upperCode);
        }
        io.to(upperCode).emit('room_state_updated', updatedRoom);
        io.to(upperCode).emit('chat_message', {
          id: Math.random().toString(),
          senderName: 'SYSTEM',
          content: `${username} left the room.`,
          createdAt: new Date(),
        });
      } else {
        // Room empty and deleted
        clearRSRoundTimeout(upperCode);
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

  // Select Ludo Color in Lobby
  socket.on('ludo_select_color', ({ roomCode, color }: { roomCode: string; color: 'red' | 'green' | 'yellow' | 'blue' }) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');
      if (room.status !== 'LOBBY') return socket.emit('error', 'Cannot change color after game starts');

      const player = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!player) return socket.emit('error', 'Player not in room');

      const validColors: ('red' | 'green' | 'yellow' | 'blue')[] = ['red', 'green', 'yellow', 'blue'];
      if (!validColors.includes(color)) return socket.emit('error', 'Invalid color selection');

      const isTaken = room.players.some((p) => p.id !== player.id && p.color === color);
      if (isTaken) return socket.emit('error', `Colour ${color.toUpperCase()} is already selected by another player in this lobby`);

      player.color = color;
      socket.emit('ludo_color_selected', { success: true, color });
      io.to(upperCode).emit('room_state_updated', room);
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Update Ludo Display Name in Lobby
  socket.on('ludo_update_display_name', ({ roomCode, displayName }: { roomCode: string; displayName: string }) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');
      if (room.status !== 'LOBBY') return socket.emit('error', 'Cannot change display name after game starts');

      const player = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!player) return socket.emit('error', 'Player not in room');

      const trimmed = (displayName || '').trim();
      if (!trimmed) return socket.emit('error', 'Display name cannot be empty');
      if (trimmed.length > 20) return socket.emit('error', 'Display name must be 20 characters or less');
      const cleanName = trimmed.slice(0, 20);

      // Check if duplicate name in the same lobby (case-insensitive)
      const isDuplicate = room.players.some(
        (p) => p.id !== player.id && (p.displayName || p.username).toLowerCase() === cleanName.toLowerCase()
      );
      if (isDuplicate) {
        return socket.emit('error', `Name "${cleanName}" is already taken by another player in this lobby`);
      }

      player.displayName = cleanName;
      socket.emit('ludo_display_name_updated', { success: true, displayName: cleanName });
      io.to(upperCode).emit('room_state_updated', room);
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

  // Add Bot Player (triggered by host)
  socket.on('add_bot', ({ roomCode }: { roomCode: string }) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');

      // Only host can add bots
      const host = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can add bots');
      }

      if (room.players.length >= room.maxPlayers) {
        return socket.emit('error', 'Room is full');
      }

      const botNames = ['AlphaBot', 'NovaBot', 'NebulaAI', 'CosmoBot', 'OrbitAI', 'CyberBot'];
      const unusedNames = botNames.filter(name => !room.players.some(p => p.username === name));
      const botName = unusedNames.length > 0 ? unusedNames[Math.floor(Math.random() * unusedNames.length)] : `Bot_${Math.floor(100 + Math.random() * 900)}`;

      const botPlayer: Player = {
        id: `bot_${Math.random().toString(36).substring(2, 9)}`,
        username: botName,
        socketId: 'BOT_SOCKET',
        avatar: 'cyborg',
        profileFrame: 'default_frame',
        ready: true, // Bots are always ready to start
        isBot: true,
      };

      const updatedRoom = roomStore.addPlayer(upperCode, botPlayer);
      if (updatedRoom) {
        io.to(upperCode).emit('room_state_updated', updatedRoom);
        io.to(upperCode).emit('chat_message', {
          id: Math.random().toString(),
          senderName: 'SYSTEM',
          content: `${botName} joined the crew.`,
          createdAt: new Date(),
        });
      }
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // WebRTC voice chat signaling
  socket.on('voice_signal', ({ roomCode, targetSocketId, signal }: { roomCode: string; targetSocketId: string; signal: any }) => {
    const upperCode = roomCode.trim().toUpperCase();
    const roomSockets = io.sockets.adapter.rooms.get(upperCode);
    if (!roomSockets || !roomSockets.has(socket.id) || !roomSockets.has(targetSocketId)) {
      console.warn(`Unauthorized voice signaling bridged from ${socket.id} to ${targetSocketId} for room ${upperCode}`);
      return;
    }

    io.to(targetSocketId).emit('voice_signal_received', {
      senderSocketId: socket.id,
      signal,
    });
  });

  socket.on('join_voice', (roomCode: string) => {
    const upperCode = roomCode.trim().toUpperCase();
    socket.data.inVoice = true;
    socket.data.voiceRoom = upperCode;

    // Find all other sockets in this room that are in voice chat
    const roomSockets = io.sockets.adapter.rooms.get(upperCode);
    const peerSocketIds: string[] = [];
    if (roomSockets) {
      for (const socketId of roomSockets) {
        if (socketId === socket.id) continue;
        const otherSocket = io.sockets.sockets.get(socketId);
        if (otherSocket && otherSocket.data.inVoice) {
          peerSocketIds.push(socketId);
        }
      }
    }

    // Reply to the joining socket with the list of current voice peers
    socket.emit('voice_peers_list', peerSocketIds);

    // Broadcast to other sockets in the room that we joined voice
    socket.to(upperCode).emit('user_joined_voice', {
      socketId: socket.id,
      userId: socket.data.user?.id,
    });
  });

  socket.on('leave_voice', (roomCode: string) => {
    const upperCode = roomCode.trim().toUpperCase();
    socket.data.inVoice = false;
    socket.data.voiceRoom = undefined;
    socket.to(upperCode).emit('user_left_voice', {
      socketId: socket.id,
    });
  });

  socket.on('kick_player', ({ roomCode, userId }: { roomCode: string; userId: string }) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');

      const host = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can kick players');
      }

      const target = room.players.find((p) => p.id === userId);
      if (!target) return socket.emit('error', 'Player not found in room');

      const updatedRoom = roomStore.removePlayer(upperCode, userId);

      io.to(target.socketId).emit('room_kicked', { message: 'You have been kicked by the host.' });

      if (updatedRoom) {
        io.to(upperCode).emit('room_state_updated', updatedRoom);
        io.to(upperCode).emit('chat_message', {
          id: Math.random().toString(),
          senderName: 'SYSTEM',
          content: `${target.username} was kicked by the host.`,
          createdAt: new Date(),
        });
      }
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  socket.on('edit_room_settings', ({ roomCode, type, maxPlayers, voiceChat, allowSpectators, timeControl }: { roomCode: string; type: 'PUBLIC' | 'PRIVATE'; maxPlayers: number; voiceChat: boolean; allowSpectators: boolean; timeControl?: number | 'UNLIMITED' }) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');

      const host = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can edit room settings');
      }

      room.type = type;
      room.maxPlayers = maxPlayers;
      room.voiceChat = voiceChat;
      room.allowSpectators = allowSpectators;
      if (timeControl !== undefined) {
        room.timeControl = timeControl;
      }

      io.to(upperCode).emit('room_state_updated', room);
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  socket.on('delete_room', (roomCode: string) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');

      const host = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can delete the room');
      }

      roomStore.removeRoom(upperCode);
      io.to(upperCode).emit('room_deleted');
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.voiceRoom) {
      io.to(socket.data.voiceRoom).emit('user_left_voice', {
        socketId: socket.id,
      });
    }
  });
}
