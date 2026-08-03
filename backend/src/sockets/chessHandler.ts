import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import { roomStore } from '../models/roomStore';
import prisma from '../utils/prisma';

export interface CapturedPiece {
  piece: string; // 'p' | 'r' | 'n' | 'b' | 'q'
  color: 'w' | 'b'; // color of the captured piece
  capturedBy: string; // userId who captured it
  sequence: number;
}

export interface ChessState {
  fen: string;
  turn: 'w' | 'b';
  whitePlayerId: string;
  blackPlayerId: string;
  whiteUsername: string;
  blackUsername: string;
  timeControl: number | 'UNLIMITED';
  whiteTimeLeft: number | null;
  blackTimeLeft: number | null;
  timerStarted: boolean;
  lastMoveTimestamp: number;
  capturedPieces: CapturedPiece[];
  lastMove: { from: string; to: string; piece?: string; san?: string } | null;
  moveHistory: string[];
  isGameOver: boolean;
  winnerId: string | null;
  drawReason: string | null;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
}

const activeChessTimers: { [roomCode: string]: NodeJS.Timeout } = {};

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

  // Sync Chess Game State
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
      if (gameState.isGameOver) {
        return socket.emit('error', 'Game has already ended');
      }

      const myId = socket.data.user?.id || room.players.find(p => p.socketId === socket.id)?.id;
      if (!myId) {
        return socket.emit('error', 'Player identity not found');
      }

      const success = makeChessMoveInternal(io, room, from, to, promotion || 'q', myId);
      if (!success) {
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

      if (activeChessTimers[upperCode]) {
        clearInterval(activeChessTimers[upperCode]);
        delete activeChessTimers[upperCode];
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

export function makeChessMoveInternal(
  io: Server,
  room: any,
  from: string,
  to: string,
  promotion: string = 'q',
  playerId: string
): boolean {
  const gameState = room.gameState as ChessState;
  if (!gameState || gameState.isGameOver) return false;

  const isWhite = playerId === gameState.whitePlayerId;
  const isBlack = playerId === gameState.blackPlayerId;

  if (!isWhite && !isBlack) return false;
  if ((gameState.turn === 'w' && !isWhite) || (gameState.turn === 'b' && !isBlack)) return false;

  const chess = new Chess(gameState.fen);
  try {
    const move = chess.move({
      from,
      to,
      promotion: promotion || 'q',
    });

    gameState.fen = chess.fen();
    gameState.turn = chess.turn();
    gameState.moveHistory.push(move.san);
    gameState.lastMove = { from: move.from, to: move.to, piece: move.piece, san: move.san };
    gameState.lastMoveTimestamp = Date.now();
    gameState.isCheck = chess.inCheck();

    // Track captured pieces sequence chronologically
    if (move.captured) {
      gameState.capturedPieces.push({
        piece: move.captured,
        color: move.color === 'w' ? 'b' : 'w',
        capturedBy: playerId,
        sequence: gameState.capturedPieces.length + 1,
      });
    }

    // Start timer countdown loop upon first move of the match (if timeControl is not UNLIMITED)
    if (!gameState.timerStarted) {
      gameState.timerStarted = true;
    }

    if (gameState.timeControl !== 'UNLIMITED' && !activeChessTimers[room.code]) {
      startChessTurnTimer(io, room.code);
    }

    if (chess.isGameOver()) {
      gameState.isGameOver = true;
      if (chess.isCheckmate()) {
        gameState.isCheckmate = true;
        gameState.winnerId = chess.turn() === 'w' ? gameState.blackPlayerId : gameState.whitePlayerId;
      } else {
        if (chess.isStalemate()) {
          gameState.isStalemate = true;
          gameState.drawReason = 'Stalemate';
        } else if (chess.isThreefoldRepetition()) {
          gameState.drawReason = 'Threefold Repetition';
        } else if (chess.isInsufficientMaterial()) {
          gameState.drawReason = 'Insufficient Material';
        } else {
          gameState.drawReason = 'Draw';
        }
      }

      if (activeChessTimers[room.code]) {
        clearInterval(activeChessTimers[room.code]);
        delete activeChessTimers[room.code];
      }

      triggerChessMatchEnd(io, room.code, room, gameState);
    } else {
      io.to(room.code).emit('chess_state_sync', gameState);
      // Trigger bot turn if next turn belongs to a bot
      checkAndTriggerChessBotTurn(io, room.code);
    }
    return true;
  } catch (moveErr) {
    return false;
  }
}

function checkAndTriggerChessBotTurn(io: Server, roomCode: string) {
  const room = roomStore.getRoom(roomCode);
  if (!room || room.status !== 'PLAYING' || !room.gameState) return;

  const gameState = room.gameState as ChessState;
  if (gameState.isGameOver) return;

  const activePlayerId = gameState.turn === 'w' ? gameState.whitePlayerId : gameState.blackPlayerId;
  const activePlayer = room.players.find((p) => p.id === activePlayerId);
  if (!activePlayer || !activePlayer.isBot) return;

  // Natural thinking delay between 800ms and 1200ms
  const delay = Math.floor(Math.random() * 400) + 800;

  setTimeout(() => {
    const currentRoom = roomStore.getRoom(roomCode);
    if (!currentRoom || currentRoom.status !== 'PLAYING' || !currentRoom.gameState) return;

    const currentState = currentRoom.gameState as ChessState;
    if (currentState.isGameOver) return;

    const currentActiveId = currentState.turn === 'w' ? currentState.whitePlayerId : currentState.blackPlayerId;
    if (currentActiveId !== activePlayer.id) return;

    const chess = new Chess(currentState.fen);
    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) return;

    const bestMove = selectBestBotMove(chess, legalMoves);
    if (bestMove) {
      makeChessMoveInternal(
        io,
        currentRoom,
        bestMove.from,
        bestMove.to,
        bestMove.promotion || 'q',
        activePlayer.id
      );
    }
  }, delay);
}

function selectBestBotMove(chess: Chess, legalMoves: any[]): any {
  if (legalMoves.length === 0) return null;
  if (legalMoves.length === 1) return legalMoves[0];

  const pieceValues: { [key: string]: number } = {
    p: 10,
    n: 30,
    b: 30,
    r: 50,
    q: 90,
    k: 900,
  };

  const centerSquares = new Set(['e4', 'e5', 'd4', 'd5', 'c4', 'c5', 'f4', 'f5']);

  const scoredMoves = legalMoves.map((move) => {
    let score = 0;

    // Simulate move
    const tempChess = new Chess(chess.fen());
    tempChess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });

    // 1. Checkmate (highest priority)
    if (tempChess.isCheckmate()) {
      return { move, score: 10000 };
    }

    // 2. Captures
    if (move.captured) {
      const victimVal = pieceValues[move.captured.toLowerCase()] || 10;
      const attackerVal = pieceValues[move.piece.toLowerCase()] || 10;
      score += victimVal * 10 - attackerVal;
    }

    // 3. Promotion
    if (move.promotion === 'q' || (move.flags && move.flags.includes('p'))) {
      score += 80;
    }

    // 4. Giving Check
    if (tempChess.inCheck()) {
      score += 15;
    }

    // 5. Center Control
    if (centerSquares.has(move.to)) {
      score += 5;
    }

    // 6. Check if target square is attacked by opponent (avoid hanging pieces)
    const opponentMoves = tempChess.moves({ verbose: true });
    const isAttacked = opponentMoves.some((oppMove) => oppMove.to === move.to);
    if (isAttacked) {
      const movingPieceVal = pieceValues[move.piece.toLowerCase()] || 10;
      score -= movingPieceVal * 5;
    }

    // 7. Small random variation
    score += Math.random() * 8;

    return { move, score };
  });

  // Sort descending by score
  scoredMoves.sort((a, b) => b.score - a.score);

  return scoredMoves[0].move;
}

