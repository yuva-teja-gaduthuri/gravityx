'use client';

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { HelpCircle, Star, Search, ShieldCheck, Flame, Timer } from 'lucide-react';

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
  role: string;
  score: number;
  coinsEarned: number;
  placement: number;
}

interface RSGameProps {
  roomCode: string;
  user: { id: string; username: string };
  socket: Socket;
}

export default function RamuduSeethaGame({ roomCode, user, socket }: RSGameProps) {
  const [myRole, setMyRole] = useState<string>('');
  const [ramuduId, setRamuduId] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [duration, setDuration] = useState<number>(0);
  const [guesses, setGuesses] = useState<number>(0);
  const [guessResult, setGuessResult] = useState<{ username: string; role: string; isCorrect: boolean } | null>(null);

  // Match ended state
  const [matchEnded, setMatchEnded] = useState(false);
  const [matchResults, setMatchResults] = useState<{
    winnerId: string;
    seethaId: string;
    duration: number;
    guessCount: number;
    scoreboard: ScoreboardRow[];
  } | null>(null);

  useEffect(() => {
    // Sync initial state upon game start message from parent routing if any,
    // but the socket events are captured here:
    socket.on('rs_game_started', (data: any) => {
      setMyRole(data.myRole);
      setRamuduId(data.ramuduId);
      setPlayers(data.players);
      setRevealedIds([]);
      setMatchEnded(false);
      setMatchResults(null);
      setGuesses(0);
      setDuration(0);
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

      const targetUser = players.find(p => p.id === data.targetUserId);
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

    socket.on('rs_match_ended', (data: any) => {
      setMatchEnded(true);
      setMatchResults(data);
      // Trigger Confetti!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    });

    // Handle initial state request
    socket.emit('rs_sync_state', roomCode);

    return () => {
      socket.off('rs_game_started');
      socket.off('rs_guess_result');
      socket.off('rs_match_ended');
    };
  }, [socket, players, roomCode]);

  // Timer counter
  useEffect(() => {
    if (matchEnded) return;
    const interval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [matchEnded]);

  const handleCardClick = (targetPlayerId: string) => {
    if (matchEnded) return;
    // Only Ramudu can click to guess
    if (user.id !== ramuduId) return;
    // Cannot click self or already revealed
    if (targetPlayerId === user.id || revealedIds.includes(targetPlayerId)) return;

    socket.emit('rs_guess', {
      roomCode,
      targetUserId: targetPlayerId
    });
  };

  const isRamudu = user.id === ramuduId;
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col flex-grow p-6 space-y-6 max-w-6xl mx-auto w-full">
      {/* Top dashboard row: Timer and Identity status */}
      <div className="flex flex-col sm:flex-row items-center justify-between glass-panel rounded-2xl p-5 border-white/5 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyberpink/10 text-cyberpink flex items-center justify-center">
            <Timer size={22} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500">Duration</div>
            <div className="text-xl font-black text-white">{formatTime(duration)}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-gray-500">Your secret role</div>
            <div className="text-lg font-black text-cyberpink tracking-wide uppercase">{myRole || 'Distributing...'}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-cyberpink flex items-center justify-center font-bold text-white shadow-neon-pink">
            {myRole ? myRole[0] : '?'}
          </div>
        </div>

        <div className="text-center sm:text-right">
          <div className="text-[10px] uppercase font-bold text-gray-500">Ramudu Guesser</div>
          <div className="text-sm font-bold text-cyberblue">
            {players.find(p => p.id === ramuduId)?.username || 'Selecting...'}
          </div>
        </div>
      </div>

      {/* Main Deduction Table */}
      <div className="grid md:grid-cols-4 gap-6">
        {/* Game Info Panel */}
        <div className="md:col-span-1 glass-card rounded-2xl p-5 border-white/5 space-y-5 h-fit">
          <h4 className="font-extrabold text-sm uppercase text-gray-400 tracking-wider flex items-center gap-2">
            <HelpCircle size={16} className="text-cyberblue" /> Mission Log
          </h4>
          
          <div className="space-y-3 text-xs text-gray-400 leading-relaxed">
            <p>
              <strong className="text-white">Objective:</strong> Ramudu must identify <span className="text-cyberpink font-bold">Seetha</span>.
            </p>
            <p>
              If you are <strong className="text-cyberblue">Ramudu</strong>, click on player profile cards to guess their identities. 
            </p>
            <p>
              Other crew members should coordinate chat logs to protect Seetha's index position.
            </p>
          </div>

          <div className="border-t border-white/5 pt-4">
            <div className="text-[10px] uppercase font-bold text-gray-500 mb-2">Guesses Submitted</div>
            <span className="text-2xl font-black text-white">{guesses}</span>
          </div>
        </div>

        {/* Player Cards Area */}
        <div className="md:col-span-3 space-y-6">
          {guessResult && (
            <div className={`p-4 rounded-xl flex items-center justify-center font-bold border text-sm animate-pulse-slow ${
              guessResult.isCorrect ? 'bg-cybersuccess/10 border-cybersuccess text-cybersuccess' : 'bg-cybererror/10 border-cybererror text-cybererror'
            }`}>
              {guessResult.username} was revealed as: {guessResult.role}! {guessResult.isCorrect ? 'FOUND SEETHA!' : 'NOT SEETHA.'}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {players.map((p) => {
              const isGuesserSelf = p.id === user.id;
              const isTargetRevealed = revealedIds.includes(p.id);
              const cardRole = isGuesserSelf ? myRole : isTargetRevealed ? p.role || 'Revealed' : null;
              
              // Styles based on revealed role
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
                // Card Back (Gods Theme Back)
                cardBorderClass = 'border-primary/20 bg-gradient-to-b from-primary/10 via-darkbg to-primary/5 hover:border-cyberpink/50 hover:shadow-neon-pink';
                subtitleColorClass = 'text-primary/70';
                roleName = 'UNKNOWN DEITY';
                characterBadge = '🌀';
              }

              return (
                <div 
                  key={p.id}
                  onClick={() => handleCardClick(p.id)}
                  className={`glass-card rounded-2xl p-6 border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isRamudu && !isGuesserSelf && !isTargetRevealed ? 'hover:scale-105 active:scale-95' : 'cursor-default'
                  } ${cardBorderClass}`}
                >
                  {/* Card Front/Back Illustration */}
                  <div className="relative mb-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border ${
                      cardRole ? 'bg-primary/20 border-white/20' : 'bg-darkbg border-primary/30 shadow-inner'
                    }`}>
                      {characterBadge}
                    </div>
                    {isTargetRevealed && (
                      <span className="absolute -bottom-1.5 -right-1.5 p-1 bg-cybersuccess rounded-full text-white text-[8px] font-bold shadow-md">
                        <ShieldCheck size={10} />
                      </span>
                    )}
                  </div>

                  <h5 className="font-extrabold text-sm text-gray-200 truncate w-full tracking-wide">{p.username}</h5>
                  <p className={`text-[9px] mt-1.5 uppercase tracking-widest font-black ${subtitleColorClass}`}>
                    {roleName}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Match Results Overlay Modal */}
      {matchEnded && matchResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden shadow-neon-purple">
            <div className="text-center mb-6">
              <span className="text-[10px] font-black uppercase text-cyberpink tracking-widest">Match Terminal Ended</span>
              <h3 className="text-3xl font-extrabold text-white mt-1">Victory Finalized!</h3>
              <p className="text-sm text-gray-400 mt-1">Ramudu located Seetha after {matchResults.guessCount} scans in {formatTime(matchResults.duration)}.</p>
            </div>

            <div className="space-y-3 mb-6">
              <h4 className="text-xs uppercase font-extrabold text-gray-500 tracking-wider">Scoreboard Breakdown</h4>
              <div className="divide-y divide-white/5 max-h-60 overflow-y-auto pr-2">
                {matchResults.scoreboard.map((row) => (
                  <div key={row.userId} className="flex justify-between items-center py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] uppercase font-bold text-cyberblue border border-white/10">
                        {row.username[0]}
                      </div>
                      <div>
                        <span className="font-bold text-gray-200">{row.username}</span>
                        <span className="text-[9px] uppercase font-semibold text-gray-500 ml-2">({row.role})</span>
                      </div>
                    </div>
                    <div className="flex gap-4 items-center">
                      <span className="text-xs font-semibold text-gray-400">+{row.score} XP</span>
                      <span className="text-xs font-extrabold text-cybergold">+{row.coinsEarned} 🪙</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => window.location.reload()} // Simply reloads to reload room states
              className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-cyberpink font-bold shadow-neon-pink hover:opacity-90 transition-all text-center"
            >
              Return to Lobby deck
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
