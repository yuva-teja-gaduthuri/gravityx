'use client';

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { HelpCircle, Star, ShieldCheck, Crown, Heart, UserPlus, MessageSquare, ThumbsUp, X, Award, User } from 'lucide-react';
import { getApiUrl } from '../utils/api';
import { useTranslation } from '../hooks/useTranslation';

interface Player {
  id: string;
  username: string;
  avatar: string;
  profileFrame: string;
  isRevealed?: boolean;
  role?: string;
  socketId: string;
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
  'Angadudu': {
    name: 'Angadudu',
    title: 'Angadudu (Mighty Prince)',
    badge: '⚔️',
    colorClass: 'text-cyan-400',
    borderClass: 'border-cyan-500',
    bgClass: 'from-cyan-500/15 to-cyan-500/5',
    glowClass: 'shadow-[0_0_15px_rgba(6,182,212,0.4)]',
    desc: 'Valiant prince of Kishkindha. Courageous emissary.',
  },
};

export default function RamuduSeethaGame({ roomCode, user, socket, isHost, matchEndedData, onReturnToLobby }: RSGameProps) {
  const { t } = useTranslation();
  const [myRole, setMyRole] = useState<string>('');
  const [ramuduId, setRamuduId] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [guesses, setGuesses] = useState<number>(0);
  const [hasGuessed, setHasGuessed] = useState<boolean>(false);
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
  const [likedPlayersInGame, setLikedPlayersInGame] = useState<string[]>([]);
  const [socialModalUser, setSocialModalUser] = useState<Player | null>(null);

  // Match ended state
  const [matchEnded, setMatchEnded] = useState(false);
  const [speakingPlayers, setSpeakingPlayers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleSpeaking = (e: any) => {
      const { socketId, isSpeaking } = e.detail;
      setSpeakingPlayers((prev) => {
        const next = new Set(prev);
        if (isSpeaking) {
          next.add(socketId);
        } else {
          next.delete(socketId);
        }
        return next;
      });
    };
    window.addEventListener('voice_user_speaking', handleSpeaking);
    return () => window.removeEventListener('voice_user_speaking', handleSpeaking);
  }, []);
  const [matchResults, setMatchResults] = useState<{
    winnerId: string;
    seethaId: string;
    guessCount: number;
    scoreboard: ScoreboardRow[];
    isCorrect?: boolean;
    roles?: { [key: string]: string };
  } | null>(null);
  const [likedScoreboardPlayers, setLikedScoreboardPlayers] = useState<string[]>([]);

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

  // Load likes on match end
  useEffect(() => {
    if (matchEnded && matchResults) {
      const fetchLikes = async () => {
        const token = localStorage.getItem('gravityx_token');
        const initialLikes: {[username: string]: number} = {};
        for (const row of matchResults.scoreboard) {
          try {
            const res = await fetch(getApiUrl(`/api/social/likes/${row.username}`), {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const data = await res.json();
              initialLikes[row.username] = data.likesCount;
            } else {
              initialLikes[row.username] = 15;
            }
          } catch (e) {
            initialLikes[row.username] = 15;
          }
        }
        setLikesMap(initialLikes);
      };
      fetchLikes();
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
      setHasGuessed(false);
      setRoundScores({});
      setCountdown(null);
      setRoundTimer(15);
      setShowFailureAnimation(false);
      setCurrentRound(data.currentRound || 1);
      setMaxRounds(data.maxRounds || 3);
      setSessionScoreboard(data.sessionScoreboard || {});
      setLikedPlayersInGame([]); // Reset in-game likes
      setLikedScoreboardPlayers([]);
    });

    socket.on('rs_guess_result', (data: any) => {
      setRevealedIds(data.revealedIds);
      setGuesses(data.guesses);
      if (data.guesses > 0) {
        setHasGuessed(true);
      } else {
        setHasGuessed(false);
      }
      
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

      if (data.won === false) {
        setShowFailureAnimation(true);
        setTimeout(() => {
          setShowFailureAnimation(false);
        }, 2000);
      } else {
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
    setGuesses(1);
    socket.emit('rs_guess', {
      roomCode,
      targetUserId: targetPlayerId
    });
  };

  const handleLike = async (username: string) => {
    try {
      const token = localStorage.getItem('gravityx_token');
      const res = await fetch(getApiUrl('/api/social/like'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetUsername: username })
      });
      if (res.ok) {
        const data = await res.json();
        setLikesMap(prev => ({ ...prev, [username]: data.likesCount }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveReview = async (username: string) => {
    try {
      const token = localStorage.getItem('gravityx_token');
      const res = await fetch(getApiUrl('/api/social/review'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUsername: username,
          rating: reviewRating,
          comment: reviewComment
        })
      });
      if (res.ok) {
        setReviewModalUser(null);
        setReviewComment('');
        setReviewRating(5);
        alert(`Feedback saved successfully for ${username}!`);
      }
    } catch (e) {
      console.error(e);
    }
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

  // Get active style details for user role
  const myRoleStyle = myRole ? CHARACTER_STYLES[myRole] : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 w-full max-w-7xl mx-auto items-stretch min-h-0 relative">
      {/* Decorative Chakra Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-primary/5 bg-gradient-to-r from-primary/5 to-transparent chakra-rotate pointer-events-none z-0"></div>

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
              <span className="font-extrabold text-2xl">⏳</span>
            </div>
            <div>
              <div className="text-[10px] uppercase font-black text-gray-500 tracking-wider">Round Time Remaining</div>
              <div className={`text-lg font-black tracking-wide ${roundTimer <= 5 ? 'text-cybererror animate-ping' : 'text-white'}`}>
                {roundTimer} seconds
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
        {isRamudu ? (
          <div className={`p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between font-bold border text-sm transition-all duration-500 ${
            hasGuessed || guesses > 0
              ? 'bg-cybererror/10 border-cybererror/35 text-cybererror shadow-neon-error' 
              : 'bg-cyberblue/10 border-cyberblue/35 text-cyberblue shadow-neon-blue animate-pulse'
          }`}>
            <div className="flex items-center gap-3 mb-2 sm:mb-0">
              <span className="text-2xl">🏹</span>
              <div>
                <div className="font-black text-base uppercase">{t('guessPrompt', 'Ramudu, locate Seetha!')}</div>
                <div className="text-xs font-semibold opacity-80">
                  {hasGuessed || guesses > 0 
                    ? 'Ramudu has used his only chance.' 
                    : 'Analyze carefully: click on a player card to guess who is Seetha!'}
                </div>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
              <span className="text-xs uppercase font-extrabold tracking-widest text-gray-400">{t('attemptsRemaining', 'Guesses Left')}:</span>
              <span className="text-lg font-black">{hasGuessed || guesses > 0 ? 0 : 1}</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-extrabold text-center text-sm">
            🎭 You are {myRoleStyle ? myRoleStyle.title : 'Distributing...'}! Protect Seetha from Ramudu.
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

              // If correct guess is won, only animate Seetha's card
              const isCorrectSeethaCard = roundEnded && roundData?.won && p.id === roundData?.seethaId;

              if (pStyle) {
                cardBorderClass = pStyle.borderClass;
                subtitleColorClass = pStyle.colorClass;
                roleName = pStyle.name.toUpperCase();
                characterBadge = pStyle.badge;
                cardBgClass = pStyle.bgClass;
                cardGlow = pStyle.glowClass;
                
                if (cardRole === 'Seetha' && isCorrectSeethaCard) {
                  cardBorderClass = 'border-cybersuccess border-2';
                  cardGlow = 'animate-bounce shadow-[0_0_20px_rgba(74,222,128,0.7)]';
                }
              } else if (isPlayerRamudu) {
                cardBorderClass = 'border-cyberblue';
                subtitleColorClass = 'text-cyberblue';
                roleName = 'RAMUDU';
                characterBadge = '🏹';
                cardBgClass = 'from-cyberblue/15 to-cyberblue/5';
                cardGlow = 'shadow-[0_0_15px_rgba(0,245,255,0.3)]';
              } else {
                cardBorderClass = 'border-primary/20 bg-gradient-to-b from-primary/10 via-darkbg to-primary/5 hover:border-cyberpink/50 hover:shadow-neon-pink';
                subtitleColorClass = 'text-primary/70';
                roleName = 'MYSTICAL DEITY';
                characterBadge = '🕉️';
                cardBgClass = 'from-primary/10 via-darkbg to-primary/5';
              }

              const isClickable = isRamudu && !isGuesserSelf && !isTargetRevealed && !roundEnded && !matchEnded && !hasGuessed && guesses === 0;
              const isSpeaking = speakingPlayers.has(p.socketId);

              let activeBorderClass = cardBorderClass;
              let activeGlow = cardGlow;
              if (isSpeaking) {
                activeBorderClass = 'border-cybersuccess';
                activeGlow = 'shadow-[0_0_15px_rgba(0,230,118,0.6)]';
              }

              return (
                <div 
                  key={p.id}
                  onClick={() => isClickable && handleCardClick(p.id)}
                  className={`glass-card rounded-2xl p-4 md:p-6 border flex flex-col items-center justify-between text-center cursor-pointer transition-all aspect-[3/4] select-none bg-gradient-to-b ${cardBgClass} ${activeBorderClass} ${activeGlow} ${
                    isClickable ? 'hover:scale-105 hover:-translate-y-1 hover:border-cyberblue active:scale-95' : 'cursor-default'
                  }`}
                >
                  <div className="w-full flex justify-between items-center shrink-0">
                    {p.id !== user.id ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSocialModalUser(p);
                        }}
                        className="p-1 bg-white/5 hover:bg-white/15 border border-white/10 rounded-full text-cyberblue hover:scale-110 transition-all"
                        title="View Profile & Social Actions"
                      >
                        <User size={12} />
                      </button>
                    ) : (
                      <div />
                    )}
                    {isTargetRevealed && (
                      <span className="p-1 bg-cybersuccess/10 text-cybersuccess border border-cybersuccess/30 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <ShieldCheck size={12} /> Revealed
                      </span>
                    )}
                  </div>

                  <div className="relative my-4 shrink-0 flex items-center justify-center">
                    <div className="absolute inset-0 w-20 h-20 rounded-full bg-primary/5 blur-md animate-pulse"></div>
                    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-3xl md:text-4xl border border-white/10 shadow-2xl bg-black/40 ${
                      isSpeaking ? 'border-cybersuccess shadow-[0_0_12px_rgba(0,230,118,0.5)] ring-2 ring-cybersuccess' : ''
                    }`}>
                      {characterBadge}
                    </div>
                  </div>

                  <div className="w-full space-y-1 shrink-0">
                    <h5 className="font-extrabold text-sm md:text-base text-gray-200 truncate w-full tracking-wide flex items-center justify-center gap-1">
                      {p.username}
                      {isSpeaking && (
                        <span className="text-cybersuccess animate-pulse" title="Speaking">
                          🎙️
                        </span>
                      )}
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
                onClick={() => {
                  const isLastRound = currentRound >= maxRounds;
                  if (isLastRound) {
                    socket.emit('rs_show_final_scorecard', roomCode);
                  } else {
                    socket.emit('rs_next_round', roomCode);
                  }
                }}
                className="w-full py-4 rounded-xl btn-mythic-gold font-extrabold uppercase text-xs tracking-wider text-center"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-cybergold/30 relative overflow-hidden shadow-[0_0_35px_rgba(255,213,79,0.15)] animate-float-slow my-8">
            
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

            {/* Grand Champion section */}
            {matchResults.scoreboard.length > 0 && (() => {
              const winner = matchResults.scoreboard[0];
              const isWinnerSelf = winner.username === user.username;
              const winnerRole = 'Ramudu';
              const winnerStyle = CHARACTER_STYLES[winnerRole];
              const isWinnerFriendAdded = friendStatus[winner.username] === 'sent';
              const isWinnerFriendSending = friendStatus[winner.username] === 'sending';
              const hasLikedWinner = likedScoreboardPlayers.includes(winner.username);

              return (
                <div className="glass-card rounded-3xl p-6 border-cybergold/50 bg-gradient-to-b from-cybergold/20 to-cybergold/5 text-center flex flex-col items-center relative overflow-hidden shadow-[0_0_25px_rgba(255,213,79,0.25)] border-2 mb-6">
                  <div className="absolute -top-10 -left-10 w-24 h-24 bg-cybergold/10 rounded-full blur-xl"></div>
                  <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-cybergold/10 rounded-full blur-xl"></div>
                  
                  <span className="text-[10px] font-black uppercase text-cybergold tracking-widest flex items-center gap-1.5 animate-bounce mb-2">
                    👑 RAMUDU / WINNER #1 👑
                  </span>
                  
                  <div className="w-16 h-16 rounded-full bg-cybergold/20 border-2 border-cybergold flex items-center justify-center text-4xl mb-3 shadow-[0_0_15px_rgba(255,213,79,0.4)]">
                    {winnerStyle?.badge || '🏹'}
                  </div>

                  <h3 className="text-xl font-black text-white">{winner.username} {isWinnerSelf && <span className="text-xs text-gray-400">(you)</span>}</h3>
                  <p className="text-xs font-black text-cybergold uppercase tracking-widest mt-1">
                    {winner.score} POINTS
                  </p>
                  
                  <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
                    {/* Like Button */}
                    <button
                      onClick={() => {
                        if (hasLikedWinner) return;
                        handleLike(winner.username);
                        setLikedScoreboardPlayers(prev => [...prev, winner.username]);
                      }}
                      disabled={hasLikedWinner}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                        hasLikedWinner
                          ? 'bg-cyberpink/20 border-cyberpink/30 text-cyberpink cursor-not-allowed opacity-80'
                          : 'bg-white/5 border-white/10 hover:border-cyberpink text-gray-300 hover:text-white active:scale-95'
                      }`}
                    >
                      <Heart size={12} className={hasLikedWinner ? "fill-cyberpink text-cyberpink" : ""} />
                      <span>{hasLikedWinner ? 'Liked 👍' : 'Like'} ({likesMap[winner.username] || 0})</span>
                    </button>

                    {/* Add Friend Button */}
                    {!isWinnerSelf && (
                      <button
                        onClick={() => handleAddFriendClick(winner.username)}
                        disabled={isWinnerFriendAdded || isWinnerFriendSending}
                        className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-cyberblue text-xs font-bold text-gray-300 hover:text-white flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <UserPlus size={12} className="text-cyberblue" />
                        <span>
                          {isWinnerFriendAdded ? 'Friend Added' : isWinnerFriendSending ? 'Sending...' : 'Add Friend'}
                        </span>
                      </button>
                    )}

                    {/* Review Button */}
                    {!isWinnerSelf && (
                      <button
                        onClick={() => setReviewModalUser(winner.username)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-cybergold text-xs font-bold text-gray-300 hover:text-white flex items-center gap-1.5 transition-all"
                      >
                        <MessageSquare size={12} className="text-cybergold" />
                        <span>Review</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Remaining players section */}
            <div className="space-y-3 mb-6">
              <h4 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Remaining Standings</h4>
              <div className="divide-y divide-white/5 bg-white/3 rounded-2xl p-4 border border-white/5 space-y-3 overflow-y-auto max-h-[220px]">
                {matchResults.scoreboard.slice(1).map((row, idx) => {
                  const sortedIdx = idx + 1; // because we sliced the winner
                  const FINAL_STANDINGS_ROSTER = ['Ramudu', 'Lakshmana', 'Seetha', 'Hanumanthudu', 'Bharathudu', 'Shatrugnudu', 'Jambavanthudu', 'Sugrivudu', 'Vibhishana'];
                  const finalRole = FINAL_STANDINGS_ROSTER[sortedIdx] || 'Vibhishana';
                  const finalBadge = CHARACTER_STYLES[finalRole]?.badge || '📿';
                  const isSelf = row.username === user.username;
                  const isFriendAdded = friendStatus[row.username] === 'sent';
                  const isFriendSending = friendStatus[row.username] === 'sending';
                  const hasLiked = likedScoreboardPlayers.includes(row.username);

                  return (
                    <div key={row.userId} className="flex flex-col py-3 first:pt-0 last:pb-0 gap-3">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-black text-gray-400 w-4">#{sortedIdx + 1}</span>
                          <span className="font-bold text-gray-200 truncate">{row.username} {isSelf && <span className="text-[9px] text-gray-500">(you)</span>}</span>
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-gray-400 flex items-center gap-1 font-bold">
                            <span>{finalBadge}</span>
                            <span className="uppercase text-[8px] tracking-wider">{finalRole}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 font-bold">
                          <span className="text-[10px] text-gray-400">+{row.xpEarned} XP &bull; +{row.coinsEarned} 🪙</span>
                          <span className="font-black text-cyberpink">{row.score} pts</span>
                        </div>
                      </div>

                      {/* Interaction Row */}
                      <div className="flex items-center gap-2 flex-wrap pl-7">
                        {/* Like Button */}
                        <button
                          onClick={() => {
                            if (hasLiked) return;
                            handleLike(row.username);
                            setLikedScoreboardPlayers(prev => [...prev, row.username]);
                          }}
                          disabled={hasLiked}
                          className={`px-2.5 py-1 rounded border text-[10px] font-bold flex items-center gap-1.5 transition-all ${
                            hasLiked
                              ? 'bg-cyberpink/20 border-cyberpink/30 text-cyberpink cursor-not-allowed opacity-80'
                              : 'bg-white/5 border-white/10 hover:border-cyberpink text-gray-300 hover:text-white active:scale-95'
                          }`}
                        >
                          <Heart size={10} className={hasLiked ? "fill-cyberpink text-cyberpink" : ""} />
                          <span>{hasLiked ? 'Liked 👍' : 'Like'} ({likesMap[row.username] || 0})</span>
                        </button>

                        {/* Add Friend option (show to all users but not yourself) */}
                        {!isSelf && (
                          <button
                            onClick={() => handleAddFriendClick(row.username)}
                            disabled={isFriendAdded || isFriendSending}
                            className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-cyberblue text-[10px] font-bold text-gray-300 flex items-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            <UserPlus size={10} className="text-cyberblue" />
                            <span>
                              {isFriendAdded ? 'Friend Added' : isFriendSending ? 'Sending...' : 'Add Friend'}
                            </span>
                          </button>
                        )}

                        {/* Review Option (Only for registered users, but let guests rate too, and not for themselves) */}
                        {!isSelf && (
                          <button
                            onClick={() => setReviewModalUser(row.username)}
                            className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-cybergold text-[10px] font-bold text-gray-300 flex items-center gap-1.5 transition-all"
                          >
                            <MessageSquare size={10} className="text-cybergold" />
                            <span>Review Player</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button 
              onClick={onReturnToLobby}
              className="w-full py-4 rounded-xl btn-mythic font-extrabold uppercase text-xs tracking-wider text-center"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}

      {/* In-Game Player Social Modal */}
      {socialModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-xs glass-panel rounded-3xl p-6 border border-white/10 relative shadow-neon-blue text-center space-y-4">
            <button 
              onClick={() => setSocialModalUser(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
            
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-tr from-cyberblue/20 to-cyberpink/20 border border-white/10 flex items-center justify-center text-3xl">
              {socialModalUser.avatar === 'cyborg' ? '🤖' : '👽'}
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-black text-white">{socialModalUser.username}</h4>
              <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Active Crew Member</p>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              {/* Like Button */}
              <button
                type="button"
                onClick={() => {
                  if (likedPlayersInGame.includes(socialModalUser.username)) return;
                  handleLike(socialModalUser.username);
                  setLikedPlayersInGame(prev => [...prev, socialModalUser.username]);
                }}
                disabled={likedPlayersInGame.includes(socialModalUser.username)}
                className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                  likedPlayersInGame.includes(socialModalUser.username)
                    ? 'bg-cyberpink/20 border-cyberpink/30 text-cyberpink cursor-not-allowed opacity-80'
                    : 'bg-white/5 border-white/10 hover:border-cyberpink text-gray-300 hover:text-white active:scale-95'
                }`}
              >
                <Heart size={14} className={likedPlayersInGame.includes(socialModalUser.username) ? "fill-cyberpink text-cyberpink animate-pulse" : ""} />
                <span>{likedPlayersInGame.includes(socialModalUser.username) ? 'Liked' : 'Like'}</span>
              </button>

              {/* Add Friend Button */}
              <button
                type="button"
                onClick={() => handleAddFriendClick(socialModalUser.username)}
                disabled={friendStatus[socialModalUser.username] === 'sent' || friendStatus[socialModalUser.username] === 'sending'}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyberblue text-xs font-bold text-gray-300 hover:text-white flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <UserPlus size={14} />
                <span>
                  {friendStatus[socialModalUser.username] === 'sent'
                    ? 'Added'
                    : friendStatus[socialModalUser.username] === 'sending'
                    ? 'Sending...'
                    : 'Add Friend'}
                </span>
              </button>
            </div>
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