// Function to trigger Chess Match Start from Room handler
export function startChessGame(io: Server, room: any) {
  // If room has only 1 player, auto-add AI bot for single-player practice
  if (room.players.length < 2) {
    const botPlayer = {
      id: `bot_${Math.random().toString(36).substring(2, 9)}`,
      username: 'AlphaBot',
      socketId: 'BOT_SOCKET',
      avatar: 'cyborg',
      profileFrame: 'default_frame',
      ready: true,
      isBot: true,
    };
    roomStore.addPlayer(room.code, botPlayer);
  }

  const chess = new Chess();
  const whitePlayer = room.players[0];
  const blackPlayer = room.players[1];

  const tc = room.timeControl !== undefined ? room.timeControl : 'UNLIMITED';
  const initialSeconds = typeof tc === 'number' ? tc : null;

  const gameState: ChessState = {
    fen: chess.fen(),
    turn: 'w',
    whitePlayerId: whitePlayer.id,
    blackPlayerId: blackPlayer.id,
    whiteUsername: whitePlayer.displayName || whitePlayer.username,
    blackUsername: blackPlayer.displayName || blackPlayer.username,
    timeControl: tc,
    whiteTimeLeft: initialSeconds,
    blackTimeLeft: initialSeconds,
    timerStarted: false,
    lastMoveTimestamp: Date.now(),
    capturedPieces: [],
    lastMove: null,
    moveHistory: [],
    isGameOver: false,
    winnerId: null,
    drawReason: null,
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
  };

  room.status = 'PLAYING';
  room.gameState = gameState;

  // Note: Timer ONLY starts after 1st move of game! Do NOT start timer here.

  io.to(room.code).emit('room_state_updated', room);
  io.to(room.code).emit('chess_state_sync', gameState);

  // Check if first player (White) is bot
  checkAndTriggerChessBotTurn(io, room.code);
}

