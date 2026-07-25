'use client';

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { HelpCircle, Star, ShieldCheck, Crown, Flame, Award, Heart, ShieldAlert } from 'lucide-react';

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

interface CharacterStyle {
  name: string;
  title: string;
  badge: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  glowClass: string;
  desc: string;
}

const CHARACTER_STYLES: { [role: string]: CharacterStyle } = {
  'Ramudu': {
    name: 'Ramudu',
    title: 'Ramudu (Divine Archer)',
    badge: '🏹',
    colorClass: 'text-cyberblue',
    borderClass: 'border-cyberblue',
    bgClass: 'from-cyberblue/15 to-cyberblue/5',
    glowClass: 'shadow-[0_0_15px_rgba(0,245,255,0.4)]',
    desc: 'Righteous avatar. Bow of absolute truth.',
  },
  'Seetha': {
    name: 'Seetha',
    title: 'Seetha (The Pure Devotion)',
    badge: '🌸',
    colorClass: 'text-cyberpink',
    borderClass: 'border-cyberpink',
    bgClass: 'from-cyberpink/15 to-cyberpink/5',
    glowClass: 'shadow-[0_0_15px_rgba(255,94,223,0.4)]',
    desc: 'The divine consort. Essence of pure grace.',
  },
  'Lakshmana': {
    name: 'Lakshmana',
    title: 'Lakshmana (The Protector)',
    badge: '🛡️',
    colorClass: 'text-cybergold',
    borderClass: 'border-cybergold',
    bgClass: 'from-cybergold/15 to-cybergold/5',
    glowClass: 'shadow-[0_0_15px_rgba(255,213,79,0.4)]',
    desc: 'Unwavering brother. Fierce guardian of dharma.',
  },
  'Hanumanthudu': {
    name: 'Hanumanthudu',
    title: 'Hanumanthudu (Mighty Devotee)',
    badge: '🔱',
    colorClass: 'text-orange-400',
    borderClass: 'border-orange-500',
    bgClass: 'from-orange-500/15 to-orange-500/5',
    glowClass: 'shadow-[0_0_15px_rgba(251,146,60,0.4)]',
    desc: 'The force of loyalty. Bearer of mountains.',
  },
  'Bharathudu': {
    name: 'Bharathudu',
    title: 'Bharathudu (Noble Ruler)',
    badge: '👑',
    colorClass: 'text-purple-400',
    borderClass: 'border-purple-500',
    bgClass: 'from-purple-500/15 to-purple-500/5',
    glowClass: 'shadow-[0_0_15px_rgba(168,85,247,0.4)]',
    desc: 'Righteous regent of Ayodhya.',
  },
  'Shatrugnudu': {
    name: 'Shatrugnudu',
    title: 'Shatrugnudu (Silent Slayer)',
    badge: '⚔️',
    colorClass: 'text-emerald-400',
    borderClass: 'border-emerald-500',
    bgClass: 'from-emerald-500/15 to-emerald-500/5',
    glowClass: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]',
    desc: 'Conqueror of all internal and external foes.',
  },
  'Jambavanthudu': {
    name: 'Jambavanthudu',
    title: 'Jambavanthudu (Wise Bear)',
    badge: '🐾',
    colorClass: 'text-indigo-400',
    borderClass: 'border-indigo-500',
    bgClass: 'from-indigo-500/15 to-indigo-500/5',
    glowClass: 'shadow-[0_0_15px_rgba(99,102,241,0.4)]',
    desc: 'The eternal witness. Source of deep counsel.',
  },
  'Sugrivudu': {
    name: 'Sugrivudu',
    title: 'Sugrivudu (Vanara King)',
    badge: '☀️',
    colorClass: 'text-yellow-400',
    borderClass: 'border-yellow-500',
    bgClass: 'from-yellow-500/15 to-yellow-500/5',
    glowClass: 'shadow-[0_0_15px_rgba(234,179,8,0.4)]',
    desc: 'Lord of Kishkindha. Allied to the divine light.',
  },
  'Vibhishana': {
    name: 'Vibhishana',
    title: 'Vibhishana (The Just)',
    badge: '📿',
    colorClass: 'text-rose-400',
    borderClass: 'border-rose-500',
    bgClass: 'from-rose-500/15 to-rose-500/5',
    glowClass: 'shadow-[0_0_15px_rgba(244,63,94,0.4)]',
    desc: 'Righteous seeker who walked the path of dharma.',
  },
};

