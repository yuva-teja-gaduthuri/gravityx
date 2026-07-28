import { Server, Socket } from 'socket.io';
import { roomStore, Player } from '../models/roomStore';
import prisma from '../utils/prisma';
import { awardUserStats } from '../utils/gameHelpers';

interface LudoToken {
  id: number; // 0, 1, 2, 3
  position: number; // -1 = Home yard, 0..51 = Main track, 52..57 = Home stretch, 58 = Home triangle (done)
}

interface LudoPlayer {
  id: string;
  username: string;
  socketId: string;
  color: 'red' | 'green' | 'yellow' | 'blue';
  startCell: number;
  lastCell: number; // last cell on track before entering home stretch
  stretchStart: number; // position value offset for stretch
  tokens: LudoToken[];
  isWinner: boolean;
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
        return {
          id: p.id,
          username: p.displayName || p.username,
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
        };
      });

      const gameState: LudoState = {
        players: ludoPlayers,
        activePlayerIndex: 0,
        diceValue: null,
        hasRolled: false,
        turnTimeLeft: TURN_TIMEOUT,
        startTime: Date.now(),
        consecutiveSixes: 0,
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
      if (!state) return socket.emit('error', 'Ludo game state missing');

      const activePlayer = state.players[state.activePlayerIndex];
      const playerSocket = room.players.find((p) => p.id === activePlayer.id);

      if (!playerSocket || playerSocket.socketId !== socket.id) {
        return socket.emit('error', "It's not your turn");
      }

      if (state.hasRolled) {
        return socket.emit('error', 'You have already rolled the dice');
      }

      // Roll 1..6
      const roll = Math.floor(Math.random() * 6) + 1;
      state.diceValue = roll;
      state.hasRolled = true;
      activePlayer.unturnedMoves = 0;

      // Rule: Three consecutive sixes loses turn
      if (roll === 6) {
        state.consecutiveSixes += 1;
        if (state.consecutiveSixes === 3) {
          state.consecutiveSixes = 0;
          state.diceValue = null;
          state.hasRolled = false;
          nextTurn(io, upperCode);
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

      // Reset turn timer for movement decision
      resetTurnTimer(io, upperCode);

      // If no valid moves, automatically switch turns after 2 seconds
      if (validMoves.length === 0) {
        setTimeout(() => {
          nextTurn(io, upperCode);
        }, 1500);
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
      if (!state || !state.hasRolled || state.diceValue === null) {
        return socket.emit('error', 'Invalid move parameters');
      }

      const activePlayer = state.players[state.activePlayerIndex];
      const playerSocket = room.players.find((p) => p.id === activePlayer.id);

      if (!playerSocket || playerSocket.socketId !== socket.id) {
        return socket.emit('error', "It's not your turn");
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
        let stepsMoved = 0;
        let tempPos = token.position;
        let enteredStretch = false;

        for (let i = 0; i < dice; i++) {
          if (tempPos === activePlayer.lastCell) {
            // Enter home stretch
            tempPos = activePlayer.stretchStart; // position 52
            enteredStretch = true;
          } else if (enteredStretch) {
            tempPos += 1;
          } else {
            tempPos = (tempPos + 1) % 52;
          }
        }
        newPosition = tempPos;
      } else if (token.position >= 52 && token.position <= 57) {
        // In home stretch
        newPosition = token.position + dice;
      }

      token.position = newPosition;

      // Handle collision (capturing opponent tokens)
      let captured = false;
      if (newPosition >= 0 && newPosition <= 51 && !SAFE_CELLS.includes(newPosition)) {
        // Find other players tokens on same cell
        state.players.forEach((p) => {
          if (p.id !== activePlayer.id) {
            p.tokens.forEach((t) => {
              if (t.position === newPosition) {
                // Landed on opponent token! Knock back to yard
                t.position = -1;
                captured = true;
              }
            });
          }
        });
      }

      // Check if player won / token reached home (58)
      if (newPosition === 58) {
        // check if all tokens finished
        const allFinished = activePlayer.tokens.every((t) => t.position === 58);
        if (allFinished && !activePlayer.isWinner) {
          activePlayer.isWinner = true;
          // Count winners to determine placement
          const winnersCount = state.players.filter((p) => p.isWinner).length;
          activePlayer.placement = winnersCount;

          io.to(roomCode).emit('ludo_player_won', {
            playerId: activePlayer.id,
            placement: winnersCount,
          });

          // Check if game should end (only one player/no active players left)
          const activePlayersCount = state.players.filter((p) => !p.isWinner).length;
          if (activePlayersCount <= 1) {
            await endLudoGame(io, roomCode, state);
            return;
          }
        }
      }

      console.log(`🎲 [LUDO MOVE]: Player ${activePlayer.username} (${activePlayer.color}) moved token ${tokenId} from ${oldPosition} -> ${newPosition} (Dice: ${dice}, Captured: ${captured})`);

      // Broadcast move animation update
      io.to(roomCode).emit('ludo_token_moved', {
        activePlayerIndex: state.activePlayerIndex,
        tokenId,
        oldPosition,
        newPosition,
        captured,
        players: state.players,
      });

      // Rule: Rolling a 6 or capturing a token awards a bonus turn
      const awardBonus = (dice === 6 || captured) && !activePlayer.isWinner;

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
        nextTurn(io, upperCode);
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
      valid.push(t.id); // track positions can always move
    }
    // If token is in home stretch (52..57)
    else if (t.position >= 52 && t.position <= 57) {
      // Must land exactly on 58
      if (t.position + dice <= 58) {
        valid.push(t.id);
      }
    }
  });

  return valid;
}

