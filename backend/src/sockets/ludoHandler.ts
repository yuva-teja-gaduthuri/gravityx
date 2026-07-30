import { Server, Socket } from 'socket.io';
import { roomStore, Player } from '../models/roomStore';
import prisma from '../utils/prisma';
import { awardUserStats } from '../utils/gameHelpers';

interface LudoToken {
  id: number; // 0, 1, 2, 3
  position: number; // -1 = Home yard, 0..51 = Main track, 52..56 = Home stretch, 57 = Home triangle (done)
}

interface LudoPlayer {
  id: string;
  username: string;
  displayName?: string;
  socketId: string;
  color: 'red' | 'green' | 'yellow' | 'blue';
  startCell: number;
  lastCell: number; // last cell on track before entering home stretch
  stretchStart: number; // position value offset for stretch
  tokens: LudoToken[];
  isWinner: boolean;
  isEliminated?: boolean;
  placement?: number;
  unturnedMoves?: number;
}

interface LudoState {
  players: LudoPlayer[];
  activePlayerIndex: number;
  diceValue: number | null;
  hasRolled: boolean;
  turnTimeLeft: number;
  turnTimerDuration?: number;
  startTime: number;
  consecutiveSixes: number;
  turnToken?: number;
  isEnded?: boolean;
}

const COLOR_CONFIGS = {
  red: { startCell: 0, lastCell: 50, stretchStart: 52 },
  green: { startCell: 13, lastCell: 11, stretchStart: 52 },
  yellow: { startCell: 26, lastCell: 24, stretchStart: 52 },
  blue: { startCell: 39, lastCell: 37, stretchStart: 52 },
};

const SAFE_CELLS = [0, 8, 13, 21, 26, 34, 39, 47]; // Safe star/starting cells

// Turn Timer: 15 seconds
const TURN_TIMEOUT = 15;
const activeTimers: { [roomCode: string]: NodeJS.Timeout } = {};

