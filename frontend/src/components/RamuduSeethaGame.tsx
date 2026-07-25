'use client';

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { HelpCircle, Star, ShieldCheck, Crown } from 'lucide-react';

interface Player {
  id: string;
  username: string;
  avatar: string;
  profileFrame: string;
  isRevealed?: boolean;
  role?: string;
}

interface ScoreboardRow {
  userId: string;
  username: string;
  score: number;
  xpEarned: number;
  coinsEarned: number;
  placement: number;
}

interface RSGameProps {
  roomCode: string;
  user: { id: string; username: string };
  socket: Socket;
  isHost: boolean;
  matchEndedData?: any;
  onReturnToLobby?: () => void;
}

export default function RamuduSeethaGame({ roomCode, user, socket, isHost, matchEndedData, onReturnToLobby }: RSGameProps) {
  const [myRole, setMyRole] = useState<string>('');
  const [ramuduId, setRamuduId] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [guesses, setGuesses] = useState<number>(0);
  const [guessResult, setGuessResult] = useState<{ username: string; role: string; isCorrect: boolean } | null>(null);

  // Multi-round session states
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [maxRounds, setMaxRounds] = useState<number>(3);
  const [sessionScoreboard, setSessionScoreboard] = useState<{ [userId: string]: { username: string; score: number } }>({});
  const [roundScores, setRoundScores] = useState<{ [userId: string]: number }>({});
  const [roundEnded, setRoundEnded] = useState<boolean>(false);
  const [roundData, setRoundData] = useState<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Match ended state
  const [matchEnded, setMatchEnded] = useState(false);
  const [matchResults, setMatchResults] = useState<{
    winnerId: string;
    seethaId: string;
    guessCount: number;
    scoreboard: ScoreboardRow[];
  } | null>(null);

  const playersRef = useRef<Player[]>([]);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Handle countdown ticks
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    socket.on('rs_game_started', (data: any) => {
      setMyRole(data.myRole);
      setRamuduId(data.ramuduId);
      setPlayers(data.players);
      setRevealedIds([]);
      setMatchEnded(false);
      setMatchResults(null);
      setRoundEnded(false);
      setRoundData(null);
      setGuesses(0);
      setRoundScores({});
      setCountdown(null);
      setCurrentRound(data.currentRound || 1);
      setMaxRounds(data.maxRounds || 3);
      setSessionScoreboard(data.sessionScoreboard || {});
    });

    socket.on('rs_guess_result', (data: any) => {
      setRevealedIds(data.revealedIds);
      
      if (data.targetUserId) {
        setPlayers((prev) =>
          prev.map((pl) =>
            pl.id === data.targetUserId
              ? { ...pl, isRevealed: true, role: data.targetRole }
              : pl
          )
        );
      }

      const targetUser = playersRef.current.find((p) => p.id === data.targetUserId);
      if (targetUser) {
        setGuessResult({
          username: targetUser.username,
          role: data.targetRole,
          isCorrect: data.isSeetha
        });
        setTimeout(() => setGuessResult(null), 3000);
      }
      setGuesses(prev => prev + 1);
    });

    socket.on('rs_round_ended', (data: any) => {
      setRoundEnded(true);
      setRoundData(data);
      setSessionScoreboard(data.sessionScoreboard || {});
      setRoundScores(data.roundScores || {});
      if (data.countdownDuration) {
        setCountdown(data.countdownDuration);
      }
      confetti({
        particleCount: 80,
        spread: 50,
        origin: { y: 0.7 }
      });
    });

    socket.on('rs_match_ended', (data: any) => {
      setMatchEnded(true);
      setMatchResults(data);
      confetti({
        particleCount: 200,
        spread: 90,
        origin: { y: 0.6 }
      });
    });

    socket.emit('rs_sync_state', roomCode);

    return () => {
      socket.off('rs_game_started');
      socket.off('rs_guess_result');
      socket.off('rs_round_ended');
      socket.off('rs_match_ended');
    };
  }, [socket, roomCode]); // Removed players from dependencies to avoid infinite loops

  const handleCardClick = (targetPlayerId: string) => {
    if (matchEnded || roundEnded) return;
    if (user.id !== ramuduId) return;
    if (targetPlayerId === user.id || revealedIds.includes(targetPlayerId)) return;

    socket.emit('rs_guess', {
      roomCode,
      targetUserId: targetPlayerId
    });
  };

  const isRamudu = user.id === ramuduId;

  // Prepare scoreboard sorting and ranking
  const sortedScoreboard = Object.entries(sessionScoreboard)
    .map(([userId, val]) => {
      const playerInfo = players.find((p) => p.id === userId);
      return {
        userId,
        username: val.username,
        score: val.score,
        avatar: playerInfo?.avatar || 'default_avatar',
        profileFrame: playerInfo?.profileFrame || 'default_frame',
      };
    })
    .sort((a, b) => b.score - a.score);

  const leaderId = sortedScoreboard[0]?.userId;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 w-full max-w-7xl mx-auto items-stretch min-h-0">
      
      {/* LEFT: Game Card Area */}
      <div className="flex-1 flex flex-col space-y-6 min-w-0">
        
        {/* Top dashboard row: Session stats and Identity status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 glass-panel rounded-2xl p-5 border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyberblue/10 text-cyberblue flex items-center justify-center shrink-0">
              <Star size={22} className="fill-cyberblue/20 animate-spin-slow" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500">Campaign Progress</div>
              <div className="text-lg font-black text-white">Round {currentRound} / {maxRounds}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-start sm:justify-center">
            <div className="w-10 h-10 rounded-xl bg-cyberpink/10 text-cyberpink flex items-center justify-center shrink-0">
              <span className="font-extrabold text-lg">🎭</span>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500">Your secret role</div>
              <div className="text-base font-black text-cyberpink tracking-wide uppercase truncate max-w-[150px]">
                {myRole || 'Distributing...'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-start sm:justify-end">
            <div className="w-10 h-10 rounded-xl bg-cybergold/10 text-cybergold flex items-center justify-center shrink-0">
              <span className="font-extrabold text-lg">🏹</span>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500">Ramudu Guesser</div>
              <div className="text-sm font-bold text-cyberblue truncate max-w-[150px]">
                {players.find(p => p.id === ramuduId)?.username || 'Selecting...'}
              </div>
            </div>
          </div>
        </div>

        {/* Player Cards Area */}
        <div className="space-y-4">
          {guessResult && (
            <div className={`p-4 rounded-xl flex items-center justify-center font-bold border text-sm transition-all duration-300 ${
              guessResult.isCorrect 
                ? 'bg-cybersuccess/10 border-cybersuccess text-cybersuccess animate-bounce' 
                : 'bg-cybererror/10 border-cybererror text-cybererror animate-pulse'
            }`}>
              {guessResult.username} was revealed as: {guessResult.role}! {guessResult.isCorrect ? 'FOUND SEETHA!' : 'NOT SEETHA.'}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
            {players.map((p) => {
              const isGuesserSelf = p.id === user.id;
              const isTargetRevealed = revealedIds.includes(p.id);
              const cardRole = isGuesserSelf ? myRole : isTargetRevealed ? p.role || 'Revealed' : null;
              
              const isPlayerRamudu = p.id === ramuduId;
              const isPlayerSeetha = cardRole === 'Seetha';
              const isPlayerDeity = cardRole && cardRole !== 'Ramudu' && cardRole !== 'Seetha';

              let cardBorderClass = 'border-white/5 bg-gradient-to-b from-white/5 to-transparent';
              let subtitleColorClass = 'text-gray-500';
              let roleName = 'MYSTIC DEITY';
              let characterBadge = '✨';

              if (isPlayerRamudu) {
                cardBorderClass = 'border-cyberblue bg-cyberblue/5 shadow-neon-blue';
                subtitleColorClass = 'text-cyberblue font-extrabold';
                roleName = 'RAMUDU';
                characterBadge = '🏹';
              } else if (isPlayerSeetha) {
                cardBorderClass = 'border-cyberpink bg-cyberpink/5 shadow-neon-pink';
                subtitleColorClass = 'text-cyberpink font-extrabold';
                roleName = 'SEETHA';
                characterBadge = '🌸';
              } else if (isPlayerDeity) {
                cardBorderClass = 'border-cybergold bg-cybergold/5 shadow-neon-purple';
                subtitleColorClass = 'text-cybergold font-extrabold';
                roleName = cardRole.toUpperCase();
                characterBadge = '⚡';
              } else {
                cardBorderClass = 'border-primary/20 bg-gradient-to-b from-primary/10 via-darkbg to-primary/5 hover:border-cyberpink/50 hover:shadow-neon-pink';
                subtitleColorClass = 'text-primary/70';
                roleName = 'UNKNOWN DEITY';
                characterBadge = '🌀';
              }

              return (
                <div 
                  key={p.id}
                  onClick={() => handleCardClick(p.id)}
                  className={`glass-card rounded-2xl p-4 md:p-6 border flex flex-col items-center justify-center text-center cursor-pointer transition-all aspect-[3/4] select-none ${
                    isRamudu && !isGuesserSelf && !isTargetRevealed && !roundEnded ? 'hover:scale-105 hover:-translate-y-1 active:scale-95' : 'cursor-default'
                  } ${cardBorderClass}`}
                >
                  <div className="relative mb-4 shrink-0">
                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-2xl border ${
                      cardRole ? 'bg-primary/20 border-white/20' : 'bg-darkbg border-primary/30 shadow-inner'
                    }`}>
                      {characterBadge}
                    </div>
                    {isTargetRevealed && (
                      <span className="absolute -bottom-1.5 -right-1.5 p-1 bg-cybersuccess rounded-full text-white text-[8px] font-bold shadow-md">
                        <ShieldCheck size={12} />
                      </span>
                    )}
                  </div>

                  <h5 className="font-extrabold text-xs md:text-sm text-gray-200 truncate w-full tracking-wide shrink-0">
                    {p.username}
                  </h5>
                  <p className={`text-[8px] md:text-[9px] mt-1.5 uppercase tracking-widest font-black shrink-0 ${subtitleColorClass}`}>
                    {roleName}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT: Live Sticky Scoreboard & Mission Log */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
        
        {/* Live Scoreboard */}
        <div className="glass-panel rounded-2xl p-5 border-white/5 space-y-4">
          <h4 className="font-extrabold text-sm uppercase text-gray-400 tracking-wider flex items-center gap-2">
            🏆 Scoreboard
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            {sortedScoreboard.map((row, idx) => {
              const isLeader = row.userId === leaderId;
              const addedPoints = roundScores[row.userId] || 0;
              
              return (
                <div 
                  key={row.userId}
                  className={`flex justify-between items-center p-3 rounded-xl border transition-all duration-500 ${
                    isLeader 
                      ? 'border-cybergold/30 bg-cybergold/5 shadow-[0_0_15px_rgba(255,213,79,0.05)]' 
                      : 'border-white/5 bg-white/5'
                  } ${addedPoints > 0 ? 'animate-pulse scale-[1.02]' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`font-black text-xs w-4 shrink-0 ${isLeader ? 'text-cybergold' : 'text-gray-500'}`}>
                      #{idx + 1}
                    </span>
                    <div className="relative shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                        isLeader ? 'bg-cybergold/20 text-cybergold border border-cybergold/30' : 'bg-primary/20 border border-white/10 text-white'
                      }`}>
                        {row.username[0]}
                      </div>
                      {isLeader && (
                        <span className="absolute -top-1.5 -right-1 text-cybergold animate-bounce">
                          <Crown size={10} className="fill-cybergold" />
                        </span>
                      )}
                    </div>
                    <span className="font-extrabold text-xs text-gray-200 truncate pr-1">
                      {row.username}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {addedPoints > 0 && (
                      <span className="text-[9px] text-cybersuccess font-black animate-bounce shrink-0">
                        +{addedPoints}
                      </span>
                    )}
                    <span className="font-black text-sm text-white shrink-0">
                      {row.score}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Game Info Panel */}
        <div className="glass-card rounded-2xl p-5 border-white/5 space-y-4">
          <h4 className="font-extrabold text-sm uppercase text-gray-400 tracking-wider flex items-center gap-2">
            <HelpCircle size={16} className="text-cyberblue" /> Mission Log
          </h4>
          
          <div className="space-y-3 text-xs text-gray-400 leading-relaxed">
            <p>
              <strong className="text-white">Objective:</strong> Ramudu must identify <span className="text-cyberpink font-bold">Seetha</span>.
            </p>
            <p>
              If you are <strong className="text-cyberblue font-bold">Ramudu</strong>, click on player cards to search.
            </p>
            <p>
              Scans decrease round points. Work together in chat to locate Seetha safely!
            </p>
          </div>

          <div className="border-t border-white/5 pt-4 flex justify-between items-center">
            <span className="text-[10px] uppercase font-bold text-gray-500">Round Scans</span>
            <span className="text-xl font-black text-white">{guesses}</span>
          </div>
        </div>

      </div>

      {/* Round End Modal Overlay */}
      {roundEnded && roundData && !matchEnded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden shadow-neon-blue transition-all duration-300 transform scale-100">
            {countdown !== null && (
              <div className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full border border-cyberblue text-cyberblue font-extrabold text-xs">
                {countdown}s
              </div>
            )}
            
            <div className="text-center mb-6">
              <span className="text-[10px] font-black uppercase text-cyberblue tracking-widest">Round {roundData.currentRound} Completed</span>
              <h3 className="text-3xl font-black text-white mt-1">Seetha Located!</h3>
              <p className="text-sm text-gray-400 mt-2">
                Ramudu scanned Seetha in <span className="text-white font-bold">{roundData.guessCount}</span> attempts.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Session Standings</h4>
              <div className="divide-y divide-white/5 bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3">
                {Object.entries(sessionScoreboard)
                  .map(([userId, val]) => ({ userId, username: val.username, score: val.score }))
                  .sort((a, b) => b.score - a.score)
                  .map((row, idx) => {
                    const roundScore = roundData.roundScores[row.userId] || 0;
                    return (
                      <div key={row.userId} className="flex justify-between items-center py-2 text-sm first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-400 w-4">#{idx + 1}</span>
                          <span className="font-extrabold text-gray-200">{row.username}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-cybersuccess font-bold">+{roundScore} pts</span>
                          <span className="font-black text-white">{row.score} pts</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {isHost ? (
              <button
                onClick={() => socket.emit('rs_next_round', roomCode)}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-cyberblue font-bold shadow-neon-blue hover:opacity-90 active:scale-95 transition-all text-center text-sm"
              >
                Launch Next Round Immediately
              </button>
            ) : (
              <div className="text-center py-3 text-xs text-gray-500 font-bold animate-pulse">
                Next round starting automatically...
              </div>
            )}

            {/* Real-time shrinking progress bar */}
            {countdown !== null && (
              <div className="w-full h-1.5 bg-white/10 absolute bottom-0 left-0">
                <div 
                  className="h-full bg-cyberblue transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / 10) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grand Finale Session End Overlay Modal */}
      {matchEnded && matchResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden shadow-neon-purple animate-float-slow">
            <div className="text-center mb-6">
              <span className="text-[10px] font-black uppercase text-cybergold tracking-widest">Campaign Complete</span>
              <h3 className="text-3xl font-black text-white mt-1">Grand Placements</h3>
              <p className="text-sm text-gray-400 mt-2">
                All rounds completed! Final campaign standings finalized:
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Final Standings</h4>
              <div className="divide-y divide-white/5 bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3">
                {matchResults.scoreboard.map((row) => (
                  <div key={row.userId} className="flex justify-between items-center py-2 text-sm first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-cybergold w-4">#{row.placement}</span>
                      <span className="font-bold text-gray-200">{row.username}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] text-gray-400">+{row.xpEarned} XP &bull; +{row.coinsEarned} 🪙</span>
                      <span className="font-black text-cyberpink">{row.score} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isHost ? (
              <button 
                onClick={() => socket.emit('rs_return_to_lobby', roomCode)}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-cyberpink font-bold shadow-neon-pink hover:opacity-90 active:scale-95 transition-all text-center text-sm animate-pulse"
              >
                Return to Lobby
              </button>
            ) : (
              <div className="text-center py-3 text-xs text-gray-500 font-bold animate-pulse">
                Waiting for Captain to return to Lobby...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
