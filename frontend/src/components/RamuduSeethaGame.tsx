'use client';

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { HelpCircle, Star, ShieldCheck, Crown, Heart, UserPlus, MessageSquare, ThumbsUp, X } from 'lucide-react';
import { getApiUrl } from '../utils/api';

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
  user: { id: string; username: string; isGuest?: boolean };
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

  // Gameplay Timer state
  const [roundTimer, setRoundTimer] = useState<number>(15);
  const [showFailureAnimation, setShowFailureAnimation] = useState<boolean>(false);

  // Multi-round session states
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [maxRounds, setMaxRounds] = useState<number>(3);
  const [sessionScoreboard, setSessionScoreboard] = useState<{ [userId: string]: { username: string; score: number } }>({});
  const [roundScores, setRoundScores] = useState<{ [userId: string]: number }>({});
  const [roundEnded, setRoundEnded] = useState<boolean>(false);
  const [roundData, setRoundData] = useState<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Scorecard Social States
  const [likesMap, setLikesMap] = useState<{[username: string]: number}>({});
  const [friendStatus, setFriendStatus] = useState<{[username: string]: string}>({});
  const [reviewModalUser, setReviewModalUser] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');

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

  // Handle active round gameplay timer
  useEffect(() => {
    if (roundEnded || matchEnded) return;
    if (roundTimer <= 0) return;
    
    const timer = setInterval(() => {
      setRoundTimer((prev) => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [roundTimer, roundEnded, matchEnded]);

  // Handle countdown ticks (for round end transition)
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

  // Load likes on match end
  useEffect(() => {
    if (matchEnded && matchResults) {
      const initialLikes: {[username: string]: number} = {};
      matchResults.scoreboard.forEach(row => {
        const count = localStorage.getItem(`gravityx_likes_${row.username}`);
        initialLikes[row.username] = count ? parseInt(count) : Math.floor(Math.random() * 5) + 12; // seed initial likes
      });
      setLikesMap(initialLikes);
    }
  }, [matchEnded, matchResults]);

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
      setRoundTimer(15);
      setShowFailureAnimation(false);
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
      
      if (data.won === false) {
        setShowFailureAnimation(true);
        setTimeout(() => {
          setShowFailureAnimation(false);
        }, 2000);
      } else {
        confetti({
          particleCount: 80,
          spread: 50,
          origin: { y: 0.7 }
        });
      }
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
  }, [socket, roomCode]);

  const handleCardClick = (targetPlayerId: string) => {
    if (matchEnded || roundEnded) return;
    if (user.id !== ramuduId) return;
    if (targetPlayerId === user.id || revealedIds.includes(targetPlayerId)) return;

    socket.emit('rs_guess', {
      roomCode,
      targetUserId: targetPlayerId
    });
  };

  const handleLike = (username: string) => {
    const current = likesMap[username] || 0;
    const next = current + 1;
    localStorage.setItem(`gravityx_likes_${username}`, String(next));
    setLikesMap(prev => ({ ...prev, [username]: next }));
  };

  const handleSaveReview = (username: string) => {
    if (user.isGuest) return;
    const existingStr = localStorage.getItem(`gravityx_reviews_${username}`);
    const existing = existingStr ? JSON.parse(existingStr) : [];
    
    const newRev = {
      username: user.username,
      rating: reviewRating,
      comment: reviewComment,
      date: new Date().toISOString().split('T')[0]
    };

    const updated = [newRev, ...existing];
    localStorage.setItem(`gravityx_reviews_${username}`, JSON.stringify(updated));
    setReviewModalUser(null);
    setReviewComment('');
    setReviewRating(5);
    alert(`Feedback saved successfully for ${username}!`);
  };

  const handleAddFriendClick = async (friendUsername: string) => {
    try {
      setFriendStatus(prev => ({ ...prev, [friendUsername]: 'sending' }));
      const token = localStorage.getItem('gravityx_token');
      const res = await fetch(getApiUrl('/api/social/request'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ friendUsername })
      });
      if (res.ok) {
        setFriendStatus(prev => ({ ...prev, [friendUsername]: 'sent' }));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send friend request');
        setFriendStatus(prev => ({ ...prev, [friendUsername]: 'error' }));
      }
    } catch (err) {
      console.error(err);
      setFriendStatus(prev => ({ ...prev, [friendUsername]: 'error' }));
    }
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
    <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 w-full max-w-7xl mx-auto items-stretch min-h-0 relative">
      
      {/* 2-second red failure overlay */}
      {showFailureAnimation && (
        <div className="fixed inset-0 z-50 bg-red-950/85 backdrop-blur-sm animate-pulse flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300">
          <div className="w-32 h-32 rounded-full border-4 border-red-500 flex items-center justify-center animate-bounce shadow-[0_0_50px_rgba(239,68,68,0.55)]">
            <span className="text-red-500 text-6xl font-black">✗</span>
          </div>
          <div className="absolute inset-0 bg-radial-gradient from-transparent to-red-950/70 pointer-events-none mix-blend-overlay" />
        </div>
      )}

      {/* LEFT: Game Card Area */}
      <div className="flex-1 flex flex-col space-y-6 min-w-0">
        
        {/* Top identity/timer status */}
        {isRamudu ? (
          <div className="p-4 rounded-xl bg-cyberblue/10 border border-cyberblue/30 text-cyberblue font-extrabold text-center text-sm animate-pulse">
            🎯 YOU ARE RAMUDU! Scan Seetha. Remaining Attempts: {1 - guesses > 0 ? 1 - guesses : 0}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-extrabold text-center text-sm">
            🎭 You are {myRole || 'Distributing...'}! Protect Seetha from Ramudu.
          </div>
        )}

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
              <span className="font-extrabold text-lg">⏳</span>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500">Round Time Remaining</div>
              <div className={`text-lg font-black tracking-wide ${roundTimer <= 5 ? 'text-cybererror animate-ping' : 'text-white'}`}>
                {roundTimer} seconds
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

              // If correct guess is won, only animate Seetha's card
              const isCorrectSeethaCard = roundEnded && roundData?.won && p.id === roundData?.seethaId;

              if (isPlayerRamudu) {
                cardBorderClass = 'border-cyberblue bg-cyberblue/5 shadow-neon-blue';
                subtitleColorClass = 'text-cyberblue font-extrabold';
                roleName = 'RAMUDU';
                characterBadge = '🏹';
              } else if (isPlayerSeetha) {
                cardBorderClass = `border-cyberpink bg-cyberpink/5 shadow-neon-pink ${isCorrectSeethaCard ? 'animate-bounce border-2 border-cybersuccess shadow-[0_0_20px_rgba(74,222,128,0.7)]' : ''}`;
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
              Ramudu gets exactly <strong>1 attempt</strong> to guess Seetha correctly before the 15-second round timer runs out!
            </p>
          </div>

          <div className="border-t border-white/5 pt-4 flex justify-between items-center">
            <span className="text-[10px] uppercase font-bold text-gray-500">Round Scans</span>
            <span className="text-xl font-black text-white">{guesses} / 1</span>
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
              <span className="text-[10px] font-black uppercase text-cyberblue tracking-widest font-mono">Round {roundData.currentRound} Completed</span>
              <h3 className="text-3xl font-black text-white mt-1">
                {roundData.won ? 'Seetha Located!' : 'Ramudu Defeated!'}
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                {roundData.won 
                  ? `Ramudu successfully located Seetha in ${roundData.guessCount} attempt!` 
                  : `Ramudu failed to locate Seetha in time/attempts.`}
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
                onClick={() => {
                  const isLastRound = currentRound >= maxRounds;
                  if (isLastRound) {
                    socket.emit('rs_show_final_scorecard', roomCode);
                  } else {
                    socket.emit('rs_next_round', roomCode);
                  }
                }}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-cyberblue font-bold shadow-neon-blue hover:opacity-90 active:scale-95 transition-all text-center text-sm"
              >
                {currentRound >= maxRounds ? 'Show Scorecard & Standings' : 'Launch Next Round Immediately'}
              </button>
            ) : (
              <div className="text-center py-3 text-xs text-gray-500 font-bold animate-pulse">
                {currentRound >= maxRounds ? 'Waiting for host to present final scorecard...' : 'Next round starting automatically...'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden shadow-neon-purple my-8">
            <div className="text-center mb-6">
              <span className="text-[10px] font-black uppercase text-cybergold tracking-widest">Campaign Complete</span>
              <h3 className="text-3xl font-black text-white mt-1">Grand Placements</h3>
              <p className="text-sm text-gray-400 mt-2">
                All rounds completed! Standings committed to database:
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Final Standings</h4>
              <div className="divide-y divide-white/5 bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3">
                {matchResults.scoreboard.map((row) => {
                  const isSelf = row.username === user.username;
                  const isFriendAdded = friendStatus[row.username] === 'sent';
                  const isFriendSending = friendStatus[row.username] === 'sending';

                  return (
                    <div key={row.userId} className="flex flex-col py-3 first:pt-0 last:pb-0 gap-3">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-cybergold w-4">#{row.placement}</span>
                          <span className="font-bold text-gray-200">{row.username} {isSelf && <span className="text-[9px] text-gray-500">(you)</span>}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] text-gray-400">+{row.xpEarned} XP &bull; +{row.coinsEarned} 🪙</span>
                          <span className="font-black text-cyberpink">{row.score} pts</span>
                        </div>
                      </div>

                      {/* Interaction Row */}
                      <div className="flex items-center gap-2 flex-wrap pl-7">
                        {/* Like Button */}
                        <button
                          onClick={() => handleLike(row.username)}
                          className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-cyberpink text-[10px] font-bold text-gray-300 flex items-center gap-1.5 transition-all active:scale-90"
                        >
                          <Heart size={12} className="fill-cyberpink text-cyberpink" />
                          <span>Like ({likesMap[row.username] || 0})</span>
                        </button>

                        {/* Add Friend option (show to all users but not yourself) */}
                        {!isSelf && (
                          <button
                            onClick={() => handleAddFriendClick(row.username)}
                            disabled={isFriendAdded || isFriendSending}
                            className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-cyberblue text-[10px] font-bold text-gray-300 flex items-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            <UserPlus size={12} className="text-cyberblue" />
                            <span>
                              {isFriendAdded ? 'Friend Added' : isFriendSending ? 'Sending...' : 'Add Friend'}
                            </span>
                          </button>
                        )}

                        {/* Review Option (Only for registered users, not for guests, and not for themselves) */}
                        {!user.isGuest && !isSelf && (
                          <button
                            onClick={() => setReviewModalUser(row.username)}
                            className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-cybergold text-[10px] font-bold text-gray-300 flex items-center gap-1.5 transition-all"
                          >
                            <MessageSquare size={12} className="text-cybergold" />
                            <span>Review Player</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {isHost ? (
              <button 
                onClick={onReturnToLobby}
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

      {/* Review Modal popup */}
      {reviewModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm glass-panel rounded-3xl p-6 border border-white/10 relative shadow-neon-blue">
            <button 
              onClick={() => setReviewModalUser(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
            <h4 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              Write Review for {reviewModalUser}
            </h4>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Select Star Rating</label>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setReviewRating(val)}
                      className={`text-xl ${val <= reviewRating ? 'text-cybergold' : 'text-gray-600'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Comment/Feedback</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Tell others how this user played..."
                  className="w-full h-24 mt-1 bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-cyberblue focus:outline-none"
                />
              </div>
              <button
                onClick={() => handleSaveReview(reviewModalUser)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-cyberblue font-bold text-xs uppercase tracking-wider shadow-md hover:opacity-90 active:scale-95 transition-all"
              >
                Save Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