export function handleLudo(io: Server, socket: Socket) {
  // Start Ludo Game
  socket.on('ludo_start_game', async (payload: string | { roomCode: string }) => {
    try {
      const roomCode = typeof payload === 'string' ? payload : payload.roomCode;
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');

      // Check permissions
      const host = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can start the game');
      }

      const playerCount = room.players.length;
      if (playerCount < 2 || playerCount > 4) {
        return socket.emit('error', 'Ludo requires between 2 and 4 players');
      }

      // Assign colors and initialize tokens
      const availableColors: ('red' | 'green' | 'yellow' | 'blue')[] = ['red', 'green', 'yellow', 'blue'];
      const assignedColors = new Map<string, 'red' | 'green' | 'yellow' | 'blue'>();
      const usedColors = new Set<'red' | 'green' | 'yellow' | 'blue'>();

      room.players.forEach((p) => {
        if (p.color && !usedColors.has(p.color)) {
          assignedColors.set(p.id, p.color);
          usedColors.add(p.color);
        }
      });

      room.players.forEach((p) => {
        if (!assignedColors.has(p.id)) {
          const freeColor = availableColors.find((c) => !usedColors.has(c));
          if (freeColor) {
            assignedColors.set(p.id, freeColor);
            usedColors.add(freeColor);
          }
        }
      });

      const ludoPlayers: LudoPlayer[] = room.players.map((p) => {
        const color = assignedColors.get(p.id) || 'red';
        const config = COLOR_CONFIGS[color];
        const effectiveName = p.displayName || p.username;
        return {
          id: p.id,
          username: effectiveName,
          displayName: effectiveName,
          socketId: p.socketId,
          color,
          startCell: config.startCell,
          lastCell: config.lastCell,
          stretchStart: config.stretchStart,
          tokens: [
            { id: 0, position: -1 },
            { id: 1, position: -1 },
            { id: 2, position: -1 },
            { id: 3, position: -1 },
          ],
          isWinner: false,
          isEliminated: false,
          unturnedMoves: 0,
        };
      });

      // Sort players in canonical clockwise order: RED -> GREEN -> YELLOW -> BLUE
      const COLOR_ORDER: ('red' | 'green' | 'yellow' | 'blue')[] = ['red', 'green', 'yellow', 'blue'];
      ludoPlayers.sort((a, b) => COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color));

      const gameState: LudoState = {
        players: ludoPlayers,
        activePlayerIndex: 0,
        diceValue: null,
        hasRolled: false,
        turnTimeLeft: TURN_TIMEOUT,
        startTime: Date.now(),
        consecutiveSixes: 0,
        turnToken: 1,
        isEnded: false,
      };

      roomStore.updateGameState(upperCode, gameState);
      roomStore.updateRoomStatus(upperCode, 'PLAYING');

      // Broadcast room state update so client changes view to Ludo game board
      const updatedRoom = roomStore.getRoom(upperCode);
      if (updatedRoom && updatedRoom.status === 'PLAYING') {
        io.to(upperCode).emit('room_state_updated', updatedRoom);
      }

      // Notify clients and send initial state
      io.to(upperCode).emit('ludo_game_started', {
        roomCode: upperCode,
        gameState,
      });

      // Start turn timer
      startTurnTimer(io, upperCode);

      // Check if first player is a bot
      const activePlayer = gameState.players[0];
      const roomPlayer = room.players.find((p) => p.id === activePlayer.id);
      if (roomPlayer && roomPlayer.isBot) {
        triggerBotTurn(io, upperCode, 0);
      }
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Roll Dice
  socket.on('ludo_roll_dice', async (roomCode: string) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room || room.status !== 'PLAYING') return socket.emit('error', 'Game not active');

      const state = room.gameState as LudoState;
      if (!state || state.isEnded) return socket.emit('error', 'Ludo game state missing or ended');

      const activePlayer = state.players[state.activePlayerIndex];
      const playerSocket = room.players.find((p) => p.id === activePlayer.id);

      if (!playerSocket || playerSocket.socketId !== socket.id) {
        return socket.emit('error', "It's not your turn");
      }

      if (activePlayer.isEliminated) {
        return socket.emit('error', 'You have been eliminated from this match');
      }

      if (state.hasRolled) {
        return socket.emit('error', 'You have already rolled the dice');
      }

      // Roll 1..6
      const roll = Math.floor(Math.random() * 6) + 1;
      state.diceValue = roll;
      state.hasRolled = true;

      // Rule: Three consecutive sixes loses turn
      if (roll === 6) {
        state.consecutiveSixes += 1;
        if (state.consecutiveSixes === 3) {
          state.consecutiveSixes = 0;
          state.diceValue = null;
          state.hasRolled = false;
          nextTurn(io, upperCode, state.turnToken);
          return;
        }
      } else {
        state.consecutiveSixes = 0;
      }

      // Calculate if player has any valid moves
      const validMoves = getValidTokensToMove(activePlayer, roll);

      io.to(upperCode).emit('ludo_dice_rolled', {
        diceValue: roll,
        activePlayerIndex: state.activePlayerIndex,
        validTokens: validMoves,
      });
      io.to(upperCode).emit('ludo_state_sync', state);

      // Reset turn timer for movement decision
      resetTurnTimer(io, upperCode);

      // If no valid moves, player has completed their turn phase per game rules -> reset unturnedMoves counter
      if (validMoves.length === 0) {
        activePlayer.unturnedMoves = 0;
        io.to(upperCode).emit('ludo_state_sync', state);
        const currentToken = state.turnToken;
        setTimeout(() => {
          nextTurn(io, upperCode, currentToken);
        }, 500);
      }
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Move Token
  socket.on('ludo_move_token', async ({ roomCode, tokenId }: { roomCode: string; tokenId: number }) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room || room.status !== 'PLAYING') return socket.emit('error', 'Game not active');

      const state = room.gameState as LudoState;
      if (!state || state.isEnded || !state.hasRolled || state.diceValue === null) {
        return socket.emit('error', 'Invalid move parameters');
      }

      const activePlayer = state.players[state.activePlayerIndex];
      const playerSocket = room.players.find((p) => p.id === activePlayer.id);

      if (!playerSocket || playerSocket.socketId !== socket.id) {
        return socket.emit('error', "It's not your turn");
      }

      if (activePlayer.isEliminated) {
        return socket.emit('error', 'You have been eliminated from this match');
      }

      const validTokens = getValidTokensToMove(activePlayer, state.diceValue);
      if (!validTokens.includes(tokenId)) {
        return socket.emit('error', 'Token cannot make this move');
      }

      // Apply movement
      activePlayer.unturnedMoves = 0;
      const token = activePlayer.tokens.find((t) => t.id === tokenId)!;
      const oldPosition = token.position;
      const dice = state.diceValue;

      let newPosition = token.position;

      if (token.position === -1) {
        // Releasing from home yard (requires a 6)
        if (dice === 6) {
          newPosition = activePlayer.startCell;
        }
      } else if (token.position >= 0 && token.position <= 51) {
        // On main track
        let tempPos = token.position;
        let enteredStretch = false;

        for (let i = 0; i < dice; i++) {
          if (tempPos === activePlayer.lastCell) {
            // Enter home stretch (position 52)
            tempPos = activePlayer.stretchStart;
            enteredStretch = true;
          } else if (enteredStretch) {
            tempPos += 1;
          } else {
            tempPos = (tempPos + 1) % 52;
          }
        }
        newPosition = tempPos;
      } else if (token.position >= 52 && token.position <= 56) {
        // In home stretch (52..56 -> 57 Goal)
        newPosition = token.position + dice;
      }

      if (newPosition > 57) {
        return socket.emit('error', 'Token movement overshoots goal');
      }

      token.position = newPosition;

      // Handle collision (capturing opponent tokens)
      let captured = false;
      let capturedTokenInfo: { color: string; tokenId: number } | null = null;
      if (newPosition >= 0 && newPosition <= 51 && !SAFE_CELLS.includes(newPosition)) {
        // Find other players tokens on same cell
        state.players.forEach((p) => {
          if (p.id !== activePlayer.id) {
            p.tokens.forEach((t) => {
              if (t.position === newPosition) {
                // Landed on opponent token! Knock back to yard
                t.position = -1;
                captured = true;
                capturedTokenInfo = { color: p.color, tokenId: t.id };
              }
            });
          }
        });
      }

      // Check if player won / token reached goal (57)
      const reachedGoal = (newPosition === 57);
      if (reachedGoal) {
        // check if all tokens finished
        const allFinished = activePlayer.tokens.every((t) => t.position === 57);
        if (allFinished && !activePlayer.isWinner) {
          activePlayer.isWinner = true;
          // Count winners to determine placement
          const winnersCount = state.players.filter((p) => p.isWinner).length;
          activePlayer.placement = winnersCount;

          io.to(upperCode).emit('ludo_player_won', {
            playerId: activePlayer.id,
            placement: winnersCount,
          });

          // Check if game should end (only one player/no active players left)
          const activePlayersCount = state.players.filter((p) => !p.isWinner && !p.isEliminated).length;
          if (activePlayersCount <= 1) {
            await endLudoGame(io, upperCode, state);
            return;
          }
        }
      }

      console.log(`🎲 [LUDO MOVE]: Player ${activePlayer.username} (${activePlayer.color}) moved token ${tokenId} from ${oldPosition} -> ${newPosition} (Dice: ${dice}, Captured: ${captured}, Reached Goal: ${reachedGoal})`);

      // Broadcast move animation update and full state sync so all clients update visually in real time
      io.to(upperCode).emit('ludo_token_moved', {
        activePlayerIndex: state.activePlayerIndex,
        tokenId,
        oldPosition,
        newPosition,
        captured,
        capturedToken: capturedTokenInfo,
        players: state.players,
      });
      io.to(upperCode).emit('ludo_state_sync', state);

      // Rule: Rolling a 6, capturing a token, or landing a token in Goal awards a bonus turn
      const awardBonus = (dice === 6 || captured || reachedGoal) && !activePlayer.isWinner && !activePlayer.isEliminated;

      if (awardBonus) {
        // Reset dice rolled state and stay on same player turn
        state.diceValue = null;
        state.hasRolled = false;
        io.to(upperCode).emit('ludo_new_turn', {
          activePlayerIndex: state.activePlayerIndex,
          diceValue: null,
          hasRolled: false,
        });
        resetTurnTimer(io, upperCode);

        // If the player is a bot, trigger their bonus turn
        const activePl = state.players[state.activePlayerIndex];
        const roomPlayer = room.players.find((p) => p.id === activePl.id);
        if (roomPlayer && roomPlayer.isBot) {
          triggerBotTurn(io, upperCode, state.activePlayerIndex);
        }
      } else {
        nextTurn(io, upperCode, state.turnToken);
      }
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });

  // Reconnection Sync
  socket.on('ludo_sync_state', (roomCode: string) => {
    const upperCode = roomCode.trim().toUpperCase();
    const room = roomStore.getRoom(upperCode);
    if (room && room.status === 'PLAYING') {
      socket.emit('ludo_state_sync', room.gameState);
    }
  });

  socket.on('ludo_return_to_lobby', (roomCode: string) => {
    try {
      const upperCode = roomCode.trim().toUpperCase();
      const room = roomStore.getRoom(upperCode);
      if (!room) return socket.emit('error', 'Room not found');

      // Verify host permissions
      const host = room.players.find((p) => p.socketId === socket.id || (socket.data.user && p.id === socket.data.user.id));
      if (!host || room.hostId !== host.id) {
        return socket.emit('error', 'Only the host can return the room to lobby');
      }

      // Reset room status to lobby
      roomStore.updateRoomStatus(upperCode, 'LOBBY');
      room.players.forEach((p) => {
        p.ready = false;
      });
      room.gameState = null;

      // Broadcast room status update to everyone
      io.to(upperCode).emit('room_state_updated', room);
    } catch (err: any) {
      socket.emit('error', err.message);
    }
  });
}