function nextTurn(io: Server, roomCode: string) {
  const room = roomStore.getRoom(roomCode);
  if (!room) return;

  const state = room.gameState as LudoState;
  if (!state) return;

  // Clear previous dice rolled state
  state.diceValue = null;
  state.hasRolled = false;

  // Move to next player index (skip winners)
  let nextIndex = state.activePlayerIndex;
  let attempts = 0;
  do {
    nextIndex = (nextIndex + 1) % state.players.length;
    attempts += 1;
  } while (state.players[nextIndex].isWinner && attempts < state.players.length);

  state.activePlayerIndex = nextIndex;

  io.to(roomCode).emit('ludo_new_turn', {
    activePlayerIndex: nextIndex,
    diceValue: null,
    hasRolled: false,
  });

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
    if (!state) {
      clearInterval(activeTimers[roomCode]);
      return;
    }

    state.turnTimeLeft -= 1;
    io.to(roomCode).emit('ludo_timer_tick', state.turnTimeLeft);

    if (state.turnTimeLeft <= 0) {
      const activePlayer = state.players[state.activePlayerIndex];

      // Only increment missed turn counter once per player turn cycle (when turn times out before rolling)
      if (!state.hasRolled) {
        activePlayer.unturnedMoves = (activePlayer.unturnedMoves || 0) + 1;

        // Broadcast state sync so all clients receive updated unturnedMoves count
        io.to(roomCode).emit('ludo_state_sync', state);

        io.to(roomCode).emit('chat_message', {
          id: Math.random().toString(),
          senderName: 'SYSTEM',
          content: `⚠️ ${activePlayer.username} missed turn (${activePlayer.unturnedMoves}/5).`,
          createdAt: new Date(),
        });

        // If 5 consecutive unturned moves, kick/forfeit player for inactivity
        if (activePlayer.unturnedMoves >= 5) {
          activePlayer.isWinner = true; // Mark as done to skip turn loop
          activePlayer.placement = state.players.filter((p) => p.isWinner).length;
          
          io.to(roomCode).emit('chat_message', {
            id: Math.random().toString(),
            senderName: 'SYSTEM',
            content: `🚨 ${activePlayer.username} left the game due to 5 consecutive unturned moves.`,
            createdAt: new Date(),
          });

          io.to(activePlayer.socketId).emit('room_kicked', { 
            message: 'You have been removed from the game due to 5 consecutive unturned moves.' 
          });

          nextTurn(io, roomCode);
          return;
        }

        // Auto Roll / Auto Move if timeout
        const roll = Math.floor(Math.random() * 6) + 1;
        state.diceValue = roll;
        state.hasRolled = true;
        state.consecutiveSixes = 0;

        const validMoves = getValidTokensToMove(activePlayer, roll);

        io.to(roomCode).emit('ludo_dice_rolled', {
          diceValue: roll,
          activePlayerIndex: state.activePlayerIndex,
          validTokens: validMoves,
        });

        // Trigger next turn automatically after 1.5 seconds if no valid moves
        if (validMoves.length === 0) {
          setTimeout(() => {
            nextTurn(io, roomCode);
          }, 1500);
        } else {
          // Force move the first valid token automatically after 2 seconds
          setTimeout(() => {
            const currentRoom = roomStore.getRoom(roomCode);
            if (currentRoom && currentRoom.status === 'PLAYING') {
              const curState = currentRoom.gameState as LudoState;
              if (curState && curState.activePlayerIndex === state.activePlayerIndex && curState.hasRolled) {
                const firstToken = validMoves[0];
                const activePl = curState.players[curState.activePlayerIndex];
                const token = activePl.tokens.find((t) => t.id === firstToken)!;
                const oldPos = token.position;
                let newPos = token.position;
                if (token.position === -1 && roll === 6) newPos = activePl.startCell;
                else if (token.position >= 0 && token.position <= 51) {
                  let temp = token.position;
                  let entered = false;
                  for (let i=0; i<roll; i++) {
                    if (temp === activePl.lastCell) { temp = activePl.stretchStart; entered = true; }
                    else if (entered) temp += 1;
                    else temp = (temp + 1) % 52;
                  }
                  newPos = temp;
                } else if (token.position >= 52 && token.position <= 57) newPos = token.position + roll;

                token.position = newPos;

                if (newPos >= 0 && newPos <= 51 && !SAFE_CELLS.includes(newPos)) {
                  curState.players.forEach(p => {
                    if (p.id !== activePl.id) p.tokens.forEach(t => { if (t.position === newPos) t.position = -1; });
                  });
                }

                io.to(roomCode).emit('ludo_token_moved', {
                  activePlayerIndex: curState.activePlayerIndex,
                  tokenId: firstToken,
                  oldPosition: oldPos,
                  newPosition: newPos,
                  captured: false,
                  players: curState.players,
                });

                setTimeout(() => {
                  nextTurn(io, roomCode);
                }, 1000);
              }
            }
          }, 2000);
        }
      } else {
        // If movement phase timer expired, move turn to next player without duplicate increment
        nextTurn(io, roomCode);
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
  if (activeTimers[roomCode]) clearInterval(activeTimers[roomCode]);

  const room = roomStore.getRoom(roomCode);
  if (!room) return;

  const duration = Math.floor((Date.now() - state.startTime) / 1000);

  // Determine ranking and award stats
  // First place: 1000 XP, 200 Coins
  // Second place: 500 XP, 100 Coins
  // Third place: 300 XP, 50 Coins
  // Fourth place: 100 XP, 25 Coins
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
      username: p.username,
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
  // Wait 1.5 seconds for bot to "think" before rolling the dice
  setTimeout(() => {
    const room = roomStore.getRoom(roomCode);
    if (!room || room.status !== 'PLAYING') return;
    const state = room.gameState as LudoState;
    if (!state || state.activePlayerIndex !== botIndex || state.hasRolled) return;

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
        setTimeout(() => {
          nextTurn(io, roomCode);
        }, 1500);
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

    // If no valid moves, switch turn after 1.5 seconds
    if (validMoves.length === 0) {
      setTimeout(() => {
        nextTurn(io, roomCode);
      }, 1500);
      return;
    }

    // If there are valid moves, select the best move and execute it after 1.5 seconds
    setTimeout(() => {
      const currentRoom = roomStore.getRoom(roomCode);
      if (!currentRoom || currentRoom.status !== 'PLAYING') return;
      const curState = currentRoom.gameState as LudoState;
      if (!curState || curState.activePlayerIndex !== botIndex) return;

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
        } else if (token.position >= 52 && token.position <= 57) {
          newPos = token.position + roll;
          score += newPos * 1.5;
        }

        if (newPos === 58) {
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
      } else if (token.position >= 52 && token.position <= 57) {
        finalPos = token.position + roll;
      }

      token.position = finalPos;

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
      if (finalPos === 58) {
        const allFinished = activePlayer.tokens.every(t => t.position === 58);
        if (allFinished && !activePlayer.isWinner) {
          activePlayer.isWinner = true;
          const winnersCount = curState.players.filter(p => p.isWinner).length;
          activePlayer.placement = winnersCount;

          io.to(roomCode).emit('ludo_player_won', {
            playerId: activePlayer.id,
            placement: winnersCount,
          });

          const activePlayersCount = curState.players.filter(p => !p.isWinner).length;
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

      // Rule: Rolling a 6 or capturing a token awards a bonus turn
      const awardBonus = (roll === 6 || captured) && !activePlayer.isWinner;
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
        nextTurn(io, roomCode);
      }

    }, 1500);

  }, 1500);
}
