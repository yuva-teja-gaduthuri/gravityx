'use client';

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { HelpCircle, Star, Search, ShieldCheck, Timer } from 'lucide-react';

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
}

export default function RamuduSeethaGame({ roomCode, user, socket, isHost }: RSGameProps) {
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
  const [roundEnded, setRoundEnded] = useState<boolean>(false);
  const [roundData, setRoundData] = useState<any>(null);

  // In-Game Live Scoreboard toggle
  const [showLiveScore, setShowLiveScore] = useState<boolean>(false);

  // Match ended state
  const [matchEnded, setMatchEnded] = useState(false);
  const [matchResults, setMatchResults] = useState<{
    winnerId: string;
    seethaId: string;
    guessCount: number;
    scoreboard: ScoreboardRow[];
  } | null>(null);

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

    socket.on('rs_round_ended', (data: any) => {
      setRoundEnded(true);
      setRoundData(data);
      setSessionScoreboard(data.sessionScoreboard || {});
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
  }, [socket, players, roomCode]);

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

  return (
    <div className="flex flex-col flex-grow p-4 md:p-6 space-y-6 max-w-6xl mx-auto w-full relative">
      {/* Top dashboard row: Session stats and Identity status */}
      <div className="flex flex-col md:flex-row items-center justify-between glass-panel rounded-2xl p-5 border-cybergold/20 gap-4 shadow-neon-gold">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cybergold/10 text-cybergold flex items-center justify-center border border-cybergold/30 shadow-[0_0_8px_rgba(255,213,79,0.2)]">
            <Star size={22} className="fill-cybergold/20" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400">Divine Quest</div>
            <div className="text-xl font-black text-cybergold">Round {currentRound} / {maxRounds}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-gray-400">Secret Identity</div>
            <div className="text-lg font-black text-cybergold tracking-wider uppercase">{myRole || 'Chosen By Destiny...'}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ffd54f] to-[#b8860b] flex items-center justify-center font-black text-darkbg shadow-neon-gold border border-white/20">
            {myRole ? myRole[0] : '?'}
          </div>
        </div>

        <div className="text-center md:text-right">
          <div className="text-[10px] uppercase font-bold text-gray-400">Guesser (Ramudu)</div>
          <div className="text-sm font-extrabold text-cybergold">
            {players.find(p => p.id === ramuduId)?.username || 'Calibrating...'}
          </div>
        </div>
      </div>

      {/* Main Deduction Table */}
      <div className="grid md:grid-cols-4 gap-6">
        {/* Game Info Panel */}
        <div className="md:col-span-1 glass-card rounded-2xl p-5 border-cybergold/20 space-y-5 h-fit shadow-neon-gold">
          <h4 className="font-extrabold text-sm uppercase text-cybergold tracking-wider flex items-center gap-2">
            <HelpCircle size={16} /> Celestial Scroll
          </h4>
          
          <div className="space-y-3 text-xs text-gray-300 leading-relaxed border-b border-white/5 pb-4">
            <p>
              <strong className="text-white">Quest:</strong> Ramudu must find <span className="text-cybergold font-bold">Seetha</span> among the deities.
            </p>
            <p>
              Only <strong className="text-cybergold">Ramudu</strong> makes guesses. Each scan reduces the score.
            </p>
            <p>
              Use lobby chat coordination to protect or identify identities!
            </p>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500 mb-0.5">Attempted Scans</div>
              <span className="text-2xl font-black text-white">{guesses}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
            <button
              onClick={() => setShowLiveScore(!showLiveScore)}
              className="w-full py-2.5 rounded-xl border border-cybergold/45 bg-cybergold/10 hover:bg-cybergold text-cybergold hover:text-darkbg transition-all text-xs font-black uppercase tracking-wider"
            >
              {showLiveScore ? 'Hide Live Scores' : 'View Live Scores'}
            </button>
          </div>

          {showLiveScore && (
            <div className="space-y-2 pt-2 animate-fade-in">
              <h5 className="text-[10px] uppercase font-black text-cybergold/80 tracking-widest">Running Standings</h5>
              <div className="space-y-2 bg-black/40 border border-white/5 rounded-xl p-3">
                {Object.entries(sessionScoreboard).length > 0 ? (
                  Object.entries(sessionScoreboard)
                    .map(([userId, val]) => ({ userId, username: val.username, score: val.score }))
                    .sort((a, b) => b.score - a.score)
                    .map((row, idx) => (
                      <div key={row.userId} className="flex justify-between items-center text-xs">
                        <span className="text-gray-300 truncate max-w-[120px] font-bold">
                          #{idx + 1} {row.username}
                        </span>
                        <span className="text-cybergold font-black">{row.score} pts</span>
                      </div>
                    ))
                ) : (
                  <p className="text-[10px] text-gray-500">Waiting for round end...</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Player Cards Area */}
        <div className="md:col-span-3 space-y-6">
          {guessResult && (
            <div className={`p-4 rounded-xl flex items-center justify-center font-bold border text-sm transition-all ${
              guessResult.isCorrect 
                ? 'bg-cybersuccess/10 border-cybersuccess text-cybersuccess shadow-neon-success animate-bounce' 
                : 'bg-cybererror/10 border-cybererror text-cybererror shadow-neon-error animate-shake'
            }`}>
              ⚔️ {guessResult.username} was revealed as: {guessResult.role}! {guessResult.isCorrect ? 'SEETHA FOUND!' : 'NOT SEETHA.'}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {players.map((p) => {
              const isGuesserSelf = p.id === user.id;
              const isTargetRevealed = revealedIds.includes(p.id);
              const cardRole = isGuesserSelf ? myRole : isTargetRevealed ? p.role || 'Revealed' : null;
              
              const isPlayerRamudu = p.id === ramuduId;
              const isPlayerSeetha = cardRole === 'Seetha';
              const isPlayerDeity = cardRole && cardRole !== 'Ramudu' && cardRole !== 'Seetha';

              let cardBorderClass = 'border-white/5 bg-[#050816]/70';
              let subtitleColorClass = 'text-gray-500';
              let roleName = 'MYSTIC DEITY';
              let characterBadge = '✨';

              // Assign custom emblems based on role names
              if (cardRole === 'Ramudu' || isPlayerRamudu) {
                cardBorderClass = 'border-cybergold bg-gradient-to-b from-[#ffd54f]/15 to-transparent shadow-neon-gold';
                subtitleColorClass = 'text-cybergold font-black';
                roleName = 'RAMUDU';
                characterBadge = '🏹';
              } else if (isPlayerSeetha) {
                cardBorderClass = 'border-cyberpink bg-gradient-to-b from-[#ff5edf]/15 to-transparent shadow-neon-pink';
                subtitleColorClass = 'text-cyberpink font-black';
                roleName = 'SEETHA';
                characterBadge = '🌸';
              } else if (isPlayerDeity) {
                cardBorderClass = 'border-purple-400 bg-gradient-to-b from-purple-500/15 to-transparent shadow-neon-purple';
                subtitleColorClass = 'text-purple-300 font-bold';
                roleName = cardRole.toUpperCase();
                
                // Emblems per specific deity
                if (cardRole.includes('Hanuman')) characterBadge = '🔱';
                else if (cardRole.includes('Lakshmana')) characterBadge = '⚔️';
                else if (cardRole.includes('Krishna')) characterBadge = '🪈';
                else if (cardRole.includes('Shiva')) characterBadge = '🔱';
                else if (cardRole.includes('Ganesha')) characterBadge = '🐘';
                else characterBadge = '⚡';
              } else {
                cardBorderClass = 'border-cybergold/30 bg-gradient-to-b from-cybergold/5 to-transparent hover:border-cybergold/70 hover:shadow-neon-gold';
                subtitleColorClass = 'text-gray-400';
                roleName = 'UNREVEALED';
                characterBadge = '🛡️';
              }

              return (
                <div 
                  key={p.id}
                  onClick={() => handleCardClick(p.id)}
                  className={`glass-card rounded-2xl p-6 border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isRamudu && !isGuesserSelf && !isTargetRevealed && !roundEnded ? 'hover:scale-[1.03] active:scale-95' : 'cursor-default'
                  } ${cardBorderClass}`}
                >
                  <div className="relative mb-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl border border-cybergold/20 bg-darkbg shadow-[0_0_12px_rgba(255,213,79,0.1)]`}>
                      {characterBadge}
                    </div>
                    {isTargetRevealed && (
                      <span className="absolute -bottom-1 -right-1 p-1 bg-cybersuccess rounded-full text-white text-[8px] font-bold shadow-md">
                        <ShieldCheck size={12} />
                      </span>
                    )}
                  </div>

                  <h5 className="font-extrabold text-sm text-gray-200 truncate w-full tracking-wide">{p.username}</h5>
                  <p className={`text-[10px] mt-2 uppercase tracking-widest font-black ${subtitleColorClass}`}>
                    {roleName}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Round End Modal Overlay */}
      {roundEnded && roundData && !matchEnded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-cybergold/30 relative overflow-hidden shadow-neon-gold">
            <div className="text-center mb-6">
              <span className="text-[10px] font-black uppercase text-cybergold tracking-widest">Round {roundData.currentRound} Completed</span>
              <h3 className="text-3xl font-black text-white mt-1">Seetha Located!</h3>
              <p className="text-sm text-gray-300 mt-2">
                Ramudu successfully searched Seetha in <span className="text-cybergold font-bold">{roundData.guessCount}</span> scans.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Session Leaderboard</h4>
              <div className="divide-y divide-white/5 bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3">
                {Object.entries(sessionScoreboard)
                  .map(([userId, val]) => ({ userId, username: val.username, score: val.score }))
                  .sort((a, b) => b.score - a.score)
                  .map((row, idx) => {
                    const roundScore = roundData.roundScores[row.userId] || 0;
                    return (
                      <div key={row.userId} className="flex justify-between items-center py-2 text-sm first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-cybergold/75 w-4">#{idx + 1}</span>
                          <span className="font-extrabold text-gray-200">{row.username}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-cybersuccess font-bold">+{roundScore} this round</span>
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
                className="w-full py-4 rounded-xl bg-gradient-to-r from-cybergold to-amber-600 text-darkbg font-bold shadow-neon-gold hover:opacity-90 active:scale-95 transition-all text-center text-sm"
              >
                Launch Round {roundData.currentRound + 1}
              </button>
            ) : (
              <div className="text-center py-3 text-xs text-cybergold font-bold animate-pulse">
                Waiting for Captain to launch the next round...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grand Finale Session End Overlay Modal */}
      {matchEnded && matchResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-cybergold/40 relative overflow-hidden shadow-neon-gold">
            <div className="text-center mb-6">
              <span className="text-[10px] font-black uppercase text-cybergold tracking-widest animate-pulse">Campaign Complete</span>
              <h3 className="text-3xl font-black text-white mt-1">Grand Standings</h3>
              <p className="text-sm text-gray-300 mt-2">
                All rounds completed! The final standings are synchronized:
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Campaign Leaderboard</h4>
              <div className="divide-y divide-white/5 bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3">
                {matchResults.scoreboard.map((row) => (
                  <div key={row.userId} className="flex justify-between items-center py-2 text-sm first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-cybergold w-4">#{row.placement}</span>
                      <span className="font-bold text-gray-200">{row.username}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] text-gray-400">+{row.xpEarned} XP &bull; +{row.coinsEarned} 🪙</span>
                      <span className="font-black text-cybergold">{row.score} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-cybergold to-amber-600 text-darkbg font-bold shadow-neon-gold hover:opacity-90 active:scale-95 transition-all text-center text-sm"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