function getValidTokensToMove(player: LudoPlayer, dice: number): number[] {
  const valid: number[] = [];

  player.tokens.forEach((t) => {
    // If token is in yard, requires a 6 to start
    if (t.position === -1) {
      if (dice === 6) {
        valid.push(t.id);
      }
    }
    // If token is on track
    else if (t.position >= 0 && t.position <= 51) {
      let tempPos = t.position;
      let enteredStretch = false;
      for (let i = 0; i < dice; i++) {
        if (tempPos === player.lastCell) {
          tempPos = player.stretchStart; // position 52
          enteredStretch = true;
        } else if (enteredStretch) {
          tempPos += 1;
        } else {
          tempPos = (tempPos + 1) % 52;
        }
      }
      if (tempPos <= 57) {
        valid.push(t.id);
      }
    }
    // If token is in home stretch (52..56)
    else if (t.position >= 52 && t.position <= 56) {
      // Must land exactly on or before 57 (Goal)
      if (t.position + dice <= 57) {
        valid.push(t.id);
      }
    }
  });

  return valid;
}

function nextTurn(io: Server, roomCode: string, expectedTurnToken?: number) {
  const room = roomStore.getRoom(roomCode);
  if (!room) return;

  const state = room.gameState as LudoState;
  if (!state || state.isEnded) return;

  // Guard against stale turn callbacks or duplicate executions
  if (expectedTurnToken !== undefined && state.turnToken !== expectedTurnToken) {
    return;
  }

  // Increment turn token to lock this new turn
  state.turnToken = (state.turnToken || 0) + 1;

  // Clear previous dice rolled state
  state.diceValue = null;
  state.hasRolled = false;

  // Check remaining active players (neither winner nor eliminated)
  const remainingActive = state.players.filter((p) => !p.isWinner && !p.isEliminated);
  if (remainingActive.length <= 1) {
    endLudoGame(io, roomCode, state);
    return;
  }

  // Move to next player index in clockwise order (skip winners and eliminated players)
  let nextIndex = state.activePlayerIndex;
  let attempts = 0;
  do {
    nextIndex = (nextIndex + 1) % state.players.length;
    attempts += 1;
  } while (
    (state.players[nextIndex].isWinner || state.players[nextIndex].isEliminated) &&
    attempts < state.players.length
  );

  state.activePlayerIndex = nextIndex;

  io.to(roomCode).emit('ludo_new_turn', {
    activePlayerIndex: nextIndex,
    diceValue: null,
    hasRolled: false,
  });
  io.to(roomCode).emit('ludo_state_sync', state);

  resetTurnTimer(io, roomCode);

  // Check if next player is a bot
  const activePlayer = state.players[nextIndex];
  const roomPlayer = room.players.find((p) => p.id === activePlayer.id);
  if (roomPlayer && roomPlayer.isBot) {
    triggerBotTurn(io, roomCode, nextIndex);
  }
}

