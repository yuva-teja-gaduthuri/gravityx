'use client';

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { Trophy, Timer, Play, ShieldAlert, Sparkles } from 'lucide-react';
import { playDiceRoll, playTokenMove, playTokenCapture, playVictory } from '../utils/soundEffects';

interface LudoToken {
  id: number;
  position: number;
}

interface LudoPlayer {
  id: string;
  username: string;
  socketId: string;
  color: 'red' | 'green' | 'yellow' | 'blue';
  tokens: LudoToken[];
  isWinner: boolean;
  placement?: number;
}

interface LudoState {
  players: LudoPlayer[];
  activePlayerIndex: number;
  diceValue: number | null;
  hasRolled: boolean;
  turnTimeLeft: number;
}

interface LudoGameProps {
  roomCode: string;
  user: { id: string; username: string };
  socket: Socket;
  matchEndedData?: any;
  onReturnToLobby: () => void;
}

// Map 52 outer track indexes to [col, row] indexes (0-based) on a 15x15 grid
const TRACK_COORDINATES: { [idx: number]: [number, number] } = {
  0: [1, 6], 1: [2, 6], 2: [3, 6], 3: [4, 6], 4: [5, 6],
  5: [6, 5], 6: [6, 4], 7: [6, 3], 8: [6, 2], 9: [6, 1], 10: [6, 0],
  11: [7, 0],
  12: [8, 0], 13: [8, 1], 14: [8, 2], 15: [8, 3], 16: [8, 4], 17: [8, 5],
  18: [9, 6], 19: [10, 6], 20: [11, 6], 21: [12, 6], 22: [13, 6], 23: [14, 6],
  24: [14, 7],
  25: [14, 8], 26: [13, 8], 27: [12, 8], 28: [11, 8], 29: [10, 8], 30: [9, 8],
  31: [8, 9], 32: [8, 10], 33: [8, 11], 34: [8, 12], 35: [8, 13], 36: [8, 14],
  37: [7, 14],
  38: [6, 14], 39: [6, 13], 40: [6, 12], 41: [6, 11], 42: [6, 10], 43: [6, 9],
  44: [5, 8], 45: [4, 8], 46: [3, 8], 47: [2, 8], 48: [1, 8], 49: [0, 8],
  50: [0, 7],
  51: [0, 6],
};

// Home stretch mapping
const STRETCH_COORDINATES: { [color: string]: { [idx: number]: [number, number] } } = {
  red: {
    52: [1, 7], 53: [2, 7], 54: [3, 7], 55: [4, 7], 56: [5, 7], 57: [6, 7], 58: [7, 7]
  },
  green: {
    52: [7, 1], 53: [7, 2], 54: [7, 3], 55: [7, 4], 56: [7, 5], 57: [7, 6], 58: [7, 7]
  },
  yellow: {
    52: [13, 7], 53: [12, 7], 54: [11, 7], 55: [10, 7], 56: [9, 7], 57: [8, 7], 58: [7, 7]
  },
  blue: {
    52: [7, 13], 53: [7, 12], 54: [7, 11], 55: [7, 10], 56: [7, 9], 57: [7, 8], 58: [7, 7]
  }
};

// Home yards (base initial placements)
const BASE_COORDINATES: { [color: string]: [number, number][] } = {
  red: [[2, 2], [3, 2], [2, 3], [3, 3]],
  green: [[11, 2], [12, 2], [11, 3], [12, 3]],
  yellow: [[11, 11], [12, 11], [11, 12], [12, 12]],
  blue: [[2, 11], [3, 11], [2, 12], [3, 12]]
};

