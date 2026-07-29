import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import { roomStore } from '../models/roomStore';
import prisma from '../utils/prisma';

interface ChessState {
  fen: string;
  turn: 'w' | 'b';
  whitePlayerId: string;
  blackPlayerId: string;
  whiteUsername: string;
  blackUsername: string;
  moveHistory: string[];
  isGameOver: boolean;
  winnerId: string | null;
  drawReason: string | null;
}

export function handleChess(io: Server, socket: Socket) {
  socket.on('chess_start_game', (roomCode: string) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');

      const host = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can start the game');
      }

      startChessGame(io, room);
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Sync Chess Game
  socket.on('chess_sync_state', (roomCode: string) => {
    const upperCode = roomCode.trim().toUpperCase();
    const room = roomStore.getRoom(upperCode);
    if (room && room.status === 'PLAYING' && room.gameState) {
      socket.emit('chess_state_sync', room.gameState);
    }
  });

  // Handle Chess Move
  socket.on('chess_move', ({ roomCode, from, to, promotion }: { roomCode: string; from: string; to: string; promotion?: string }) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room || room.status !== 'PLAYING' || !room.gameState) {
        return socket.emit('error', 'Active game not found');
      }

      const gameState = room.gameState as ChessState;
      const myId = socket.data.user?.id || room.players.find(p => p.socketId === socket.id)?.id;
      
      const isWhite = myId === gameState.whitePlayerId;
      const isBlack = myId === gameState.blackPlayerId;

      if (!isWhite && !isBlack) {
        return socket.emit('error', 'You are not a player in this game');
      }

      if ((gameState.turn === 'w' && !isWhite) || (gameState.turn === 'b' && !isBlack)) {
        return socket.emit('error', 'It is not your turn');
      }

      const chess = new Chess(gameState.fen);
      try {
        const move = chess.move({
          from,
          to,
          promotion: promotion || 'q'
        });

        gameState.fen = chess.fen();
        gameState.turn = chess.turn();
        gameState.moveHistory.push(move.san);

        if (chess.isGameOver()) {
          gameState.isGameOver = true;
          if (chess.isCheckmate()) {
            gameState.winnerId = chess.turn() === 'w' ? gameState.blackPlayerId : gameState.whitePlayerId;
          } else {
            if (chess.isStalemate()) gameState.drawReason = 'Stalemate';
            else if (chess.isThreefoldRepetition()) gameState.drawReason = 'Threefold Repetition';
            else if (chess.isInsufficientMaterial()) gameState.drawReason = 'Insufficient Material';
            else gameState.drawReason = 'Draw';
          }
          
          triggerChessMatchEnd(io, upperCode, room, gameState);
        } else {
          io.to(upperCode).emit('chess_state_sync', gameState);
        }
      } catch (moveErr) {
        socket.emit('error', 'Invalid chess move');
      }
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  socket.on('chess_return_to_lobby', (roomCode: string) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');

      const host = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can return the room to lobby');
      }

      roomStore.updateRoomStatus(upperCode, 'LOBBY');
      room.players.forEach((p) => {
        p.ready = false;
      });
      room.gameState = null;

      io.to(upperCode).emit('room_state_updated', room);
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });
}

// Function to trigger Chess Match Start from Room handler
export function startChessGame(io: Server, room: any) {
  const chess = new Chess();
  const whitePlayer = room.players[0];
  const blackPlayer = room.players[1];

  const gameState: ChessState = {
    fen: chess.fen(),
    turn: 'w',
    whitePlayerId: whitePlayer.id,
    blackPlayerId: blackPlayer.id,
    whiteUsername: whitePlayer.username,
    blackUsername: blackPlayer.username,
    moveHistory: [],
    isGameOver: false,
    winnerId: null,
    drawReason: null
  };

  room.status = 'PLAYING';
  room.gameState = gameState;

  io.to(room.code).emit('room_state_updated', room);
  io.to(room.code).emit('chess_state_sync', gameState);
}

async function triggerChessMatchEnd(io: Server, roomCode: string, room: any, gameState: ChessState) {
  try {
    if (room.status === 'FINISHED' || (gameState as any).isEnded) return;
    (gameState as any).isEnded = true;
    roomStore.updateRoomStatus(roomCode, 'FINISHED');

    const scoreboardData: any[] = [];

    const dbMatch = await prisma.match.create({
      data: {
        gameType: 'CHESS',
        status: 'COMPLETED',
      },
    });

    for (const p of room.players) {
      const isWinner = gameState.winnerId === p.id;
      const isDraw = gameState.isGameOver && !gameState.winnerId;
      const xpEarned = isWinner ? 50 : isDraw ? 25 : 15;
      const coinsEarned = isWinner ? 100 : isDraw ? 40 : 20;
      const placement = isWinner ? 1 : isDraw ? 1 : 2;

      scoreboardData.push({
        userId: p.id,
        username: p.username,
        placement,
        xpEarned,
        coinsEarned
      });

      if (!p.isBot) {
        await prisma.user.update({
          where: { id: p.id },
          data: {
            xp: { increment: xpEarned },
            coins: { increment: coinsEarned },
            level: { increment: Math.floor((xpEarned) / 100) }
          }
        });

        await prisma.matchPlayer.create({
          data: {
            matchId: dbMatch.id,
            userId: p.id,
            score: xpEarned * 2,
            coinsEarned,
            placement,
          },
        });
      }
    }

    io.to(roomCode).emit('chess_match_ended', {
      duration: 0,
      scoreboard: scoreboardData,
      drawReason: gameState.drawReason
    });
  } catch (err) {
    console.error('Failed to end chess game:', err);
  }
}