function startChessTurnTimer(io: Server, roomCode: string) {
  if (activeChessTimers[roomCode]) {
    clearInterval(activeChessTimers[roomCode]);
  }

  activeChessTimers[roomCode] = setInterval(() => {
    const room = roomStore.getRoom(roomCode);
    if (!room || room.status !== 'PLAYING') {
      clearInterval(activeChessTimers[roomCode]);
      delete activeChessTimers[roomCode];
      return;
    }

    const state = room.gameState as ChessState;
    if (!state || state.isGameOver || state.timeControl === 'UNLIMITED' || !state.timerStarted) {
      clearInterval(activeChessTimers[roomCode]);
      delete activeChessTimers[roomCode];
      return;
    }

    // Decrement time for active player if numerical timer set
    if (typeof state.whiteTimeLeft === 'number' && typeof state.blackTimeLeft === 'number') {
      if (state.turn === 'w') {
        state.whiteTimeLeft = Math.max(0, state.whiteTimeLeft - 1);
      } else {
        state.blackTimeLeft = Math.max(0, state.blackTimeLeft - 1);
      }

      io.to(roomCode).emit('chess_timer_tick', {
        whiteTimeLeft: state.whiteTimeLeft,
        blackTimeLeft: state.blackTimeLeft,
        activeTurn: state.turn,
      });

      // Check for clock timeout
      if (state.whiteTimeLeft <= 0 || state.blackTimeLeft <= 0) {
        clearInterval(activeChessTimers[roomCode]);
        delete activeChessTimers[roomCode];

        state.isGameOver = true;
        if (state.whiteTimeLeft <= 0) {
          state.winnerId = state.blackPlayerId;
          state.drawReason = 'White Time Out';
        } else {
          state.winnerId = state.whitePlayerId;
          state.drawReason = 'Black Time Out';
        }

        io.to(roomCode).emit('chess_state_sync', state);
        triggerChessMatchEnd(io, roomCode, room, state);
      }
    }
  }, 1000);
}

async function triggerChessMatchEnd(io: Server, roomCode: string, room: any, gameState: ChessState) {
  try {
    if (room.status === 'FINISHED' || (gameState as any).isEnded) return;
    (gameState as any).isEnded = true;
    roomStore.updateRoomStatus(roomCode, 'FINISHED');

    if (activeChessTimers[roomCode]) {
      clearInterval(activeChessTimers[roomCode]);
      delete activeChessTimers[roomCode];
    }

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
        username: p.displayName || p.username,
        placement,
        xpEarned,
        coinsEarned,
      });

      if (!p.isBot) {
        await prisma.user.update({
          where: { id: p.id },
          data: {
            xp: { increment: xpEarned },
            coins: { increment: coinsEarned },
            level: { increment: Math.floor(xpEarned / 100) },
          },
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
      drawReason: gameState.drawReason,
      winnerId: gameState.winnerId,
    });
  } catch (err) {
    console.error('Failed to end chess game:', err);
  }
}
