import { Server, Socket } from 'socket.io';
import { roomStore, Player } from '../models/roomStore';
import prisma from '../utils/prisma';
import { awardUserStats } from '../utils/gameHelpers';

const ROSTER = [
  'Ramudu',
  'Seetha',
  'Lakshmana',
  'Hanumanthudu',
  'Bharathudu',
  'Shatrugnudu',
  'Jambavanthudu',
  'Sugrivudu',
  'Vibhishana',
  'Angadudu',
];

const CHARACTER_SCORES: { [role: string]: number } = {
  'Ramudu': 1000,
  'Seetha': 0,
  'Lakshmana': 900,
  'Hanumanthudu': 800,
  'Bharathudu': 700,
  'Shatrugnudu': 600,
  'Jambavanthudu': 500,
  'Sugrivudu': 400,
  'Vibhishana': 300,
  'Angadudu': 200,
};

export const roundEndTimeouts = new Map<string, NodeJS.Timeout>();
export const gameplayTimeouts = new Map<string, NodeJS.Timeout>();

export function clearRSRoundTimeout(roomCode: string) {
  const timeout = roundEndTimeouts.get(roomCode);
  if (timeout) {
    clearTimeout(timeout);
    roundEndTimeouts.delete(roomCode);
  }
}

export function clearRSGameplayTimeout(roomCode: string) {
  const timeout = gameplayTimeouts.get(roomCode);
  if (timeout) {
    clearTimeout(timeout);
    gameplayTimeouts.delete(roomCode);
  }
}