function startTurnTimer(io: Server, roomCode: string) {
  if (activeTimers[roomCode]) clearInterval(activeTimers[roomCode]);

  activeTimers[roomCode] = setInterval(() => {
    const room = roomStore.getRoom(roomCode);
    if (!room || room.status !== 'PLAYING') {
      clearInterval(activeTimers[roomCode]);
      return;
    }

    const state = room.gameState as LudoState;
    if (!state || state.isEnded) {
      clearInterval(activeTimers[roomCode]);
      return;
    }

    state.turnTimeLeft -= 1;
    io.to(roomCode).emit('ludo_timer_tick', state.turnTimeLeft);

    if (state.turnTimeLeft <= 0) {
      const activePlayer = state.players[state.activePlayerIndex];
      const currentToken = state.turnToken;

      // Only increment missed turn counter once per player turn cycle (when turn times out before rolling)
      if (!state.hasRolled) {
        activePlayer.unturnedMoves = (activePlayer.unturnedMoves || 0) + 1;

        io.to(roomCode).emit('chat_message', {
          id: Math.random().toString(),
          senderName: 'SYSTEM',
          content: `⚠️ ${activePlayer.username} missed turn (${activePlayer.unturnedMoves}/5).`,
          createdAt: new Date(),
        });

        // Broadcast state sync so all clients receive updated unturnedMoves count immediately
        io.to(roomCode).emit('ludo_state_sync', state);

        // If 5 missed turns, eliminate player from match
        if (activePlayer.unturnedMoves >= 5) {
          activePlayer.isEliminated = true;

          io.to(roomCode).emit('chat_message', {
            id: Math.random().toString(),
            senderName: 'SYSTEM',
            content: `🚨 ${activePlayer.username} has been eliminated due to 5 consecutive missed turns.`,
            createdAt: new Date(),
          });

          io.to(activePlayer.socketId).emit('room_kicked', { 
            message: 'You have been eliminated from the game due to 5 consecutive missed turns.' 
          });

          // Broadcast updated state after elimination
          io.to(roomCode).emit('ludo_state_sync', state);
          nextTurn(io, roomCode, currentToken);
        } else {
          // Auto-play turn for timed-out player
          triggerBotTurn(io, roomCode, state.activePlayerIndex);
        }
      } else {
        // If dice was rolled but movement timed out, trigger bot logic to move token
        triggerBotTurn(io, roomCode, state.activePlayerIndex);
      }
    }
  }, 1000);
}

