import { Server, Socket } from 'socket.io';
import { roomStore, Player } from '../models/roomStore';
import prisma from '../utils/prisma';
import { awardUserStats } from '../utils/gameHelpers';

const OPTIONAL_CHARACTERS = [
  'Hanuman',
  'Lakshmana',
  'Krishna',
  'Shiva',
  'Parvathi',
  'Narada',
  'Indra',
  'Ganesha',
  'Durga',
];

export const roundEndTimeouts = new Map<string, NodeJS.Timeout>();

export function clearRSRoundTimeout(roomCode: string) {
  const timeout = roundEndTimeouts.get(roomCode);
  if (timeout) {
    clearTimeout(timeout);
    roundEndTimeouts.delete(roomCode);
  }
}

export function handleRamuduSeetha(io: Server, socket: Socket) {
  // Start Game (triggered by host or automatic timers)
  // Helper to start a round
  const startRSRound = (room: any) => {
    clearRSRoundTimeout(room.code);
    const playerCount = room.players.length;
    if (playerCount < 3) {
      return io.to(room.code).emit('error', 'Minimum 3 players are required to start');
    }

    // Shuffle characters
    const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);
    const roles: { [userId: string]: string } = {};

    // Assign Ramudu and Seetha
    const ramuduPlayer = shuffledPlayers[0];
    const seethaPlayer = shuffledPlayers[1];

    roles[ramuduPlayer.id] = 'Ramudu';
    roles[seethaPlayer.id] = 'Seetha';

    // Assign other characters
    const shuffledOptional = [...OPTIONAL_CHARACTERS].sort(() => Math.random() - 0.5);
    for (let i = 2; i < playerCount; i++) {
      roles[shuffledPlayers[i].id] = shuffledOptional[i - 2] || `Villager ${i - 1}`;
    }

    // Apply roles to Player models in store
    room.players.forEach((p: any) => {
      p.role = roles[p.id];
    });

    // Update room state
    room.gameState = {
      roles,
      ramuduId: ramuduPlayer.id,
      seethaId: seethaPlayer.id,
      guessCount: 0,
      revealedIds: [] as string[],
    };

    room.status = 'PLAYING';

    // Emit game started to all, but only send their OWN role privatised
    room.players.forEach((p: any) => {
      io.to(p.socketId).emit('rs_game_started', {
        roomCode: room.code,
        myRole: roles[p.id],
        ramuduId: ramuduPlayer.id,
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
      });
    });

    // Broadcast room update
    io.to(room.code).emit('room_state_updated', {
      ...room,
      players: room.players.map((p: any) => ({ ...p, role: undefined })), // hide roles
    });

    // Check if Ramudu is a bot
    const botRamuduPlayer = room.players.find((pl: any) => pl.id === room.gameState.ramuduId);
    if (botRamuduPlayer && botRamuduPlayer.isBot) {
      triggerRSBotGuess(room);
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
      const host = room.players.find((p) => p.socketId === socket.id);
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
      const host = room.players.find((p) => p.socketId === socket.id);
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

  // Ramudu guesses player role
  socket.on('rs_guess', async ({ roomCode, targetUserId }: { roomCode: string; targetUserId: string }) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room || room.status !== 'PLAYING') return socket.emit('error', 'Game not active');

      const gameState = room.gameState;
      if (!gameState) return socket.emit('error', 'Game state missing');

      // Validate guesser is Ramudu
      const guesser = room.players.find((p) => p.socketId === socket.id);
      if (!guesser || guesser.id !== gameState.ramuduId) {
        return socket.emit('error', 'Only Ramudu can make guesses');
      }

      // Increment guess count
      gameState.guessCount += 1;

      const isSeetha = targetUserId === gameState.seethaId;
      const targetRole = gameState.roles[targetUserId];

      if (isSeetha) {
        // Ramudu found Seetha! Round ends.
        
        // Scoring Formula (guess-based, no timers)
        const ramuduScore = Math.max(100, 1000 - (gameState.guessCount - 1) * 200);
        const seethaScore = Math.min(1000, 200 + (gameState.guessCount - 1) * 250);
        const baseScore = 200;

        // Ensure session scoreboard is present
        if (!room.sessionScoreboard) {
          room.sessionScoreboard = {};
          room.players.forEach((pl) => {
            room.sessionScoreboard![pl.id] = { username: pl.username, score: 0 };
          });
        }

        // Add round scores to running session totals
        const roundScores: { [userId: string]: number } = {};
        for (const p of room.players) {
          let score = baseScore;
          if (p.id === gameState.ramuduId) {
            score = ramuduScore;
          } else if (p.id === gameState.seethaId) {
            score = seethaScore;
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
          io.to(upperCode).emit('rs_round_ended', {
            currentRound: room.currentRound,
            maxRounds: room.maxRounds,
            winnerId: gameState.ramuduId,
            seethaId: gameState.seethaId,
            guessCount: gameState.guessCount,
            roundScores,
            sessionScoreboard: room.sessionScoreboard,
            countdownDuration,
          });

          // Set automatic next round timeout
          clearRSRoundTimeout(upperCode);
          const timeout = setTimeout(() => {
            try {
              const r = roomStore.getRoom(upperCode);
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

          roundEndTimeouts.set(upperCode, timeout);
        } else {
          // Final round finished! Grand Finale.
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
              durationSeconds: 0, // timer-less
              winnerId: finalScoreboard[0].userId, // highest score winner
            },
          });

          for (const row of finalScoreboard) {
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

          // Broadcast match ended details
          io.to(upperCode).emit('rs_match_ended', {
            winnerId: finalScoreboard[0].userId,
            seethaId: gameState.seethaId,
            guessCount: gameState.guessCount,
            scoreboard: finalScoreboard,
          });
        }
      } else {
        // Guessed player is NOT Seetha. Reveal character role.
        if (!gameState.revealedIds.includes(targetUserId)) {
          gameState.revealedIds.push(targetUserId);
        }

        io.to(upperCode).emit('rs_guess_result', {
          targetUserId,
          targetRole,
          isSeetha: false,
          revealedIds: gameState.revealedIds,
        });
      }
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
      const host = room.players.find((p) => p.socketId === socket.id);
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can return the room to lobby');
      }

      clearRSRoundTimeout(upperCode);

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

      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) return;

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

    // Find candidates who are not Ramudu and not revealed
    const candidates = room.players.filter(
      (p: any) => p.id !== gameState.ramuduId && !gameState.revealedIds.includes(p.id)
    );

    if (candidates.length === 0) return;

    // Wait 3 seconds to simulate bot thinking
    setTimeout(async () => {
      const currentRoom = roomStore.getRoom(room.code);
      if (!currentRoom || currentRoom.status !== 'PLAYING' || currentRoom.gameState !== gameState) return;

      const targetUser = candidates[Math.floor(Math.random() * candidates.length)];
      gameState.guessCount += 1;

      const isSeetha = targetUser.id === gameState.seethaId;
      const targetRole = gameState.roles[targetUser.id];

      if (isSeetha) {
        const ramuduScore = Math.max(100, 1000 - (gameState.guessCount - 1) * 200);
        const seethaScore = Math.min(1000, 200 + (gameState.guessCount - 1) * 250);
        const baseScore = 200;

        if (!currentRoom.sessionScoreboard) {
          currentRoom.sessionScoreboard = {};
          currentRoom.players.forEach((pl: any) => {
            currentRoom.sessionScoreboard![pl.id] = { username: pl.username, score: 0 };
          });
        }

        const roundScores: { [userId: string]: number } = {};
        for (const p of currentRoom.players) {
          let score = baseScore;
          if (p.id === gameState.ramuduId) {
            score = ramuduScore;
          } else if (p.id === gameState.seethaId) {
            score = seethaScore;
          }
          roundScores[p.id] = score;

          if (currentRoom.sessionScoreboard[p.id]) {
            currentRoom.sessionScoreboard[p.id].score += score;
          }
        }

        const isLastRound = currentRoom.currentRound! >= currentRoom.maxRounds!;
        const countdownDuration = 10;

        if (!isLastRound) {
          io.to(currentRoom.code).emit('rs_round_ended', {
            currentRound: currentRoom.currentRound,
            maxRounds: currentRoom.maxRounds,
            winnerId: gameState.ramuduId,
            seethaId: gameState.seethaId,
            guessCount: gameState.guessCount,
            roundScores,
            sessionScoreboard: currentRoom.sessionScoreboard,
            countdownDuration,
          });

          // Set automatic next round timeout
          clearRSRoundTimeout(currentRoom.code);
          const timeout = setTimeout(() => {
            try {
              const r = roomStore.getRoom(currentRoom.code);
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
          roundEndTimeouts.set(currentRoom.code, timeout);
        } else {
          const finalScoreboard = Object.entries(currentRoom.sessionScoreboard)
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

          const match = await prisma.match.create({
            data: {
              gameType: 'RAMUDU_SEETHA',
              durationSeconds: 0,
              winnerId: finalScoreboard[0].userId,
            },
          });

          for (const row of finalScoreboard) {
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

          // Return room status to lobby
          currentRoom.status = 'LOBBY';
          currentRoom.players.forEach((p: any) => {
            p.ready = false;
            p.role = undefined;
          });
          currentRoom.gameState = null;

          io.to(currentRoom.code).emit('rs_match_ended', {
            winnerId: finalScoreboard[0].userId,
            seethaId: gameState.seethaId,
            guessCount: gameState.guessCount,
            scoreboard: finalScoreboard,
          });

          io.to(currentRoom.code).emit('room_state_updated', currentRoom);
        }
      } else {
        if (!gameState.revealedIds.includes(targetUser.id)) {
          gameState.revealedIds.push(targetUser.id);
        }

        io.to(currentRoom.code).emit('rs_guess_result', {
          targetUserId: targetUser.id,
          targetRole,
          isSeetha: false,
          revealedIds: gameState.revealedIds,
        });

        triggerRSBotGuess(currentRoom);
      }
    }, 3000);
  };
}