export function handleRamuduSeetha(io: Server, socket: Socket) {
  // Helper to end a round with failure
  const endRSRoundWithFailure = async (room: any, reason: 'TIMEOUT' | 'ATTEMPTS') => {
    clearRSGameplayTimeout(room.code);
    if (!room.gameState) return;

    const gameState = room.gameState;
    
    // Scoring Formula for failure (Ramudu fails, Seetha gets max, deities get defense bonus)
    const roundScores: { [userId: string]: number } = {};
    for (const p of room.players) {
      const role = gameState.roles[p.id];
      let score = 0;
      if (role === 'Ramudu') {
        score = 0; // Ramudu failed
      } else if (role === 'Seetha') {
        score = 1000; // Seetha successfully hid
      } else {
        score = CHARACTER_SCORES[role] || 0;
      }
      roundScores[p.id] = score;

      if (!room.sessionScoreboard) {
        room.sessionScoreboard = {};
      }
      if (!room.sessionScoreboard[p.id]) {
        room.sessionScoreboard[p.id] = { username: p.username, score: 0 };
      }
      room.sessionScoreboard[p.id].score += score;
    }

    const isLastRound = room.currentRound! >= room.maxRounds!;
    const countdownDuration = 10;

    // Emit round ended with failure
    io.to(room.code).emit('rs_round_ended', {
      currentRound: room.currentRound,
      maxRounds: room.maxRounds,
      winnerId: '', // No winner
      seethaId: gameState.seethaId,
      guessCount: gameState.guessCount,
      roundScores,
      sessionScoreboard: room.sessionScoreboard,
      countdownDuration,
      won: false,
      isCorrect: false,
      reason,
      roles: gameState.roles,
    });

    if (!isLastRound) {
      clearRSRoundTimeout(room.code);
      const timeout = setTimeout(() => {
        try {
          const r = roomStore.getRoom(room.code);
          if (r && r.status === 'PLAYING') {
            if (r.currentRound! < r.maxRounds!) {
              r.currentRound! += 1;
              startRSRound(r);
            }
          }
        } catch (e) {
          console.error('Error starting next round automatically:', e);
        }
      }, countdownDuration * 1000);
      roundEndTimeouts.set(room.code, timeout);
    } else {
      // Schedule match end after scorecard round info display
      clearRSRoundTimeout(room.code);
      const timeout = setTimeout(async () => {
        await triggerRSMatchEnd(room, false);
      }, countdownDuration * 1000);
      roundEndTimeouts.set(room.code, timeout);
    }
  };

  const triggerRSMatchEnd = async (room: any, isCorrect: boolean) => {
    clearRSRoundTimeout(room.code);
    clearRSGameplayTimeout(room.code);
    if (!room.gameState) return;

    if (!room.sessionScoreboard) {
      room.sessionScoreboard = {};
      room.players.forEach((pl: any) => {
        room.sessionScoreboard![pl.id] = { username: pl.username, score: 0 };
      });
    }

    const finalScoreboard = Object.entries(room.sessionScoreboard)
      .map(([userId, val]: any) => ({
        userId,
        username: val.username,
        score: val.score,
      }))
      .sort((a, b) => b.score - a.score)
      .map((item, index) => {
        const placement = index + 1;
        return {
          ...item,
          placement,
          coinsEarned: placement === 1 ? 150 : placement === 2 ? 100 : 50,
          xpEarned: Math.round(item.score / 5),
        };
      });

    // Record Match in DB & Award stats
    const match = await prisma.match.create({
      data: {
        gameType: 'RAMUDU_SEETHA',
        durationSeconds: 0,
        winnerId: finalScoreboard[0]?.userId || '',
      },
    });

    for (const row of finalScoreboard) {
      if (!row.userId.startsWith('bot_')) {
        await awardUserStats(row.userId, row.xpEarned, row.coinsEarned);
        await prisma.matchPlayer.create({
          data: {
            matchId: match.id,
            userId: row.userId,
            score: row.score,
            coinsEarned: row.coinsEarned,
            placement: row.placement,
          },
        });
      }
    }

    // Broadcast match ended details (keep status as PLAYING so scorecard remains open)
    io.to(room.code).emit('rs_match_ended', {
      winnerId: finalScoreboard[0]?.userId || '',
      seethaId: room.gameState.seethaId,
      guessCount: room.gameState.guessCount,
      scoreboard: finalScoreboard,
      isCorrect,
      roles: room.gameState.roles,
      won: isCorrect,
    });
  };

  // Helper to start a round
  const startRSRound = (room: any) => {
    clearRSRoundTimeout(room.code);
    clearRSGameplayTimeout(room.code);
    
    const playerCount = room.players.length;
    if (playerCount < 3) {
      return io.to(room.code).emit('error', 'Minimum 3 players are required to start');
    }
    if (playerCount > 10) {
      return io.to(room.code).emit('error', 'Maximum 10 players are allowed for Ramudu Seetha');
    }

    // Assign roles randomly from the fixed roster based on player count
    const activeRoles = ROSTER.slice(0, playerCount);
    const shuffledRoles = [...activeRoles].sort(() => Math.random() - 0.5);

    const roles: { [userId: string]: string } = {};
    let ramuduPlayerId = '';
    let seethaPlayerId = '';

    room.players.forEach((p: any, idx: number) => {
      const assignedRole = shuffledRoles[idx];
      roles[p.id] = assignedRole;
      p.role = assignedRole;
      if (assignedRole === 'Ramudu') {
        ramuduPlayerId = p.id;
      } else if (assignedRole === 'Seetha') {
        seethaPlayerId = p.id;
      }
    });

    // Update room state
    room.gameState = {
      roles,
      ramuduId: ramuduPlayerId,
      seethaId: seethaPlayerId,
      guessCount: 0,
      revealedIds: [] as string[],
    };

    room.status = 'PLAYING';

    // Emit game started to all, but only send their OWN role privatised
    room.players.forEach((p: any) => {
      const payload = {
        roomCode: room.code,
        myRole: roles[p.id],
        ramuduId: ramuduPlayerId,
        currentRound: room.currentRound || 1,
        maxRounds: room.maxRounds || 3,
        sessionScoreboard: room.sessionScoreboard,
        players: room.players.map((pl: any) => ({
          id: pl.id,
          username: pl.username,
          avatar: pl.avatar,
          profileFrame: pl.profileFrame,
          isRevealed: false,
        })),
      };
      io.to(p.socketId).emit('rs_game_started', payload);
      if (!p.isBot) {
        io.to(p.id).emit('rs_game_started', payload);
      }
    });

    // Broadcast room update
    io.to(room.code).emit('room_state_updated', {
      ...room,
      players: room.players.map((p: any) => ({ ...p, role: undefined })), // hide roles
    });

    // Start 15-second timer for this round
    const timeout = setTimeout(() => {
      try {
        const r = roomStore.getRoom(room.code);
        if (r && r.status === 'PLAYING') {
          endRSRoundWithFailure(r, 'TIMEOUT');
        }
      } catch (e) {
        console.error('Error in round timer:', e);
      }
    }, 15000);
    gameplayTimeouts.set(room.code, timeout);

    // Check if Ramudu is a bot
    const botRamuduPlayer = room.players.find((pl: any) => pl.id === room.gameState.ramuduId);
    if (botRamuduPlayer && botRamuduPlayer.isBot) {
      triggerRSBotGuess(room);
    }
  };

  // Shared helper to handle guess resolution
  const handleRSGuessResolution = async (room: any, targetUserId: string) => {
    clearRSGameplayTimeout(room.code);
    const gameState = room.gameState;
    if (!gameState) return;

    // Increment guess count
    gameState.guessCount += 1;

    const isSeetha = targetUserId === gameState.seethaId;
    const targetRole = gameState.roles[targetUserId];

    // Mark the guessed player as revealed
    if (!gameState.revealedIds.includes(targetUserId)) {
      gameState.revealedIds.push(targetUserId);
    }

    // Ensure session scoreboard is present
    if (!room.sessionScoreboard) {
      room.sessionScoreboard = {};
      room.players.forEach((pl: any) => {
        room.sessionScoreboard![pl.id] = { username: pl.username, score: 0 };
      });
    }

    // Calculate round scores
    const roundScores: { [userId: string]: number } = {};
    for (const p of room.players) {
      const role = gameState.roles[p.id];
      let score = 0;

      if (isSeetha) {
        // Ramudu wins
        if (role === 'Ramudu') {
          score = 1000;
        } else if (role === 'Seetha') {
          score = 0;
        } else {
          score = CHARACTER_SCORES[role] || 0;
        }
      } else {
        // Ramudu loses, Seetha gets 1000
        if (role === 'Ramudu') {
          score = 0;
        } else if (role === 'Seetha') {
          score = 1000;
        } else {
          score = CHARACTER_SCORES[role] || 0;
        }
      }

      roundScores[p.id] = score;

      if (room.sessionScoreboard[p.id]) {
        room.sessionScoreboard[p.id].score += score;
      }
    }

    const isLastRound = room.currentRound! >= room.maxRounds!;
    const countdownDuration = 10; // 10 seconds countdown

    if (!isLastRound) {
      // Send round ended results
      io.to(room.code).emit('rs_round_ended', {
        currentRound: room.currentRound,
        maxRounds: room.maxRounds,
        winnerId: isSeetha ? gameState.ramuduId : null,
        seethaId: gameState.seethaId,
        guessCount: gameState.guessCount,
        roundScores,
        sessionScoreboard: room.sessionScoreboard,
        countdownDuration,
        isCorrect: isSeetha,
        roles: gameState.roles, // send all roles to reveal them on round end
        won: isSeetha,
      });

      // Set automatic next round timeout
      clearRSRoundTimeout(room.code);
      const timeout = setTimeout(() => {
        try {
          const r = roomStore.getRoom(room.code);
          if (r && r.status === 'PLAYING') {
            if (r.currentRound! < r.maxRounds!) {
              r.currentRound! += 1;
              startRSRound(r);
            }
          }
        } catch (e) {
          console.error('Error starting next round automatically:', e);
        }
      }, countdownDuration * 1000);

      roundEndTimeouts.set(room.code, timeout);
    } else {
      // Final round finished! Grand Finale.
      // Emit round ended first, then wait 10 seconds to show match ended results
      io.to(room.code).emit('rs_round_ended', {
        currentRound: room.currentRound,
        maxRounds: room.maxRounds,
        winnerId: isSeetha ? gameState.ramuduId : null,
        seethaId: gameState.seethaId,
        guessCount: gameState.guessCount,
        roundScores,
        sessionScoreboard: room.sessionScoreboard,
        countdownDuration,
        isCorrect: isSeetha,
        roles: gameState.roles,
        won: isSeetha,
      });

      clearRSRoundTimeout(room.code);
      const timeout = setTimeout(async () => {
        await triggerRSMatchEnd(room, isSeetha);
      }, countdownDuration * 1000);
      roundEndTimeouts.set(room.code, timeout);
    }
  };

  // Start Game (triggered by host)
  socket.on('rs_start_game', async (payload: string | { roomCode: string; maxRounds: number }) => {
    try {
      const roomCode = typeof payload === 'string' ? payload : payload.roomCode;
      const maxRounds = typeof payload === 'string' ? 3 : (payload.maxRounds || 3);
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');

      // Check permissions
      const host = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can start the game');
      }

      // Initialize session variables
      room.currentRound = 1;
      room.maxRounds = maxRounds;
      room.sessionScoreboard = {};
      room.players.forEach((pl) => {
        room.sessionScoreboard![pl.id] = { username: pl.username, score: 0 };
      });

      startRSRound(room);
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Next Round (triggered by host after a round ends)
  socket.on('rs_next_round', async (roomCode: string) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room || room.status !== 'PLAYING') return socket.emit('error', 'Room not found or game inactive');

      // Check host permissions
      const host = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can advance rounds');
      }

      if (room.currentRound! < room.maxRounds!) {
        room.currentRound! += 1;
        startRSRound(room);
      } else {
        socket.emit('error', 'Game session already completed');
      }
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Show final scorecard immediately
  socket.on('rs_show_final_scorecard', async (roomCode: string) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');

      const host = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can show final scorecard');
      }

      await triggerRSMatchEnd(room, room.gameState?.guessCount > 0 ? (room.gameState?.revealedIds.includes(room.gameState?.seethaId)) : false);
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Ramudu guesses player role
  socket.on('rs_guess', async ({ roomCode, targetUserId }: { roomCode: string; targetUserId: string }) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room || room.status !== 'PLAYING') return socket.emit('error', 'Game not active');

      const gameState = room.gameState;
      if (!gameState) return socket.emit('error', 'Game state missing');

      // Validate guesser is Ramudu
      const guesser = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!guesser || guesser.id !== gameState.ramuduId) {
        return socket.emit('error', 'Only Ramudu can make guesses');
      }

      // Sync socket ID if changed
      if (guesser.socketId !== socket.id) {
        guesser.socketId = socket.id;
      }

      // Enforce strict one-guess attempt
      if (gameState.guessCount > 0) {
        return socket.emit('error', 'Ramudu has already used his only chance.');
      }

      await handleRSGuessResolution(room, targetUserId);
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Return to Lobby (triggered by host after match ends)
  socket.on('rs_return_to_lobby', (roomCode: string) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');

      // Verify host permissions
      const host = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can return the room to lobby');
      }

      clearRSRoundTimeout(upperCode);
      clearRSGameplayTimeout(upperCode);

      // Return room status to lobby
      roomStore.updateRoomStatus(upperCode, 'LOBBY');
      room.players.forEach((p) => {
        p.ready = false;
        p.role = undefined;
      });
      room.gameState = null;

      // Broadcast room status update
      io.to(upperCode).emit('room_state_updated', room);
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Synchronize state for late joiners or reconnects
  socket.on('rs_sync_state', (roomCode: string) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room || room.status !== 'PLAYING' || !room.gameState) return;

      const player = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!player) return;

      // Sync socket ID if changed
      if (player.socketId !== socket.id) {
        player.socketId = socket.id;
      }

      socket.emit('rs_game_started', {
        roomCode: upperCode,
        myRole: room.gameState.roles[player.id],
        ramuduId: room.gameState.ramuduId,
        currentRound: room.currentRound || 1,
        maxRounds: room.maxRounds || 3,
        sessionScoreboard: room.sessionScoreboard || {},
        players: room.players.map((pl) => ({
          id: pl.id,
          username: pl.username,
          avatar: pl.avatar,
          profileFrame: pl.profileFrame,
          isRevealed: room.gameState.revealedIds.includes(pl.id),
          role: room.gameState.revealedIds.includes(pl.id) ? room.gameState.roles[pl.id] : undefined,
        })),
      });

      // Synchronize the current guesses count
      socket.emit('rs_guess_result', {
        revealedIds: room.gameState.revealedIds,
        targetUserId: '',
        targetRole: '',
        isSeetha: false,
        guesses: room.gameState.guessCount || 0,
      });
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  const triggerRSBotGuess = (room: any) => {
    const gameState = room.gameState;
    if (!gameState) return;

    // Find candidates who are not Ramudu
    const candidates = room.players.filter(
      (p: any) => p.id !== gameState.ramuduId
    );

    if (candidates.length === 0) return;

    // Wait 3 seconds to simulate bot thinking
    setTimeout(async () => {
      const currentRoom = roomStore.getRoom(room.code);
      if (!currentRoom || currentRoom.status !== 'PLAYING' || currentRoom.gameState !== gameState) return;

      // Enforce strict one-guess attempt for bots
      if (gameState.guessCount > 0) return;

      const targetUser = candidates[Math.floor(Math.random() * candidates.length)];
      await handleRSGuessResolution(currentRoom, targetUser.id);
    }, 3000);
  };
}