function resetTurnTimer(io: Server, roomCode: string) {
  const room = roomStore.getRoom(roomCode);
  if (room && room.gameState) {
    const defaultTimer = (room as any).turnTimer || TURN_TIMEOUT;
    (room.gameState as LudoState).turnTimeLeft = defaultTimer;
  }
}

async function endLudoGame(io: Server, roomCode: string, state: LudoState) {
  if (state.isEnded) return;
  state.isEnded = true;

  if (activeTimers[roomCode]) clearInterval(activeTimers[roomCode]);

  const room = roomStore.getRoom(roomCode);
  if (!room) return;

  roomStore.updateRoomStatus(roomCode, 'FINISHED');

  const duration = Math.floor((Date.now() - state.startTime) / 1000);

  const placementsRewards = [
    { xp: 500, coins: 200 },
    { xp: 250, coins: 100 },
    { xp: 150, coins: 50 },
    { xp: 50, coins: 25 },
  ];

  // Map remaining non-winners by who is closest to finished (calculated by tokens distance)
  const sortedPlayers = [...state.players].sort((a, b) => {
    if (a.isWinner && b.isWinner) return (a.placement || 0) - (b.placement || 0);
    if (a.isWinner) return -1;
    if (b.isWinner) return 1;

    if (a.isEliminated && !b.isEliminated) return 1;
    if (!a.isEliminated && b.isEliminated) return -1;

    // Calculate sum of distances for non-winners
    const sumA = a.tokens.reduce((acc, t) => acc + (t.position === -1 ? 0 : t.position), 0);
    const sumB = b.tokens.reduce((acc, t) => acc + (t.position === -1 ? 0 : t.position), 0);
    return sumB - sumA; // higher distance is closer to completion
  });

  const scoreboardData = [];

  // Register match in DB
  const match = await prisma.match.create({
    data: {
      gameType: 'LUDO',
      durationSeconds: duration,
      winnerId: sortedPlayers[0].id,
    },
  });

  for (let i = 0; i < sortedPlayers.length; i++) {
    const p = sortedPlayers[i];
    const reward = placementsRewards[i] || { xp: 50, coins: 10 };
    const placement = i + 1;

    if (!p.id.startsWith('bot_')) {
      await awardUserStats(p.id, reward.xp, reward.coins);

      await prisma.matchPlayer.create({
        data: {
          matchId: match.id,
          userId: p.id,
          score: reward.xp * 2, // arbitrary score representation
          coinsEarned: reward.coins,
          placement,
        },
      });
    }

    scoreboardData.push({
      userId: p.id,
      username: p.displayName || p.username,
      displayName: p.displayName || p.username,
      color: p.color,
      placement,
      coinsEarned: reward.coins,
      xpEarned: reward.xp,
    });
  }

  io.to(roomCode).emit('ludo_match_ended', {
    duration,
    scoreboard: scoreboardData,
  });
}

