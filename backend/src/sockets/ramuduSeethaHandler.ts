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

export function handleRamuduSeetha(io: Server, socket: Socket) {
  // Start Game (triggered by host)
  socket.on('rs_start_game', async (roomCode: string) => {
    try {
      const room = roomStore.getRoom(roomCode);
      if (!room) return socket.emit('error', 'Room not found');

      // Check permissions
      const host = room.players.find((p) => p.socketId === socket.id);
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can start the game');
      }

      const playerCount = room.players.length;
      if (playerCount < 3) {
        return socket.emit('error', 'Minimum 3 players are required to start');
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
      room.players.forEach((p) => {
        p.role = roles[p.id];
      });

      // Update room state
      room.gameState = {
        roles,
        ramuduId: ramuduPlayer.id,
        seethaId: seethaPlayer.id,
        startTime: Date.now(),
        guessCount: 0,
        revealedIds: [] as string[],
      };

      roomStore.updateRoomStatus(roomCode, 'PLAYING');

      // Emit game started to all, but only send their OWN role privatised
      room.players.forEach((p) => {
        io.to(p.socketId).emit('rs_game_started', {
          roomCode,
          myRole: roles[p.id],
          ramuduId: ramuduPlayer.id,
          players: room.players.map((pl) => ({
            id: pl.id,
            username: pl.username,
            avatar: pl.avatar,
            profileFrame: pl.profileFrame,
            isRevealed: false,
          })),
        });
      });

      // Broadcast room update
      io.to(roomCode).emit('room_state_updated', {
        ...room,
        players: room.players.map((p) => ({ ...p, role: undefined })), // hide roles
      });
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Ramudu guesses player role
  socket.on('rs_guess', async ({ roomCode, targetUserId }: { roomCode: string; targetUserId: string }) => {
    try {
      const room = roomStore.getRoom(roomCode);
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
        // Ramudu found Seetha! Game ends.
        const duration = Math.floor((Date.now() - gameState.startTime) / 1000);

        // Scoring Formula
        // Ramudu gets more points if found fast. Max 1000, drops by 10 points per second, min 100.
        const ramuduScore = Math.max(100, 1000 - duration * 10);
        // Seetha gets more points if she stayed hidden. Max 1000, gains 10 points per second, min 100.
        const seethaScore = Math.min(1000, 100 + duration * 10);
        // Others get a base of 200 points
        const baseScore = 200;

        // Record Match in DB
        const match = await prisma.match.create({
          data: {
            gameType: 'RAMUDU_SEETHA',
            durationSeconds: duration,
            winnerId: gameState.ramuduId,
          },
        });

        // Award XP and Coins & create MatchPlayer rows
        const matchPlayersData = [];
        for (const p of room.players) {
          let score = baseScore;
          let coinsEarned = 50; // base coins
          let placement = 2;

          if (p.id === gameState.ramuduId) {
            score = ramuduScore;
            coinsEarned = 150;
            placement = 1;
          } else if (p.id === gameState.seethaId) {
            score = seethaScore;
            coinsEarned = 100;
          }

          // Write stats
          await awardUserStats(p.id, Math.round(score / 5), coinsEarned);

          // Save player match record
          await prisma.matchPlayer.create({
            data: {
              matchId: match.id,
              userId: p.id,
              score,
              coinsEarned,
              placement,
            },
          });

          matchPlayersData.push({
            userId: p.id,
            username: p.username,
            role: gameState.roles[p.id],
            score,
            coinsEarned,
            placement,
          });
        }

        // Return room to LOBBY status and reset ready states
        roomStore.updateRoomStatus(roomCode, 'LOBBY');
        room.players.forEach((p) => {
          p.ready = false;
          p.role = undefined;
        });
        room.gameState = null;

        // Broadcast match end details
        io.to(roomCode).emit('rs_match_ended', {
          winnerId: gameState.ramuduId,
          seethaId: gameState.seethaId,
          duration,
          guessCount: gameState.guessCount,
          scoreboard: matchPlayersData,
        });

        // Broadcast room update
        io.to(roomCode).emit('room_state_updated', room);
      } else {
        // Guessed player is NOT Seetha. Reveal character role.
        if (!gameState.revealedIds.includes(targetUserId)) {
          gameState.revealedIds.push(targetUserId);
        }

        io.to(roomCode).emit('rs_guess_result', {
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
}