export default function LudoGame({ roomCode, user, socket, matchEndedData, onReturnToLobby }: LudoGameProps) {
  const [gameState, setGameState] = useState<LudoState | null>(null);
  const [validTokens, setValidTokens] = useState<number[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [rollingValue, setRollingValue] = useState<number>(1);
  const [matchEnded, setMatchEnded] = useState(matchEndedData ? true : false);
  const [scoreboard, setScoreboard] = useState<any[]>(matchEndedData?.scoreboard || []);

  useEffect(() => {
    if (matchEndedData) {
      setMatchEnded(true);
      setScoreboard(matchEndedData.scoreboard || []);
    }
  }, [matchEndedData]);

  useEffect(() => {
    socket.on('ludo_game_started', (data: any) => {
      setGameState(data.gameState);
      setMatchEnded(false);
    });

    socket.on('ludo_state_sync', (state: LudoState) => {
      setGameState(state);
    });

    socket.on('ludo_timer_tick', (timeLeft: number) => {
      setGameState(prev => prev ? { ...prev, turnTimeLeft: timeLeft } : null);
    });

    socket.on('ludo_dice_rolled', (data: any) => {
      setIsRolling(true);
      playDiceRoll();
      // Simulate random dice cycles
      let count = 0;
      const interval = setInterval(() => {
        setRollingValue(Math.floor(Math.random() * 6) + 1);
        count++;
        if (count > 10) {
          clearInterval(interval);
          setIsRolling(false);
          setRollingValue(data.diceValue);
          setGameState(prev => prev ? { ...prev, diceValue: data.diceValue, hasRolled: true } : null);
          
          const isMyTurn = gameState?.players[gameState.activePlayerIndex]?.id === user.id;
          if (isMyTurn) {
            setValidTokens(data.validTokens);
          }
        }
      }, 80);
    });

    socket.on('ludo_token_moved', (data: any) => {
      if (data.captured) {
        playTokenCapture();
      } else {
        playTokenMove();
      }
      setGameState(prev => prev ? { 
        ...prev, 
        players: data.players,
        diceValue: null,
        hasRolled: false
      } : null);
      setValidTokens([]);
    });

    socket.on('ludo_new_turn', (data: any) => {
      setGameState(prev => prev ? { 
        ...prev, 
        activePlayerIndex: data.activePlayerIndex,
        diceValue: null,
        hasRolled: false
      } : null);
      setValidTokens([]);
    });

    socket.on('ludo_match_ended', (data: any) => {
      playVictory();
      setMatchEnded(true);
      setScoreboard(data.scoreboard || []);
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    });

    // Send initial request to sync
    socket.emit('ludo_sync_state', roomCode);

    return () => {
      socket.off('ludo_game_started');
      socket.off('ludo_state_sync');
      socket.off('ludo_timer_tick');
      socket.off('ludo_dice_rolled');
      socket.off('ludo_token_moved');
      socket.off('ludo_new_turn');
      socket.off('ludo_match_ended');
    };
  }, [socket, gameState, roomCode, user.id]);

  const handleRollDice = () => {
    if (!gameState) return;
    const activePlayer = gameState.players[gameState.activePlayerIndex];
    if (activePlayer.id !== user.id) return;
    if (gameState.hasRolled || isRolling) return;

    socket.emit('ludo_roll_dice', roomCode);
  };

  const handleMoveToken = (tokenId: number) => {
    if (!gameState) return;
    const activePlayer = gameState.players[gameState.activePlayerIndex];
    if (activePlayer.id !== user.id) return;
    if (!validTokens.includes(tokenId)) return;

    socket.emit('ludo_move_token', { roomCode, tokenId });
  };

  if (!gameState) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <p className="text-sm font-bold text-gray-500 animate-pulse">Syncing Ludo Game state...</p>
      </div>
    );
  }

  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const isMyTurn = activePlayer.id === user.id;

  const hasGreenPlayer = gameState.players.some((p) => p.color === 'green');
  const hasBluePlayer = gameState.players.some((p) => p.color === 'blue');

  // Get absolute grid placement [col, row] for a token
  const getTokenCoords = (player: LudoPlayer, token: LudoToken): [number, number] => {
    if (token.position === -1) {
      // Home base yard
      return BASE_COORDINATES[player.color][token.id];
    } else if (token.position >= 0 && token.position <= 51) {
      // Main track
      return TRACK_COORDINATES[token.position];
    } else if (token.position >= 52 && token.position <= 58) {
      // Home stretch
      return STRETCH_COORDINATES[player.color][token.position];
    }
    return [7, 7]; // Fallback to center
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto w-full p-4 items-center justify-center">
      {/* Ludo Board Panel */}
      <div className="relative w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] bg-darkbg border border-white/10 rounded-2xl p-1 overflow-hidden shadow-neon-blue">
        {/* Render 15x15 Ludo Grid Layout */}
        <div className="grid grid-cols-15 grid-rows-15 w-full h-full gap-0.5 relative">
          
          {/* Top-Left Red Base */}
          <div className="col-span-6 row-span-6 bg-[#ff3b30] border-4 border-[#050816] rounded-xl relative flex items-center justify-center p-3">
            <div className="w-full h-full bg-white rounded-lg flex items-center justify-center p-2 gap-2 grid grid-cols-2">
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#ff3b30] bg-[#ff3b30]/10 shadow-inner"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#ff3b30] bg-[#ff3b30]/10 shadow-inner"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#ff3b30] bg-[#ff3b30]/10 shadow-inner"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#ff3b30] bg-[#ff3b30]/10 shadow-inner"></div>
            </div>
          </div>

          {/* Top-Middle Green Column Track */}
          <div className="col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 gap-0.5">
            {Array.from({ length: 18 }).map((_, idx) => {
              const col = idx % 3;
              const row = Math.floor(idx / 3);
              let bg = 'bg-white/5 border border-white/5';
              if (col === 1 && row > 0) bg = 'bg-[#34c759] border border-white/20'; // Home stretch
              if (col === 2 && row === 1) bg = 'bg-[#34c759] border-2 border-white/40 shadow-inner relative'; // Green start
              const isStar = (col === 2 && row === 1) || (col === 0 && row === 2);
              return (
                <div key={`g-${idx}`} className={`rounded ${bg} flex items-center justify-center text-[10px] text-white/30 font-bold`}>
                  {isStar ? '★' : ''}
                  {col === 2 && row === 1 && <span className="absolute text-[8px] sm:text-xs text-white/95 font-black">▼</span>}
                </div>
              );
            })}
          </div>

          {/* Top-Right Green Base */}
          <div className={`col-span-6 row-span-6 bg-[#34c759] border-4 border-[#050816] rounded-xl relative flex items-center justify-center p-3 transition-all duration-300 ${!hasGreenPlayer ? 'opacity-25 grayscale' : ''}`}>
            <div className="w-full h-full bg-white rounded-lg flex items-center justify-center p-2 gap-2 grid grid-cols-2">
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#34c759] bg-[#34c759]/10 shadow-inner"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#34c759] bg-[#34c759]/10 shadow-inner"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#34c759] bg-[#34c759]/10 shadow-inner"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#34c759] bg-[#34c759]/10 shadow-inner"></div>
            </div>
          </div>

          {/* Left-Middle Red Column Track */}
          <div className="col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 gap-0.5">
            {Array.from({ length: 18 }).map((_, idx) => {
              const col = idx % 6;
              const row = Math.floor(idx / 6);
              let bg = 'bg-white/5 border border-white/5';
              if (row === 1 && col > 0) bg = 'bg-[#ff3b30] border border-white/20'; // Home stretch
              if (row === 0 && col === 1) bg = 'bg-[#ff3b30] border-2 border-white/40 shadow-inner relative'; // Red start
              const isStar = (row === 0 && col === 1) || (row === 2 && col === 2);
              return (
                <div key={`r-${idx}`} className={`rounded ${bg} flex items-center justify-center text-[10px] text-white/30 font-bold`}>
                  {isStar ? '★' : ''}
                  {row === 0 && col === 1 && <span className="absolute text-[8px] sm:text-xs text-white/95 font-black">➜</span>}
                </div>
              );
            })}
          </div>

          {/* Center Goal Terminal */}
          <div className="col-span-3 row-span-3 bg-gradient-to-br from-primary to-darkbg border border-white/10 rounded-xl flex items-center justify-center flex-col relative overflow-hidden">
            {/* Split triangles for traditional center */}
            <div className="absolute inset-0 bg-[#050816]">
              <div className="absolute inset-0 bg-[#ff3b30]" style={{ clipPath: 'polygon(50% 50%, 0 0, 0 100%)' }}></div>
              <div className="absolute inset-0 bg-[#34c759]" style={{ clipPath: 'polygon(50% 50%, 0 0, 100% 0)' }}></div>
              <div className="absolute inset-0 bg-[#ffcc00]" style={{ clipPath: 'polygon(50% 50%, 100% 0, 100% 100%)' }}></div>
              <div className="absolute inset-0 bg-[#007aff]" style={{ clipPath: 'polygon(50% 50%, 0 100%, 100% 100%)' }}></div>
            </div>
            <div className="relative z-10 flex flex-col items-center justify-center bg-[#050816]/30 w-10 h-10 rounded-full border border-white/20">
              <Trophy className="text-white sm:w-5 sm:h-5 w-4 h-4" />
            </div>
          </div>

          {/* Right-Middle Yellow Column Track */}
          <div className="col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 gap-0.5">
            {Array.from({ length: 18 }).map((_, idx) => {
              const col = idx % 6;
              const row = Math.floor(idx / 6);
              let bg = 'bg-white/5 border border-white/5';
              if (row === 1 && col < 5) bg = 'bg-[#ffcc00] border border-white/20'; // Home stretch
              if (row === 2 && col === 4) bg = 'bg-[#ffcc00] border-2 border-white/40 shadow-inner relative'; // Yellow start
              const isStar = (row === 2 && col === 4) || (row === 0 && col === 3);
              return (
                <div key={`y-${idx}`} className={`rounded ${bg} flex items-center justify-center text-[10px] text-white/30 font-bold`}>
                  {isStar ? '★' : ''}
                  {row === 2 && col === 4 && <span className="absolute text-[8px] sm:text-xs text-white/95 font-black">◀</span>}
                </div>
              );
            })}
          </div>

          {/* Bottom-Left Blue Base */}
          <div className={`col-span-6 row-span-6 bg-[#007aff] border-4 border-[#050816] rounded-xl relative flex items-center justify-center p-3 transition-all duration-300 ${!hasBluePlayer ? 'opacity-25 grayscale' : ''}`}>
            <div className="w-full h-full bg-white rounded-lg flex items-center justify-center p-2 gap-2 grid grid-cols-2">
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#007aff] bg-[#007aff]/10 shadow-inner"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#007aff] bg-[#007aff]/10 shadow-inner"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#007aff] bg-[#007aff]/10 shadow-inner"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#007aff] bg-[#007aff]/10 shadow-inner"></div>
            </div>
          </div>

          {/* Bottom-Middle Blue Column Track */}
          <div className="col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 gap-0.5">
            {Array.from({ length: 18 }).map((_, idx) => {
              const col = idx % 3;
              const row = Math.floor(idx / 3);
              let bg = 'bg-white/5 border border-white/5';
              if (col === 1 && row < 5) bg = 'bg-[#007aff] border border-white/20'; // Home stretch
              if (col === 0 && row === 4) bg = 'bg-[#007aff] border-2 border-white/40 shadow-inner relative'; // Blue start
              const isStar = (col === 0 && row === 4) || (col === 2 && row === 3);
              return (
                <div key={`b-${idx}`} className={`rounded ${bg} flex items-center justify-center text-[10px] text-white/30 font-bold`}>
                  {isStar ? '★' : ''}
                  {col === 0 && row === 4 && <span className="absolute text-[8px] sm:text-xs text-white/95 font-black">▲</span>}
                </div>
              );
            })}
          </div>

          {/* Bottom-Right Yellow Base */}
          <div className="col-span-6 row-span-6 bg-[#ffcc00] border-4 border-[#050816] rounded-xl relative flex items-center justify-center p-3">
            <div className="w-full h-full bg-white rounded-lg flex items-center justify-center p-2 gap-2 grid grid-cols-2">
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#ffcc00] bg-[#ffcc00]/10 shadow-inner"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#ffcc00] bg-[#ffcc00]/10 shadow-inner"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#ffcc00] bg-[#ffcc00]/10 shadow-inner"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border-2 border-[#ffcc00] bg-[#ffcc00]/10 shadow-inner"></div>
            </div>
          </div>

          {/* Absolute Tokens Overlay Layer with Stacking Displacement */}
          {(() => {
            const tokenGroups: { [coordKey: string]: { player: LudoPlayer; token: LudoToken; isEligible: boolean; playerIndex: number }[] } = {};

            gameState.players.forEach((p, pIdx) => {
              p.tokens.forEach((t) => {
                const [col, row] = getTokenCoords(p, t);
                const coordKey = `${col},${row}`;
                const isTokenEligible = isMyTurn && validTokens.includes(t.id);
                
                if (!tokenGroups[coordKey]) {
                  tokenGroups[coordKey] = [];
                }
                tokenGroups[coordKey].push({ player: p, token: t, isEligible: isTokenEligible, playerIndex: pIdx });
              });
            });

            return Object.entries(tokenGroups).flatMap(([coordKey, tokensInGroup]) => {
              const [colStr, rowStr] = coordKey.split(',');
              const col = parseInt(colStr, 10);
              const row = parseInt(rowStr, 10);
              const count = tokensInGroup.length;

              return tokensInGroup.map((item, idx) => {
                const { player: p, token: t, isEligible: isTokenEligible } = item;
                
                let tokenBg = 'bg-cybererror shadow-neon-error';
                if (p.color === 'green') tokenBg = 'bg-cybersuccess shadow-neon-success';
                else if (p.color === 'yellow') tokenBg = 'bg-cybergold shadow-neon-gold';
                else if (p.color === 'blue') tokenBg = 'bg-cyberblue shadow-neon-blue';

                let dx = 0;
                let dy = 0;
                let sizeClass = 'w-5 h-5 sm:w-8 sm:h-8';
                let textClass = 'text-[8px] sm:text-xs';

                if (count > 1) {
                  // Render smaller overlapping tokens and spread them out
                  sizeClass = 'w-4 h-4 sm:w-6 sm:h-6';
                  textClass = 'text-[6px] sm:text-[10px]';
                  const angle = (idx * 2 * Math.PI) / count;
                  const radius = count === 2 ? 6 : 8;
                  dx = Math.round(Math.cos(angle) * radius);
                  dy = Math.round(Math.sin(angle) * radius);
                }

                return (
                  <button
                    key={`${p.color}-${t.id}`}
                    onClick={() => handleMoveToken(t.id)}
                    disabled={!isTokenEligible}
                    className={`absolute rounded-full border-2 border-white/60 flex items-center justify-center font-bold text-white z-20 transition-all duration-300 ${sizeClass} ${textClass} ${tokenBg} ${
                      isTokenEligible ? 'animate-bounce cursor-pointer scale-110 border-cyberblue ring-2 ring-cyberblue/50 z-30' : 'cursor-default'
                    }`}
                    style={{
                      left: `calc((${col} * 100% / 15) + 2px)`,
                      top: `calc((${row} * 100% / 15) + 2px)`,
                      transform: count > 1 ? `translate(${dx}px, ${dy}px)` : undefined,
                    }}
                  >
                    {t.id + 1}
                  </button>
                );
              });
            });
          })()}
        </div>
      </div>

      {/* Control Console Sidebar */}
      <div className="w-full max-w-sm flex flex-col gap-5">
        
        {/* Status card */}
        <div className="glass-panel rounded-2xl p-5 border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Console Telemetry</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-cybersuccess/10 border border-cybersuccess/20 text-xs font-semibold text-cybersuccess animate-pulse">
              LIVE MATCH
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-white/5 pt-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border border-white/10 uppercase ${
              activePlayer.color === 'red' ? 'bg-cybererror/20 text-cybererror' :
              activePlayer.color === 'green' ? 'bg-cybersuccess/20 text-cybersuccess' :
              activePlayer.color === 'yellow' ? 'bg-cybergold/20 text-cybergold' : 'bg-cyberblue/20 text-cyberblue'
            }`}>
              {activePlayer.username[0]}
            </div>
            <div>
              <div className="text-sm font-extrabold flex items-center gap-2">
                {activePlayer.username} 
                <span className="text-[9px] font-bold text-gray-500">({activePlayer.color})</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {isMyTurn ? "It's your turn! Roll or select token." : "Waiting for player command..."}
              </p>
            </div>
          </div>
        </div>

        {/* Dice Roller Console */}
        <div className="glass-card rounded-2xl p-6 border-white/5 flex flex-col items-center justify-center text-center space-y-4">
          {/* 3D Dice Simulation Rendering */}
          <div className="dice-scene">
            <div 
              className={`dice-cube ${isRolling ? 'animate-spin-slow' : ''}`}
              data-roll={rollingValue}
            >
              <div className={`dice-face bg-primary/30 text-white ${
                activePlayer.color === 'red' ? 'border-cybererror text-cybererror' :
                activePlayer.color === 'green' ? 'border-cybersuccess text-cybersuccess' :
                activePlayer.color === 'yellow' ? 'border-cybergold text-cybergold' : 'border-cyberblue text-cyberblue'
              }`}>
                {rollingValue}
              </div>
            </div>
          </div>

          <div className="text-center pt-2">
            <button
              onClick={handleRollDice}
              disabled={!isMyTurn || gameState.hasRolled || isRolling}
              className={`px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 text-sm shadow-neon-blue bg-gradient-to-r from-primary to-cyberblue hover:opacity-90 transition-all ${
                (!isMyTurn || gameState.hasRolled || isRolling) ? 'opacity-30 cursor-default' : 'active:scale-95'
              }`}
            >
              <Play size={16} /> Roll Dice
            </button>
          </div>
        </div>

        {/* Valid Tokens Selector (backup fallback buttons for mobile layout) */}
        {isMyTurn && validTokens.length > 0 && (
          <div className="glass-panel rounded-2xl p-5 border-white/5 space-y-3">
            <h5 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
              <Sparkles size={12} className="text-cyberblue" /> Eligible Movements
            </h5>
            <div className="grid grid-cols-2 gap-3">
              {validTokens.map((tokenId) => (
                <button
                  key={tokenId}
                  onClick={() => handleMoveToken(tokenId)}
                  className="py-3 rounded-xl border border-cyberblue/20 bg-cyberblue/10 hover:bg-cyberblue/20 text-xs font-black text-white hover:scale-[1.02] transition-all"
                >
                  Move Token {tokenId + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Match Results Scoreboard Modal */}
      {matchEnded && scoreboard.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden shadow-neon-purple">
            <div className="text-center mb-6">
              <span className="text-[10px] font-black uppercase text-cyberblue tracking-widest">Match Terminal Ended</span>
              <h3 className="text-3xl font-extrabold text-white mt-1">Ludo Terminal Results</h3>
              <p className="text-sm text-gray-400 mt-1">Placements locked. Transmitting score stats.</p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="divide-y divide-white/5">
                {scoreboard.map((row) => (
                  <div key={row.userId} className="flex justify-between items-center py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-400">#{row.placement}</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] uppercase font-bold border border-white/10`}>
                          {row.username[0]}
                        </div>
                        <div>
                          <span className="font-bold text-gray-200">{row.username}</span>
                          <span className="text-[10px] text-gray-500 ml-2 font-semibold">({row.color})</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 items-center">
                      <span className="text-xs font-semibold text-gray-400">+{row.xpEarned} XP</span>
                      <span className="text-xs font-extrabold text-cybergold">+{row.coinsEarned} 🪙</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={onReturnToLobby}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-cyberblue font-bold shadow-neon-blue hover:opacity-90 transition-all text-center"
            >
              Return to Lobby deck
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
