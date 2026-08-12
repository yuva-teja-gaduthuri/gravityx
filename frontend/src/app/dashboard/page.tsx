'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import SocialDrawer from '../../components/SocialDrawer';
import ThemeToggle from '../../components/ThemeToggle';
import { getApiUrl, fetchWithCache } from '../../utils/api';
import { useTranslation } from '../../hooks/useTranslation';
import { 
  Trophy, Coins, LogOut, Settings, ShoppingBag, 
  Plus, Users, Flame, PlusCircle, HelpCircle, Gamepad2, ShieldAlert, Edit3, CheckCircle2,
  Volume2, Lock, Sparkles, Target, Play
} from 'lucide-react';
import { PuzzleModal } from '../../components/chess/PuzzleModal';
import ChessGame from '../../components/ChessGame';
import LudoGame from '../../components/LudoGame';

const AVATAR_GRAPHICS: { [key: string]: string } = {
  astronaut: '👨‍🚀',
  cyborg: '🤖',
  alien: '👽',
  nebula: '🌌',
  cyberpunk: '👾',
  captain: '🧑‍✈️',
  commander: '🧑‍🚀',
  destiny: '💫'
};

export default function Dashboard() {
  const router = useRouter();
  const socket = useSocket();
  const { user, stats, refreshProfile, logout, loading } = useAuth(true);
  const { t, currentLanguage } = useTranslation();

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<'global' | 'friends'>('global');
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSocialDrawer, setShowSocialDrawer] = useState(false);
  const [showPuzzleModal, setShowPuzzleModal] = useState(false);
  const [localGameMode, setLocalGameMode] = useState<'NONE' | 'CHESS_PASS' | 'LUDO_PASS'>('NONE');

  // Form states
  const [roomName, setRoomName] = useState('');
  const [selectedGame, setSelectedGame] = useState<'RAMUDU_SEETHA' | 'LUDO' | 'CHESS'>('RAMUDU_SEETHA');
  const [roomType, setRoomType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [voiceChat, setVoiceChat] = useState(false);
  const [allowSpectators, setAllowSpectators] = useState(false);
  const [chessTimeControl, setChessTimeControl] = useState<number | 'UNLIMITED'>('UNLIMITED');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [createError, setCreateError] = useState('');
  const [publicRooms, setPublicRooms] = useState<any[]>([]);

  // Extra Create Lobby Parameters
  const [coinStake, setCoinStake] = useState(0);
  const [turnTimer, setTurnTimer] = useState(30);

  // Leaderboard toggle & expanded games
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [expandedGame, setExpandedGame] = useState<'RAMUDU_SEETHA' | 'LUDO' | 'CHESS' | null>(null);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [reviews, setReviews] = useState<{
    [game: string]: { username: string; rating: number; comment: string; date: string }[];
  }>({
    RAMUDU_SEETHA: [],
    LUDO: [],
    CHESS: []
  });

  const fetchFeedback = async () => {
    try {
      const token = localStorage.getItem('gravityx_token');
      if (!token) return;
      const games = ['RAMUDU_SEETHA', 'LUDO', 'CHESS'] as const;
      const fetchedReviews: any = {};
      
      for (const game of games) {
        const res = await fetch(getApiUrl(`/api/feedback/${game}`), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          fetchedReviews[game] = data.map((fb: any) => ({
            username: fb.username,
            rating: fb.rating,
            comment: fb.comment,
            date: fb.createdAt ? fb.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]
          }));
        }
      }
      
      if (Object.keys(fetchedReviews).length > 0) {
        setReviews(prev => ({
          ...prev,
          ...fetchedReviews
        }));
      }
    } catch (e) {
      console.error('Failed to load feedback from backend', e);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent, game: 'RAMUDU_SEETHA' | 'LUDO' | 'CHESS') => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    try {
      const token = localStorage.getItem('gravityx_token');
      const res = await fetch(getApiUrl('/api/feedback'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          game,
          rating: newRating,
          comment: newComment,
        }),
      });

      if (res.ok) {
        const savedFeedback = await res.json();
        const newRev = {
          username: savedFeedback.username,
          rating: savedFeedback.rating,
          comment: savedFeedback.comment,
          date: savedFeedback.createdAt ? savedFeedback.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
        };
        setReviews(prev => ({
          ...prev,
          [game]: [newRev, ...prev[game]],
        }));
        setNewComment('');
        setNewRating(5);
      } else {
        console.error('Failed to save feedback to DB');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
    }
  };

  // Profile Edit states
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('default_avatar');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Consolidate settings states
  const [music, setMusic] = useState(true);
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(80);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState('English');
  const [privacy, setPrivacy] = useState('Public');

  // Load settings on mount
  useEffect(() => {
    try {
      const savedMusic = localStorage.getItem('gravityx_setting_music');
      const savedSound = localStorage.getItem('gravityx_setting_sound');
      const savedVolume = localStorage.getItem('gravityx_setting_volume');
      const savedNotifications = localStorage.getItem('gravityx_setting_notifications');
      const savedLanguage = localStorage.getItem('gravityx_setting_language');
      const savedPrivacy = localStorage.getItem('gravityx_setting_privacy');

      if (savedMusic !== null) setMusic(savedMusic === 'true');
      if (savedSound !== null) setSound(savedSound === 'true');
      if (savedVolume !== null) setVolume(Number(savedVolume));
      if (savedNotifications !== null) setNotifications(savedNotifications === 'true');
      if (savedLanguage !== null) setLanguage(savedLanguage);
      if (savedPrivacy !== null) setPrivacy(savedPrivacy);
    } catch (e) {
      console.error('Failed to load telemetry settings', e);
    }
  }, []);

  // Sync profile edit state
  useEffect(() => {
    if (user) {
      setEditUsername(user.username);
      setEditAvatar(user.avatar || 'default_avatar');
    }
  }, [user, showEditProfileModal]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    const token = localStorage.getItem('gravityx_token');
    try {
      // Save settings to localStorage
      localStorage.setItem('gravityx_setting_music', String(music));
      localStorage.setItem('gravityx_setting_sound', String(sound));
      localStorage.setItem('gravityx_setting_volume', String(volume));
      localStorage.setItem('gravityx_setting_notifications', String(notifications));
      localStorage.setItem('gravityx_setting_privacy', privacy);

      const res = await fetch(getApiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: editUsername, avatar: editAvatar, language: currentLanguage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      localStorage.setItem('gravityx_user', JSON.stringify(data.user));
      refreshProfile();
      setProfileSuccess('Telemetry sync updated successfully!');
      setTimeout(() => {
        setShowEditProfileModal(false);
        setProfileSuccess('');
      }, 1500);
    } catch (err: any) {
      setProfileError(err.message);
    }
  };

  // Fetch leaderboard
  const fetchLeaderboard = async () => {
    try {
      const data = await fetchWithCache(`/api/leaderboard?type=${leaderboardType}`, 180000); // 3-minute staleTime
      setLeaderboard(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLeaderboard();
    }
  }, [user, leaderboardType]);

  const fetchPublicRooms = async () => {
    try {
      const token = localStorage.getItem('gravityx_token');
      const res = await fetch(getApiUrl('/api/rooms'), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setPublicRooms(data);
      }
    } catch (e) {
      console.error('Failed to load active lobbies', e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPublicRooms();
      fetchFeedback();
      const interval = setInterval(fetchPublicRooms, 8000); // 8 seconds poll
      return () => clearInterval(interval);
    }
  }, [user]);

  // Socket listeners for room redirection & active game check
  useEffect(() => {
    if (!socket || !user) return;

    // Request active room check for user
    socket.emit('check_active_room', { userId: user.id });

    const handleActiveRoom = ({ roomCode }: { roomCode: string }) => {
      router.push(`/room/${roomCode}`);
    };

    socket.on('active_room_found', handleActiveRoom);

    socket.on('room_created', (room: any) => {
      setShowCreateModal(false);
      router.push(`/room/${room.code}`);
    });

    socket.on('room_joined', (room: any) => {
      setShowJoinModal(false);
      router.push(`/room/${room.code}`);
    });

    socket.on('error', (msg: string) => {
      setJoinError(msg);
      setCreateError(msg);
    });

    return () => {
      socket.off('active_room_found', handleActiveRoom);
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('error');
    };
  }, [socket, user, router]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!user || !socket) return;

    const finalMaxPlayers = selectedGame === 'CHESS' ? 2 : selectedGame === 'RAMUDU_SEETHA' ? Math.max(3, Number(maxPlayers)) : Number(maxPlayers);

    socket.emit('create_room', {
      userId: user.id,
      username: user.username,
      name: roomName || `${user.username}'s Lobby`,
      gameType: selectedGame,
      type: roomType,
      maxPlayers: finalMaxPlayers,
      voiceChat,
      allowSpectators,
      timeControl: selectedGame === 'CHESS' ? chessTimeControl : undefined,
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    if (!user || !socket || !joinCode.trim()) return;

    socket.emit('join_room', {
      roomCode: joinCode.trim().toUpperCase(),
      userId: user.id,
      username: user.username,
    });
  };

  // Adjust max player options depending on game selection
  useEffect(() => {
    if (selectedGame === 'LUDO') {
      setMaxPlayers(4); // Default to 4
    } else if (selectedGame === 'CHESS') {
      setMaxPlayers(2);
    } else if (selectedGame === 'RAMUDU_SEETHA') {
      setMaxPlayers(4);
    } else {
      setMaxPlayers(4);
    }
  }, [selectedGame]);

  if (loading || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary/15" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyberblue animate-spin" />
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-cyberpink animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.75s' }} />
        </div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Calibrating Gravity Field...</p>
      </div>
    );
  }

  // Next level progress percentage
  const nextLevelXp = user.level * 200;
  const xpPercent = Math.round((user.xp / nextLevelXp) * 100);

  const renderDetailsPanel = () => {
    if (!expandedGame) return null;
    return (
      <div className="glass-panel rounded-3xl p-6 md:p-8 border-white/5 space-y-6 mt-6 animate-fade-in text-left">
        
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-cyberblue">game command console</span>
            <h3 className="text-2xl font-black text-white">
              {expandedGame === 'LUDO' ? 'Cosmic Ludo' : expandedGame === 'CHESS' ? 'Chess Strategy' : 'Ramudu-Seetha'}
            </h3>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {expandedGame === 'CHESS' && (
              <button
                onClick={() => setShowPuzzleModal(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/40 hover:border-amber-400 text-amber-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md"
              >
                <Sparkles className="w-4 h-4 text-amber-400" /> Puzzle Mode
              </button>
            )}

            {(expandedGame === 'CHESS' || expandedGame === 'LUDO') && (
              <button
                onClick={() => setLocalGameMode(expandedGame === 'CHESS' ? 'CHESS_PASS' : 'LUDO_PASS')}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
              >
                <Play className="w-4 h-4 fill-white" /> Pass & Play Mode
              </button>
            )}

            <button
              onClick={() => { setSelectedGame(expandedGame); setShowCreateModal(true); }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-cyberblue hover:opacity-90 text-xs font-black uppercase tracking-wider shadow-neon-blue"
            >
              Host Arena Lobby
            </button>
            <button
              onClick={() => { setShowJoinModal(true); }}
              className="px-5 py-2.5 rounded-xl glass-card text-xs font-black uppercase tracking-wider hover:border-white/20"
            >
              Join Via Code
            </button>
          </div>
        </div>

        {/* Instructions & Reviews grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Rules instructions */}
          <div className="space-y-4">
            <h4 className="text-sm font-black text-white uppercase tracking-wider">Flight Instructions (How to Play)</h4>
            {expandedGame === 'LUDO' ? (
              <ul className="list-disc list-inside space-y-2 text-xs text-gray-300">
                <li>Each operator starts with 4 spaceships in their respective corner home yard.</li>
                <li>Roll a <strong className="text-cyberblue">6</strong> to deploy a ship onto the launching track.</li>
                <li>Move clockwise according to the dice roll. Safety stars protect your ship from elimination.</li>
                <li>Landing on an opponent's ship destroys it, returning it to their home yard.</li>
                <li>Navigate all 4 ships through the track and home stretch to the center home terminal to win!</li>
              </ul>
            ) : expandedGame === 'CHESS' ? (
              <ul className="list-disc list-inside space-y-2 text-xs text-gray-300">
                <li>Classic 8x8 chess.com style board with green-and-white grid UI.</li>
                <li>Plays with standard FIDE rules (White makes the first move).</li>
                <li>Click on your piece to highlight all valid movement targets.</li>
                <li>Checkmate the opponent's king to secure victory.</li>
                <li>Features real-time socket syncing, active clocks, and spectator features.</li>
              </ul>
            ) : (
              <ul className="list-disc list-inside space-y-2 text-xs text-gray-300">
                <li>One operator is assigned the role of <strong className="text-cyberpink">Ramudu</strong>, and one is <strong className="text-cyberpink">Seetha</strong>.</li>
                <li>Other operators are given secret profiles.</li>
                <li>Ramudu must query the crew members and deduce which player is the secret Seetha.</li>
                <li>Query players to gather clues, and submit your guesses.</li>
                <li>Seetha must evade detection. Earn points by guessing correctly or evading guess cycles!</li>
              </ul>
            )}
          </div>

          {/* Reviews Section */}
          <div className="space-y-4 border-l border-white/5 pl-0 md:pl-8">
            <h4 className="text-sm font-black text-white uppercase tracking-wider">Crew Ratings & Feedback</h4>
            
            {/* Add Review form */}
            <form onSubmit={(e) => handleSubmitReview(e, expandedGame)} className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">Submit Telemetry Feedback</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setNewRating(val)}
                      className={`text-sm ${val <= newRating ? 'text-cybergold' : 'text-gray-600'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a feedback log..."
                  className="flex-grow glass-input rounded-xl px-3.5 py-2 text-xs focus:border-cyberblue"
                />
                <button type="submit" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">
                  Submit
                </button>
              </div>
            </form>

            {/* Review logs */}
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
              {reviews[expandedGame].map((rev, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span className="font-extrabold">{rev.username}</span>
                    <span>{rev.date}</span>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <p className="text-gray-300 leading-normal">{rev.comment}</p>
                    <span className="text-cybergold text-[10px] whitespace-nowrap">{'★'.repeat(rev.rating)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-grow">
      {/* Local Pass & Play Mode Overlay Container */}
      {localGameMode === 'CHESS_PASS' && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
          <ChessGame user={user} isPassAndPlay={true} onReturnToLobby={() => setLocalGameMode('NONE')} />
        </div>
      )}

      {localGameMode === 'LUDO_PASS' && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
          <LudoGame roomCode="PASS_PLAY" user={user} isPassAndPlay={true} onReturnToLobby={() => setLocalGameMode('NONE')} />
        </div>
      )}

      {/* Future-ready Puzzle Mode Modal */}
      <PuzzleModal isOpen={showPuzzleModal} onClose={() => setShowPuzzleModal(false)} />

      {/* ═══ COMMAND BAR NAVIGATION ═══ */}
      <nav className="w-full glass-panel py-3.5 px-6 md:px-10 flex flex-col sm:flex-row items-center justify-between border-b border-white/[0.06] gap-4">
        
        {/* Profile HUD */}
        <div
          onClick={() => router.push('/profile')}
          className="flex items-center gap-3.5 cursor-pointer group"
          title="Profile Settings & Configuration"
          role="button"
          tabIndex={0}
        >
          <div className="relative flex-shrink-0">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all group-hover:scale-105 ${
              user.profileFrame === 'neon_glow'
                ? 'border-cyberblue shadow-neon-blue bg-cyberblue/10'
                : user.profileFrame === 'event_horizon'
                ? 'border-cyberpink shadow-neon-pink bg-cyberpink/10'
                : 'border-white/15 bg-primary/10'
            }`}>
              <div className="w-9 h-9 rounded-full bg-deepspace-800 flex items-center justify-center text-xl">
                {AVATAR_GRAPHICS[user.avatar] || '👽'}
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-primary to-cyberblue flex items-center justify-center text-[9px] font-black text-white border-2 border-deepspace-800">
              {user.level}
            </span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base text-white group-hover:text-cyberpink transition-colors">
                {user.username}
              </span>
              {user.role === 'ADMIN' && (
                <span className="badge badge-pink text-[8px]">Admin</span>
              )}
              {user.rank && (
                <span className="badge badge-gold text-[8px]">{user.rank}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 w-44">
              <div className="progress-track flex-grow h-1.5">
                <div className="progress-bar h-full xp-bar" style={{ width: `${xpPercent}%` }} />
              </div>
              <span className="text-stat text-[9px] text-gray-600">{user.xp}/{nextLevelXp}</span>
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Coins display */}
          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-card border-white/[0.06] cursor-default">
            <Coins size={14} className="text-cybergold" />
            <span className="text-stat text-sm font-bold text-cybergold">{user.coins.toLocaleString()}</span>
          </div>

          <ThemeToggle />

          <button
            id="dashboard-store-btn"
            onClick={() => router.push('/store')}
            className="p-2.5 rounded-xl glass-card border-white/[0.06] text-gray-500 hover:text-cyberblue hover:border-cyberblue/30 transition-all"
            title="Store"
            aria-label="Open Store"
          >
            <ShoppingBag size={17} />
          </button>

          <button
            id="dashboard-social-btn"
            onClick={() => setShowSocialDrawer(!showSocialDrawer)}
            className={`p-2.5 rounded-xl glass-card border-white/[0.06] text-gray-500 hover:text-cyberpink hover:border-cyberpink/30 transition-all ${showSocialDrawer ? 'border-cyberpink/50 text-cyberpink shadow-neon-pink bg-cyberpink/8' : ''}`}
            title="Social Console"
            aria-label="Toggle Social Drawer"
          >
            <Users size={17} />
          </button>

          {user.role === 'ADMIN' && (
            <button
              onClick={() => router.push('/admin')}
              className="px-3 py-2.5 rounded-xl bg-cyberpink/10 border border-cyberpink/25 text-cyberpink hover:bg-cyberpink hover:text-white transition-all text-[10px] font-black uppercase tracking-wider"
            >
              Panel
            </button>
          )}

          <button
            id="dashboard-logout-btn"
            onClick={() => { logout(); router.push('/auth'); }}
            className="p-2.5 rounded-xl glass-card border-white/[0.06] text-gray-500 hover:text-cybererror hover:border-cybererror/30 hover:bg-cybererror/8 transition-all"
            title="Log Out"
            aria-label="Log Out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </nav>

      {/* ═══ MAIN CONTENT GRID ═══ */}
      <div className="flex-grow flex flex-col lg:flex-row">
        {/* Main Launcher Feed */}
        <div className="flex-1 p-5 md:p-7 space-y-7 overflow-y-auto max-h-[calc(100vh-72px)]">
          
          {/* Welcome Banner */}
          <div className="relative rounded-2xl overflow-hidden p-6 border border-white/[0.06]" style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.12) 0%, rgba(0,245,255,0.05) 100%)' }}>
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-40" style={{ background: user.profileFrame === 'event_horizon' ? 'rgba(255,94,223,0.3)' : 'rgba(108,99,255,0.25)' }} />
            <div className="relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-1">Welcome back, Commander</p>
              <h2 className="font-display text-2xl font-bold text-white">{user.username}</h2>
              <div className="flex items-center gap-3 mt-2">
                {user.rank && <span className="badge badge-gold">{user.rank}</span>}
                <span className="badge badge-primary">Lv. {user.level}</span>
                <span className="text-[10px] text-gray-500 text-stat">{user.xp.toLocaleString()} XP earned</span>
                {stats && <span className="text-[10px] text-gray-500">{stats.wins}W · {stats.losses}L</span>}
              </div>
            </div>
          </div>

          {/* Quick Action Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              id="dashboard-create-room-btn"
              onClick={() => setShowCreateModal(true)}
              className="glass-card rounded-2xl p-5 border-white/[0.05] flex items-center gap-4 group hover:border-primary/40 text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/12 text-primary flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                <PlusCircle size={22} />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-white">{t('createRoomBtn', 'Create Room')}</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">Spin up a custom lobby</p>
              </div>
            </button>

            <button
              id="dashboard-join-room-btn"
              onClick={() => setShowJoinModal(true)}
              className="glass-card rounded-2xl p-5 border-white/[0.05] flex items-center gap-4 group hover:border-cyberblue/40 text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-cyberblue/12 text-cyberblue flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                <Users size={22} />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-white">{t('joinRoomBtn', 'Join Room')}</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">Enter code to join friends</p>
              </div>
            </button>

            <button
              id="dashboard-leaderboard-btn"
              onClick={() => router.push('/leaderboard')}
              className="glass-card rounded-2xl p-5 border-white/[0.05] flex items-center gap-4 group hover:border-cybergold/40 text-left w-full"
            >
              <div className="w-11 h-11 rounded-xl bg-cybergold/12 text-cybergold flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                <Trophy size={22} />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-white">Leaderboard</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">View global rankings</p>
              </div>
            </button>
          </div>

          {/* Game Selection Portals */}
          <div className="space-y-4">
            <h3 className="text-[10px] uppercase font-extrabold tracking-widest text-gray-500">Launch Deck</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto w-full">
              
              {/* Ramudu-Seetha Card */}
              <div className="flex flex-col gap-4">
                <div
                  onClick={() => setExpandedGame(expandedGame === 'RAMUDU_SEETHA' ? null : 'RAMUDU_SEETHA')}
                  id="game-card-ramudu"
                  className={`game-portal p-5 flex flex-col justify-between h-[320px] transition-all duration-400 cursor-pointer ${
                    expandedGame === 'RAMUDU_SEETHA'
                      ? 'border-cyberpink/60 shadow-neon-pink'
                      : 'hover:border-cyberpink/40 hover:shadow-neon-pink'
                  }`}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(255,94,223,0.08) 0%, transparent 60%)' }} />
                  <div>
                    <div className="w-full h-28 rounded-xl bg-gradient-to-br from-cyberpink/18 to-primary/8 border border-white/[0.06] flex items-center justify-center relative overflow-hidden mb-4">
                      <span className="text-4xl hover:scale-110 transition-transform duration-300">🕵️</span>
                      <span className="absolute top-2 right-2 badge badge-pink text-[8px]">deduction</span>
                      {expandedGame === 'RAMUDU_SEETHA' && (
                        <div className="absolute inset-0 border border-cyberpink/40 rounded-xl" />
                      )}
                    </div>
                    <h4 className="font-display font-bold text-base text-white">Ramudu-Seetha</h4>
                    <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed line-clamp-2">Deduce target profiles. Ramudu seeks Seetha. Multiplayer social deduction.</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="live-dot" style={{ width: '5px', height: '5px' }} />
                      <span className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">3-10 Players</span>
                    </div>
                    <span className="text-[10px] text-cyberpink font-black">{expandedGame === 'RAMUDU_SEETHA' ? 'Close ×' : 'Details →'}</span>
                  </div>
                </div>
                {expandedGame === 'RAMUDU_SEETHA' && (
                  <div className="block md:hidden">{renderDetailsPanel()}</div>
                )}
              </div>

              {/* Ludo Card */}
              <div className="flex flex-col gap-4">
                <div
                  onClick={() => setExpandedGame(expandedGame === 'LUDO' ? null : 'LUDO')}
                  id="game-card-ludo"
                  className={`game-portal p-5 flex flex-col justify-between h-[320px] transition-all duration-400 cursor-pointer ${
                    expandedGame === 'LUDO'
                      ? 'border-cyberblue/60 shadow-neon-blue'
                      : 'hover:border-cyberblue/40 hover:shadow-neon-blue'
                  }`}
                >
                  <div>
                    <div className="w-full h-28 rounded-xl bg-gradient-to-br from-cyberblue/18 to-primary/8 border border-white/[0.06] flex items-center justify-center relative overflow-hidden mb-4">
                      <span className="text-4xl hover:scale-110 transition-transform duration-300">🎲</span>
                      <span className="absolute top-2 right-2 badge badge-blue text-[8px]">classic</span>
                      {expandedGame === 'LUDO' && (
                        <div className="absolute inset-0 border border-cyberblue/40 rounded-xl" />
                      )}
                    </div>
                    <h4 className="font-display font-bold text-base text-white">Cosmic Ludo</h4>
                    <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed line-clamp-2">Roll 3D dice, knock back spaceships, reach home terminal. Real-time turns.</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="live-dot" style={{ width: '5px', height: '5px' }} />
                      <span className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">2-4 Players</span>
                    </div>
                    <span className="text-[10px] text-cyberblue font-black">{expandedGame === 'LUDO' ? 'Close ×' : 'Details →'}</span>
                  </div>
                </div>
                {expandedGame === 'LUDO' && (
                  <div className="block md:hidden">{renderDetailsPanel()}</div>
                )}
              </div>

              {/* Chess Card */}
              <div className="flex flex-col gap-4">
                <div
                  onClick={() => setExpandedGame(expandedGame === 'CHESS' ? null : 'CHESS')}
                  id="game-card-chess"
                  className={`game-portal p-5 flex flex-col justify-between h-[320px] transition-all duration-400 cursor-pointer ${
                    expandedGame === 'CHESS'
                      ? 'border-cybergold/60 shadow-neon-gold'
                      : 'hover:border-cybergold/40 hover:shadow-neon-gold'
                  }`}
                >
                  <div>
                    <div className="w-full h-28 rounded-xl bg-gradient-to-br from-cybergold/18 to-primary/8 border border-white/[0.06] flex items-center justify-center relative overflow-hidden mb-4">
                      <span className="text-4xl hover:scale-110 transition-transform duration-300">♟️</span>
                      <span className="absolute top-2 right-2 badge badge-gold text-[8px]">tactical</span>
                      {expandedGame === 'CHESS' && (
                        <div className="absolute inset-0 border border-cybergold/40 rounded-xl" />
                      )}
                    </div>
                    <h4 className="font-display font-bold text-base text-white">Chess Strategy</h4>
                    <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed line-clamp-2">Classic grandmaster tactics. FIDE rules, real-time clocks, spectator support.</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="live-dot" style={{ width: '5px', height: '5px' }} />
                      <span className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">2 Players</span>
                    </div>
                    <span className="text-[10px] text-cybergold font-black">{expandedGame === 'CHESS' ? 'Close ×' : 'Details →'}</span>
                  </div>
                </div>
                {expandedGame === 'CHESS' && (
                  <div className="block md:hidden">{renderDetailsPanel()}</div>
                )}
              </div>
            </div>

            {/* Expanded Game Details Panel (Desktop only) */}
            {expandedGame && (
              <div className="hidden md:block">{renderDetailsPanel()}</div>
            )}

            {/* Live Public Lobbies Board */}
            <div className="space-y-4 pt-6 border-t border-white/[0.06] max-w-4xl mx-auto w-full">
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="live-dot" />
                    <span className="text-[10px] uppercase font-extrabold tracking-widest text-cyberpink">Live Feeds</span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-white mt-0.5">{t('activeLobbies', 'Active Public Lobbies')}</h3>
                </div>
                <button
                  id="dashboard-refresh-rooms-btn"
                  onClick={fetchPublicRooms}
                  className="px-3 py-1.5 rounded-lg glass-card border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-white hover:border-white/15 transition-all"
                >
                  ↻ Refresh
                </button>
              </div>

              {publicRooms.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 border-white/[0.05] text-center space-y-2">
                  <div className="text-3xl mb-3">🛸</div>
                  <p className="text-sm font-semibold text-gray-400">{t('noActiveLobbies', 'No open lobbies on the radar.')}</p>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider">Host a room to start a transmission!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {publicRooms.map((room) => (
                    <div
                      key={room.code}
                      className="glass-card rounded-xl p-4 border-white/[0.05] flex items-center justify-between hover:border-primary/30 transition-all"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white truncate">{room.name}</span>
                          <span className={`badge text-[8px] ${
                            room.gameType === 'LUDO' ? 'badge-blue' :
                            room.gameType === 'CHESS' ? 'badge-gold' : 'badge-pink'
                          }`}>
                            {room.gameType === 'LUDO' ? 'Ludo' : room.gameType === 'CHESS' ? 'Chess' : 'RS'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500">Host: <strong className="text-gray-400">{room.hostName}</strong></p>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <span className="text-stat text-xs font-bold text-gray-500">{room.playerCount}/{room.maxPlayers}</span>
                          <div className="text-[9px] text-gray-700 uppercase">crew</div>
                        </div>
                        <button
                          onClick={() => {
                            if (!user || !socket) return;
                            socket.emit('join_room', {
                              roomCode: room.code,
                              userId: user.id,
                              username: user.username,
                            });
                          }}
                          className="px-3.5 py-2 rounded-xl btn-primary text-[10px] font-black uppercase tracking-wider active:scale-95"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right side Social Drawer */}
        {showSocialDrawer && (
          <SocialDrawer currentUserId={user.id} />
        )}
      </div>

      {/* ═══ CREATE ROOM MODAL ═══ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4">
          <div className="w-full max-w-md surface-elevated rounded-3xl p-6 relative overflow-y-auto max-h-[90vh] animate-scale-in">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-primary via-cyberblue to-cyberpink rounded-t-3xl" />
            <h3 className="font-display text-xl font-bold text-white mb-6">⚡ Create Lobby</h3>
            {createError && (
              <div className="mb-4 p-3 rounded-lg bg-cybererror/10 border border-cybererror/30 text-cybererror text-xs flex gap-2">
                <ShieldAlert size={16} /> <span>{createError}</span>
              </div>
            )}
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">Lobby Name</label>
                <input 
                  type="text" 
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder={`${user.username}'s Arena`}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberblue"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">Select Game</label>
                  <select 
                    value={selectedGame}
                    onChange={(e) => {
                      const game = e.target.value as any;
                      setSelectedGame(game);
                      if (game === 'CHESS') setMaxPlayers(2);
                      else if (game === 'LUDO') setMaxPlayers(4);
                      else setMaxPlayers(4);
                    }}
                    className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberblue"
                  >
                    <option value="RAMUDU_SEETHA">Ramudu-Seetha</option>
                    <option value="LUDO">Cosmic Ludo</option>
                    <option value="CHESS">Chess Strategy ♟️</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">Max Crew</label>
                  {selectedGame === 'LUDO' ? (
                    <select 
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                      className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberblue"
                    >
                      <option value={2}>2 Players</option>
                      <option value={3}>3 Players</option>
                      <option value={4}>4 Players</option>
                    </select>
                  ) : selectedGame === 'CHESS' ? (
                    <select 
                      value={2}
                      disabled
                      className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberblue opacity-60"
                    >
                      <option value={2}>2 Players</option>
                    </select>
                  ) : (
                    <input 
                      type="number"
                      min={3}
                      max={10}
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                      className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberblue"
                    />
                  )}
                </div>
              </div>

              {/* Extra configuration settings in create box */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">Stake Buy-In</label>
                  <select 
                    value={coinStake}
                    onChange={(e) => setCoinStake(Number(e.target.value))}
                    className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberblue"
                  >
                    <option value={0}>0 (Free Play)</option>
                    <option value={50}>50 Coins</option>
                    <option value={100}>100 Coins</option>
                    <option value={500}>500 Coins</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">
                    {selectedGame === 'CHESS' ? 'Chess Time Control' : 'Turn Timer Speed'}
                  </label>
                  {selectedGame === 'CHESS' ? (
                    <select
                      value={chessTimeControl}
                      onChange={(e) => setChessTimeControl(e.target.value === 'UNLIMITED' ? 'UNLIMITED' : Number(e.target.value))}
                      className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cybergold font-bold text-white bg-slate-900"
                    >
                      <option value="UNLIMITED">∞ Unlimited (No Timer)</option>
                      <option value={60}>⚡ 1 Min (Bullet)</option>
                      <option value={180}>🔥 3 Min (Blitz)</option>
                      <option value={300}>🎯 5 Min (Blitz)</option>
                      <option value={600}>⏳ 10 Min (Rapid)</option>
                      <option value={900}>🏆 15 Min</option>
                      <option value={1800}>👑 30 Min</option>
                    </select>
                  ) : (
                    <select 
                      value={turnTimer}
                      onChange={(e) => setTurnTimer(Number(e.target.value))}
                      className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberblue"
                    >
                      <option value={15}>15s (Blitz)</option>
                      <option value={30}>30s (Normal)</option>
                      <option value={60}>60s (Slow)</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">Lobby Type</label>
                  <select 
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value as any)}
                    className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberblue"
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="PRIVATE">Private</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">Voice Chat</label>
                  <select 
                    value={voiceChat ? 'ON' : 'OFF'}
                    onChange={(e) => setVoiceChat(e.target.value === 'ON')}
                    className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberblue"
                  >
                    <option value="OFF">OFF</option>
                    <option value="ON">ON</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setCreateError(''); }}
                  className="px-4 py-2.5 rounded-xl btn-ghost text-sm"
                >
                  Cancel
                </button>
                <button
                  id="create-room-submit-btn"
                  type="submit"
                  className="px-6 py-2.5 rounded-xl btn-primary text-sm font-bold"
                >
                  🚀 Launch Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Consolidated Profile & Settings Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4 overflow-y-auto py-8">
          <div className="w-full max-w-lg glass-panel rounded-3xl p-6 md:p-8 border-white/5 relative overflow-hidden shadow-neon-pink my-auto max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <span className="text-[10px] uppercase font-bold text-cyberpink tracking-wider">telemetry configuration</span>
                <h3 className="text-2xl font-black text-white mt-0.5">Control Center</h3>
              </div>
              <button
                onClick={() => { setShowEditProfileModal(false); setProfileError(''); setProfileSuccess(''); }}
                className="text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider"
              >
                Close
              </button>
            </div>

            {profileError && (
              <div className="mb-4 p-3 rounded-lg bg-cybererror/10 border border-cybererror/30 text-cybererror text-xs flex gap-2">
                <ShieldAlert size={16} /> <span>{profileError}</span>
              </div>
            )}
            {profileSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess text-xs flex gap-2">
                <CheckCircle2 size={16} /> <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              
              {/* Profile Identity Parameters */}
              <div className="space-y-4">
                <h4 className="text-xs uppercase font-extrabold text-cyberpink tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <Settings size={14} /> Profile Telemetry
                </h4>
                
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Telemetry Alias</label>
                  <input 
                    type="text" 
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="Username"
                    className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberpink focus:ring-1 focus:ring-cyberpink"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Select Hologram Avatar</label>
                  <div className="grid grid-cols-4 gap-2.5 mt-2">
                    {['astronaut', 'cyborg', 'alien', 'nebula', 'cyberpunk', 'captain', 'commander', 'destiny'].map((av) => (
                      <button
                        key={av}
                        type="button"
                        onClick={() => setEditAvatar(av)}
                        className={`py-2 rounded-xl text-[10px] font-bold border transition-all truncate px-1 ${
                          editAvatar === av 
                            ? 'border-cyberpink bg-cyberpink/10 text-white shadow-neon-pink' 
                            : 'border-white/5 bg-white/5 text-gray-400 hover:text-white hover:border-white/10'
                        }`}
                      >
                        <span className="capitalize">{av}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Console Audio & System settings */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs uppercase font-extrabold text-cyberblue tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <Volume2 size={14} /> Console Settings
                </h4>

                <div className="space-y-3.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-300">Ambient Background Music</span>
                    <button 
                      type="button"
                      onClick={() => setMusic(!music)}
                      className={`w-10 h-5 rounded-full p-0.5 transition-all ${music ? 'bg-primary' : 'bg-white/10'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-all ${music ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </button>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-300">Interactive Game Sound Effects</span>
                    <button 
                      type="button"
                      onClick={() => setSound(!sound)}
                      className={`w-10 h-5 rounded-full p-0.5 transition-all ${sound ? 'bg-primary' : 'bg-white/10'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-all ${sound ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </button>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[10px] font-bold text-gray-400">
                      <span>Console Volume</span>
                      <span>{volume}%</span>
                    </div>
                    <input 
                      type="range" 
                      min={0} 
                      max={100}
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>

                    {/* Language configuration removed */}

                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-300">Profile Visibility</span>
                    <select 
                      value={privacy}
                      onChange={(e) => setPrivacy(e.target.value)}
                      className="glass-input rounded-xl px-2.5 py-1 text-xs focus:border-cyberblue cursor-pointer"
                    >
                      <option value="Public">Public (Global Boards)</option>
                      <option value="Friends">Friends Only</option>
                      <option value="Private">Private</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action triggers */}
              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <button 
                  type="button" 
                  onClick={() => { setShowEditProfileModal(false); setProfileError(''); setProfileSuccess(''); }} 
                  className="px-4 py-2 rounded-xl glass-card text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-primary via-cyberblue to-primary bg-[size:200%] hover:bg-[100%] text-xs font-bold shadow-neon-blue"
                >
                  Commit Modifications
                </button>
              </div>
            </form>

            {/* Logout button removed from modal */}

          </div>
        </div>
      )}

      {/* ═══ JOIN ROOM MODAL ═══ */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop px-4">
          <div className="w-full max-w-sm surface-elevated rounded-3xl p-7 relative animate-scale-in">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-cyberblue via-primary to-cyberblue rounded-t-3xl" />
            
            <div className="text-center mb-7">
              <div className="w-14 h-14 rounded-2xl bg-primary/12 flex items-center justify-center mx-auto mb-4">
                <Users size={24} className="text-cyberblue" />
              </div>
              <h3 className="font-display text-xl font-bold text-white">Join Room</h3>
              <p className="text-xs text-gray-500 mt-1">Enter the 6-character room code</p>
            </div>

            {joinError && (
              <div className="mb-4 p-3 rounded-xl bg-cybererror/10 border border-cybererror/30 text-cybererror text-xs flex gap-2 animate-shake">
                <ShieldAlert size={14} /> <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoinRoom} className="space-y-5">
              <div>
                <label className="text-[10px] uppercase font-extrabold text-gray-500 tracking-widest block mb-2">Room Code</label>
                <input
                  id="join-room-code-input"
                  type="text"
                  required
                  maxLength={6}
                  autoComplete="off"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="XYZA12"
                  className="w-full glass-input rounded-2xl px-4 py-4 text-center text-2xl font-black tracking-[0.4em] font-mono focus:border-cyberblue uppercase"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowJoinModal(false); setJoinError(''); }}
                  className="flex-1 py-3 rounded-xl btn-ghost text-sm"
                >
                  Cancel
                </button>
                <button
                  id="join-room-submit-btn"
                  type="submit"
                  className="flex-1 py-3 rounded-xl btn-primary text-sm font-bold"
                >
                  🚀 Join Lobby
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