function triggerBotTurn(io: Server, roomCode: string, botIndex: number) {
  // Wait 450ms for bot before rolling the dice
  setTimeout(() => {
    const room = roomStore.getRoom(roomCode);
    if (!room || room.status !== 'PLAYING') return;
    const state = room.gameState as LudoState;
    if (!state || state.isEnded || state.activePlayerIndex !== botIndex || state.hasRolled) return;

    // Roll dice
    const roll = Math.floor(Math.random() * 6) + 1;
    state.diceValue = roll;
    state.hasRolled = true;

    // Check consecutive sixes
    if (roll === 6) {
      state.consecutiveSixes += 1;
      if (state.consecutiveSixes === 3) {
        state.consecutiveSixes = 0;
        state.diceValue = null;
        state.hasRolled = false;
        io.to(roomCode).emit('ludo_dice_rolled', {
          diceValue: roll,
          activePlayerIndex: botIndex,
          validTokens: [],
        });
        const currentToken = state.turnToken;
        setTimeout(() => {
          nextTurn(io, roomCode, currentToken);
        }, 500);
        return;
      }
    } else {
      state.consecutiveSixes = 0;
    }

    const activePlayer = state.players[botIndex];
    const validMoves = getValidTokensToMove(activePlayer, roll);

    io.to(roomCode).emit('ludo_dice_rolled', {
      diceValue: roll,
      activePlayerIndex: botIndex,
      validTokens: validMoves,
    });

    // If no valid moves, switch turn after 500ms
    if (validMoves.length === 0) {
      activePlayer.unturnedMoves = 0;
      io.to(roomCode).emit('ludo_state_sync', state);
      const currentToken = state.turnToken;
      setTimeout(() => {
        nextTurn(io, roomCode, currentToken);
      }, 500);
      return;
    }

    // If there are valid moves, select the best move and execute it after 450ms
    setTimeout(() => {
      const currentRoom = roomStore.getRoom(roomCode);
      if (!currentRoom || currentRoom.status !== 'PLAYING') return;
      const curState = currentRoom.gameState as LudoState;
      if (!curState || curState.isEnded || curState.activePlayerIndex !== botIndex) return;

      // Bot strategy:
      // 1. Prefer moving a token that can capture an opponent.
      // 2. Prefer moving a token from yard (releasing a 6).
      // 3. Prefer moving a token that is close to winning (highest position).
      // 4. Default: first valid token.
      let selectedTokenId = validMoves[0];
      let bestScore = -100;

      for (const tokenId of validMoves) {
        const token = activePlayer.tokens.find(t => t.id === tokenId)!;
        let score = 0;

        // Calculate new position
        let newPos = token.position;
        if (token.position === -1 && roll === 6) {
          newPos = activePlayer.startCell;
          score += 50; // Releasing is good
        } else if (token.position >= 0 && token.position <= 51) {
          let temp = token.position;
          let entered = false;
          for (let i = 0; i < roll; i++) {
            if (temp === activePlayer.lastCell) { temp = activePlayer.stretchStart; entered = true; }
            else if (entered) temp += 1;
            else temp = (temp + 1) % 52;
          }
          newPos = temp;
          score += newPos; // Encourage moving forward
        } else if (token.position >= 52 && token.position <= 56) {
          newPos = token.position + roll;
          score += newPos * 1.5;
        }

        if (newPos === 57) {
          score += 100; // Winning a token is excellent
        }

        // Check if this move captures someone
        if (newPos >= 0 && newPos <= 51 && !SAFE_CELLS.includes(newPos)) {
          let captures = false;
          curState.players.forEach(p => {
            if (p.id !== activePlayer.id) {
              p.tokens.forEach(t => {
                if (t.position === newPos) captures = true;
              });
            }
          });
          if (captures) {
            score += 80; // Capturing is highly prioritized
          }
        }

        if (score > bestScore) {
          bestScore = score;
          selectedTokenId = tokenId;
        }
      }

      // Apply bot token move
      const token = activePlayer.tokens.find(t => t.id === selectedTokenId)!;
      const oldPosition = token.position;
      let finalPos = token.position;
      if (token.position === -1 && roll === 6) finalPos = activePlayer.startCell;
      else if (token.position >= 0 && token.position <= 51) {
        let temp = token.position;
        let entered = false;
        for (let i = 0; i < roll; i++) {
          if (temp === activePlayer.lastCell) { temp = activePlayer.stretchStart; entered = true; }
          else if (entered) temp += 1;
          else temp = (temp + 1) % 52;
        }
        finalPos = temp;
      } else if (token.position >= 52 && token.position <= 56) {
        finalPos = token.position + roll;
      }

      if (finalPos > 57) return;

      token.position = finalPos;
      activePlayer.unturnedMoves = 0;

      // Check capture
      let captured = false;
      if (finalPos >= 0 && finalPos <= 51 && !SAFE_CELLS.includes(finalPos)) {
        curState.players.forEach(p => {
          if (p.id !== activePlayer.id) {
            p.tokens.forEach(t => {
              if (t.position === finalPos) {
                t.position = -1;
                captured = true;
              }
            });
          }
        });
      }

      // Check if player won
      const botReachedGoal = (finalPos === 57);
      if (botReachedGoal) {
        const allFinished = activePlayer.tokens.every(t => t.position === 57);
        if (allFinished && !activePlayer.isWinner) {
          activePlayer.isWinner = true;
          const winnersCount = curState.players.filter(p => p.isWinner).length;
          activePlayer.placement = winnersCount;

          io.to(roomCode).emit('ludo_player_won', {
            playerId: activePlayer.id,
            placement: winnersCount,
          });

          const activePlayersCount = curState.players.filter(p => !p.isWinner && !p.isEliminated).length;
          if (activePlayersCount <= 1) {
            endLudoGame(io, roomCode, curState);
            return;
          }
        }
      }

      io.to(roomCode).emit('ludo_token_moved', {
        activePlayerIndex: botIndex,
        tokenId: selectedTokenId,
        oldPosition,
        newPosition: finalPos,
        captured,
        players: curState.players,
      });
      io.to(roomCode).emit('ludo_state_sync', curState);

      // Rule: Rolling a 6, capturing a token, or landing a token in Goal awards a bonus turn
      const awardBonus = (roll === 6 || captured || botReachedGoal) && !activePlayer.isWinner && !activePlayer.isEliminated;
      if (awardBonus) {
        curState.diceValue = null;
        curState.hasRolled = false;
        io.to(roomCode).emit('ludo_new_turn', {
          activePlayerIndex: botIndex,
          diceValue: null,
          hasRolled: false,
        });
        // Bot plays again!
        triggerBotTurn(io, roomCode, botIndex);
      } else {
        nextTurn(io, roomCode, curState.turnToken);
      }

    }, 1500);

  }, 1500);
}