export default function RamuduSeethaGame({ roomCode, user, socket, isHost, matchEndedData, onReturnToLobby }: RSGameProps) {
  const [myRole, setMyRole] = useState<string>('');
  const [ramuduId, setRamuduId] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [guesses, setGuesses] = useState<number>(0);
  const [hasGuessed, setHasGuessed] = useState<boolean>(false);
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
    isCorrect?: boolean;
    roles?: { [key: string]: string };
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
      setHasGuessed(false);
      setRoundScores({});
      setCountdown(null);
      setCurrentRound(data.currentRound || 1);
      setMaxRounds(data.maxRounds || 3);
      setSessionScoreboard(data.sessionScoreboard || {});
    });

    socket.on('rs_guess_result', (data: any) => {
      setRevealedIds(data.revealedIds);
      setHasGuessed(true);
      
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
      setHasGuessed(true);
      setSessionScoreboard(data.sessionScoreboard || {});
      setRoundScores(data.roundScores || {});
      if (data.countdownDuration) {
        setCountdown(data.countdownDuration);
      }

      // Reveal all players' roles
      if (data.roles) {
        setPlayers((prev) =>
          prev.map((pl) => ({
            ...pl,
            isRevealed: true,
            role: data.roles[pl.id],
          }))
        );
      }

      if (data.isCorrect) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    });

    socket.on('rs_match_ended', (data: any) => {
      setMatchEnded(true);
      setMatchResults(data);
      setHasGuessed(true);
      if (data.roles) {
        setPlayers((prev) =>
          prev.map((pl) => ({
            ...pl,
            isRevealed: true,
            role: data.roles[pl.id],
          }))
        );
      }
      confetti({
        particleCount: 220,
        spread: 100,
        origin: { y: 0.5 }
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
    if (matchEnded || roundEnded || hasGuessed || guesses > 0) return;
    if (user.id !== ramuduId) return;
    if (targetPlayerId === user.id || revealedIds.includes(targetPlayerId)) return;

    setHasGuessed(true);
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

  // Get active style details for user role
  const myRoleStyle = myRole ? CHARACTER_STYLES[myRole] : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 w-full max-w-7xl mx-auto items-stretch min-h-0 relative">
      {/* Decorative Chakra Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-primary/5 bg-gradient-to-r from-primary/5 to-transparent chakra-rotate pointer-events-none z-0"></div>

      {/* LEFT: Game Card Area */}
      <div className="flex-1 flex flex-col space-y-6 min-w-0 z-10">
        
        {/* Top dashboard row: Session stats and Identity status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 glass-panel rounded-3xl p-5 border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyberblue via-cybergold to-cyberpink"></div>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyberblue/10 text-cyberblue flex items-center justify-center shrink-0 border border-cyberblue/20">
              <Star size={24} className="fill-cyberblue/10 animate-spin-slow" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Round Status</div>
              <div className="text-xl font-black text-white">Round {currentRound} / {maxRounds}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-start sm:justify-center">
            <div className="w-12 h-12 rounded-2xl bg-cyberpink/10 text-cyberpink flex items-center justify-center shrink-0 border border-cyberpink/20 animate-pulse">
              <span className="font-extrabold text-2xl">{myRoleStyle ? myRoleStyle.badge : '🎭'}</span>
            </div>
            <div>
              <div className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Your Secret Role</div>
              <div className={`text-lg font-black tracking-wide uppercase truncate max-w-[170px] ${myRoleStyle ? myRoleStyle.colorClass : 'text-gray-300'}`}>
                {myRoleStyle ? myRoleStyle.title : 'Distributing...'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-start sm:justify-end">
            <div className="w-12 h-12 rounded-2xl bg-cybergold/10 text-cybergold flex items-center justify-center shrink-0 border border-cybergold/20">
              <span className="font-extrabold text-2xl">🏹</span>
            </div>
            <div>
              <div className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Ramudu Guesser</div>
              <div className="text-base font-black text-cyberblue truncate max-w-[150px]">
                {players.find(p => p.id === ramuduId)?.username || 'Selecting...'}
              </div>
            </div>
          </div>
        </div>

        {/* Ramudu Guess Banner Indicator */}
        {isRamudu && (
          <div className={`p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between font-bold border text-sm transition-all duration-500 ${
            hasGuessed || guesses > 0
              ? 'bg-cybererror/10 border-cybererror/35 text-cybererror shadow-neon-error' 
              : 'bg-cyberblue/10 border-cyberblue/35 text-cyberblue shadow-neon-blue animate-pulse'
          }`}>
            <div className="flex items-center gap-3 mb-2 sm:mb-0">
              <span className="text-2xl">🏹</span>
              <div>
                <div className="font-black text-base uppercase">You are Ramudu</div>
                <div className="text-xs font-semibold opacity-80">
                  {hasGuessed || guesses > 0 
                    ? 'Ramudu has used his only chance.' 
                    : 'Analyze carefully: click on a player card to guess who is Seetha!'}
                </div>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
              <span className="text-xs uppercase font-extrabold tracking-widest text-gray-400">Attempts Remaining:</span>
              <span className="text-lg font-black">{hasGuessed || guesses > 0 ? 0 : 1}</span>
            </div>
          </div>
        )}

        {/* Player Cards Area */}
        <div className="space-y-4">
          {guessResult && (
            <div className={`p-4 rounded-xl flex items-center justify-center font-extrabold border text-sm transition-all duration-300 ${
              guessResult.isCorrect 
                ? 'bg-cybersuccess/10 border-cybersuccess/40 text-cybersuccess animate-bounce shadow-neon-success' 
                : 'bg-cybererror/10 border-cybererror/40 text-cybererror animate-shake shadow-neon-error'
            }`}>
              {guessResult.username} was revealed as: {guessResult.role}! {guessResult.isCorrect ? 'FOUND SEETHA!' : 'NOT SEETHA.'}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
            {players.map((p) => {
              const isGuesserSelf = p.id === user.id;
              const isTargetRevealed = revealedIds.includes(p.id) || roundEnded || matchEnded;
              const cardRole = isGuesserSelf ? myRole : isTargetRevealed ? p.role || 'Revealed' : null;
              
              const isPlayerRamudu = p.id === ramuduId;
              const pStyle = cardRole ? CHARACTER_STYLES[cardRole] : null;

              let cardBorderClass = 'border-white/5 bg-gradient-to-b from-white/3 to-transparent';
              let subtitleColorClass = 'text-gray-500';
              let roleName = 'MYSTIC ALLY';
              let characterBadge = '🕉️';
              let cardBgClass = 'from-white/3 to-transparent';
              let cardGlow = '';

              if (pStyle) {
                cardBorderClass = pStyle.borderClass;
                subtitleColorClass = pStyle.colorClass;
                roleName = pStyle.name.toUpperCase();
                characterBadge = pStyle.badge;
                cardBgClass = pStyle.bgClass;
                cardGlow = pStyle.glowClass;
              } else if (isPlayerRamudu) {
                // If we only know they are Ramudu (visual helper)
                cardBorderClass = 'border-cyberblue';
                subtitleColorClass = 'text-cyberblue';
                roleName = 'RAMUDU';
                characterBadge = '🏹';
                cardBgClass = 'from-cyberblue/15 to-cyberblue/5';
                cardGlow = 'shadow-[0_0_15px_rgba(0,245,255,0.3)]';
              } else {
                // Unknown Deity back of card
                cardBorderClass = 'border-primary/20 bg-gradient-to-b from-primary/10 via-darkbg to-primary/5 hover:border-cyberpink/50 hover:shadow-neon-pink';
                subtitleColorClass = 'text-primary/70';
                roleName = 'MYSTICAL DEITY';
                characterBadge = '🕉️';
                cardBgClass = 'from-primary/10 via-darkbg to-primary/5';
              }

              const isClickable = isRamudu && !isGuesserSelf && !isTargetRevealed && !roundEnded && !matchEnded && !hasGuessed && guesses === 0;

              return (
                <div 
                  key={p.id}
                  onClick={() => isClickable && handleCardClick(p.id)}
                  className={`glass-card rounded-2xl p-4 md:p-6 border flex flex-col items-center justify-between text-center cursor-pointer transition-all aspect-[3/4] select-none bg-gradient-to-b ${cardBgClass} ${cardBorderClass} ${cardGlow} ${
                    isClickable ? 'hover:scale-105 hover:-translate-y-1 hover:border-cyberblue active:scale-95' : 'cursor-default'
                  }`}
                >
                  <div className="w-full flex justify-end shrink-0">
                    {isTargetRevealed && (
                      <span className="p-1 bg-cybersuccess/10 text-cybersuccess border border-cybersuccess/30 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <ShieldCheck size={12} /> Revealed
                      </span>
                    )}
                  </div>

                  <div className="relative my-4 shrink-0 flex items-center justify-center">
                    {/* Glowing Aura circles behind the badge */}
                    <div className="absolute inset-0 w-20 h-20 rounded-full bg-primary/5 blur-md animate-pulse"></div>
                    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-3xl md:text-4xl border border-white/10 shadow-2xl bg-black/40`}>
                      {characterBadge}
                    </div>
                  </div>

                  <div className="w-full space-y-1 shrink-0">
                    <h5 className="font-extrabold text-sm md:text-base text-gray-200 truncate w-full tracking-wide">
                      {p.username}
                    </h5>
                    <p className={`text-[10px] md:text-[11px] uppercase tracking-widest font-black ${subtitleColorClass}`}>
                      {roleName}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT: Live Sticky Scoreboard & Mission Log */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6 z-10">
        
        {/* Live Scoreboard */}
        <div className="glass-panel rounded-3xl p-5 border-white/5 space-y-4 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-cybergold"></div>
          <h4 className="font-black text-sm uppercase text-gray-400 tracking-wider flex items-center gap-2">
            🏆 Session Scoreboard
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            {sortedScoreboard.map((row, idx) => {
              const isLeader = row.userId === leaderId;
              const addedPoints = roundScores[row.userId] || 0;
              
              return (
                <div 
                  key={row.userId}
                  className={`flex justify-between items-center p-3.5 rounded-2xl border transition-all duration-500 ${
                    isLeader 
                      ? 'border-cybergold/30 bg-cybergold/5 shadow-[0_0_15px_rgba(255,213,79,0.08)]' 
                      : 'border-white/5 bg-white/3 hover:bg-white/5'
                  } ${addedPoints > 0 ? 'animate-pulse-gold border-cybergold/40' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`font-black text-xs w-4 shrink-0 ${isLeader ? 'text-cybergold' : 'text-gray-500'}`}>
                      #{idx + 1}
                    </span>
                    <div className="relative shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs uppercase ${
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
                      <span className="text-[10px] text-cybersuccess font-black animate-bounce shrink-0">
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
        <div className="glass-panel rounded-3xl p-5 border-white/5 space-y-4 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-cyberblue"></div>
          <h4 className="font-black text-sm uppercase text-gray-400 tracking-wider flex items-center gap-2">
            <HelpCircle size={16} className="text-cyberblue" /> Mission Log
          </h4>
          
          <div className="space-y-3 text-xs text-gray-400 leading-relaxed">
            <p>
              <strong className="text-white">Objective:</strong> Ramudu must identify <span className="text-cyberpink font-bold">Seetha</span>.
            </p>
            <p>
              If you are <strong className="text-cyberblue font-bold">Ramudu</strong>, you have exactly <span className="text-cyberblue font-extrabold underline">ONE ATTEMPT</span> to select Seetha.
            </p>
            <p>
              If Ramudu is <strong className="text-cybersuccess font-bold">Correct</strong>: Ramudu wins 1000 points.
            </p>
            <p>
              If Ramudu is <strong className="text-cybererror font-bold">Incorrect</strong>: Ramudu gets 0, Seetha gets 1000 points (revealed), and other players earn their character scores.
            </p>
          </div>

          <div className="border-t border-white/5 pt-4 flex justify-between items-center">
            <span className="text-[10px] uppercase font-bold text-gray-500">Attempts Remaining</span>
            <span className={`text-lg font-black ${hasGuessed || guesses > 0 ? 'text-cybererror' : 'text-cybersuccess'}`}>
              {hasGuessed || guesses > 0 ? 0 : 1}
            </span>
          </div>
        </div>

      </div>

      {/* Round End Modal Overlay */}
      {roundEnded && roundData && !matchEnded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
          <div className={`w-full max-w-lg glass-panel rounded-3xl p-6 border relative overflow-hidden shadow-2xl transition-all duration-300 transform scale-100 ${
            roundData.isCorrect 
              ? 'border-cybergold/30 shadow-[0_0_30px_rgba(255,213,79,0.2)]' 
              : 'border-cybererror/30 shadow-[0_0_30px_rgba(255,77,77,0.2)] animate-shake'
          }`}>
            
            {/* Divider Gradient Top Bar */}
            <div className={`absolute top-0 left-0 w-full h-[4px] ${roundData.isCorrect ? 'bg-cybergold' : 'bg-cybererror'}`}></div>

            {countdown !== null && (
              <div className={`absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full border text-xs font-black ${
                roundData.isCorrect ? 'border-cybergold text-cybergold' : 'border-cybererror text-cybererror'
              }`}>
                {countdown}s
              </div>
            )}
            
            <div className="text-center mb-6 mt-4">
              <span className={`text-[10px] font-black uppercase tracking-widest ${roundData.isCorrect ? 'text-cybergold' : 'text-cybererror'}`}>
                Round {roundData.currentRound} Completed
              </span>
              <h3 className="text-3xl font-black text-white mt-1.5 uppercase tracking-wide">
                {roundData.isCorrect ? '✨ Victory of Light' : '⚡ Ramudu Defeated'}
              </h3>
              <p className="text-sm text-gray-400 mt-2 font-medium">
                {roundData.isCorrect ? (
                  <span>Ramudu successfully located <strong className="text-cyberpink">Seetha</strong>!</span>
                ) : (
                  <span>
                    Ramudu guessed incorrectly! The actual <strong className="text-cyberpink">Seetha</strong> was: <span className="text-white font-bold">{players.find(p => p.id === roundData.seethaId)?.username || 'Unknown'}</span>
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider flex items-center gap-1.5">
                <Award size={14} className="text-cybergold" /> Round scores & standings
              </h4>
              <div className="divide-y divide-white/5 bg-white/3 rounded-2xl p-4 border border-white/5 space-y-3">
                {Object.entries(sessionScoreboard)
                  .map(([userId, val]) => ({ userId, username: val.username, score: val.score }))
                  .sort((a, b) => b.score - a.score)
                  .map((row, idx) => {
                    const roundScore = roundScores[row.userId] || 0;
                    const playerRole = roundData.roles?.[row.userId];
                    const roleBadge = playerRole ? CHARACTER_STYLES[playerRole]?.badge : '';
                    const roleName = playerRole ? CHARACTER_STYLES[playerRole]?.name : '';
                    
                    return (
                      <div key={row.userId} className="flex justify-between items-center py-2 text-sm first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-bold text-gray-400 w-4">#{idx + 1}</span>
                          <span className="font-extrabold text-gray-200 truncate">{row.username}</span>
                          {playerRole && (
                            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-gray-400 flex items-center gap-1 font-bold">
                              <span>{roleBadge}</span>
                              <span className="uppercase text-[8px] tracking-wider">{roleName}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] text-cybersuccess font-black bg-cybersuccess/10 px-2 py-0.5 rounded border border-cybersuccess/20">
                            +{roundScore} pts
                          </span>
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
                className="w-full py-4 rounded-xl btn-mythic-gold font-extrabold uppercase text-xs tracking-wider text-center"
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
              <div className="w-full h-[3px] bg-white/10 absolute bottom-0 left-0">
                <div 
                  className={`h-full transition-all duration-1000 ease-linear ${roundData.isCorrect ? 'bg-cybergold' : 'bg-cybererror'}`}
                  style={{ width: `${(countdown / 10) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grand Finale Session End Overlay Modal */}
      {matchEnded && matchResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-cybergold/30 relative overflow-hidden shadow-[0_0_35px_rgba(255,213,79,0.15)] animate-float-slow">
            
            <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-cybergold via-cyberpink to-cyberblue"></div>

            <div className="text-center mb-6 mt-4">
              <span className="text-[10px] font-black uppercase text-cybergold tracking-widest flex items-center justify-center gap-1">
                🏆 Campaign Complete
              </span>
              <h3 className="text-3xl font-black text-white mt-1 uppercase tracking-wide">Grand Placements</h3>
              <p className="text-sm text-gray-400 mt-2 font-medium">
                All rounds completed! The final campaign standings are finalized:
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <h4 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Final Standings</h4>
              <div className="divide-y divide-white/5 bg-white/3 rounded-2xl p-4 border border-white/5 space-y-3">
                {matchResults.scoreboard.map((row) => {
                  const finalRole = matchResults.roles?.[row.userId];
                  const finalBadge = finalRole ? CHARACTER_STYLES[finalRole]?.badge : '';
                  return (
                    <div key={row.userId} className="flex justify-between items-center py-2 text-sm first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-black text-cybergold w-4">#{row.placement}</span>
                        <span className="font-bold text-gray-200 truncate">{row.username}</span>
                        {finalRole && (
                          <span className="text-xs shrink-0" title={finalRole}>{finalBadge}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-[10px] text-gray-400">+{row.xpEarned} XP &bull; +{row.coinsEarned} 🪙</span>
                        <span className="font-black text-cyberpink">{row.score} pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {isHost ? (
              <button 
                onClick={() => socket.emit('rs_return_to_lobby', roomCode)}
                className="w-full py-4 rounded-xl btn-mythic font-extrabold uppercase text-xs tracking-wider text-center"
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
