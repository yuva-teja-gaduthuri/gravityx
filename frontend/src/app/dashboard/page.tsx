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
  Volume2, Lock
} from 'lucide-react';

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
  const { t } = useTranslation();

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<'global' | 'friends'>('global');
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSocialDrawer, setShowSocialDrawer] = useState(false);

  // Form states
  const [roomName, setRoomName] = useState('');
  const [selectedGame, setSelectedGame] = useState<'RAMUDU_SEETHA' | 'LUDO' | 'CHESS'>('RAMUDU_SEETHA');
  const [roomType, setRoomType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [voiceChat, setVoiceChat] = useState(false);
  const [allowSpectators, setAllowSpectators] = useState(false);
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
    RAMUDU_SEETHA: [
      { username: 'CosmicVoyager', rating: 5, comment: 'Phenomenal deduction mechanics! Really challenges your logical thinking.', date: '2026-07-24' },
      { username: 'LudoKing', rating: 4, comment: 'Very interesting game, although requires exactly 3+ players.', date: '2026-07-23' }
    ],
    LUDO: [
      { username: 'SpaceRacer', rating: 5, comment: 'Classic traditional Ludo in space! The board looks amazing.', date: '2026-07-24' },
      { username: 'StarGazer', rating: 4, comment: 'Really love the team mode and quick emojis in chat.', date: '2026-07-24' }
    ],
    CHESS: [
      { username: 'Grandmaster', rating: 5, comment: 'Sleek interface. The chess board layout feels premium.', date: '2026-07-25' }
    ]
  });

  const handleSubmitReview = (e: React.FormEvent, game: 'RAMUDU_SEETHA' | 'LUDO' | 'CHESS') => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    const newRev = {
      username: user.username,
      rating: newRating,
      comment: newComment,
      date: new Date().toISOString().split('T')[0]
    };
    setReviews(prev => ({
      ...prev,
      [game]: [newRev, ...prev[game]]
    }));
    setNewComment('');
    setNewRating(5);
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
      localStorage.setItem('gravityx_setting_language', language);
      localStorage.setItem('gravityx_setting_privacy', privacy);

      const res = await fetch(getApiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: editUsername, avatar: editAvatar }),
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
      const interval = setInterval(fetchPublicRooms, 8000); // 8 seconds poll
      return () => clearInterval(interval);
    }
  }, [user]);

  // Socket listeners for room redirection
  useEffect(() => {
    if (!socket) return;

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
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('error');
    };
  }, [socket, router]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!user || !socket) return;

    const finalMaxPlayers = selectedGame === 'RAMUDU_SEETHA' ? Math.max(3, Number(maxPlayers)) : Number(maxPlayers);

    socket.emit('create_room', {
      userId: user.id,
      username: user.username,
      name: roomName || `${user.username}'s Lobby`,
      gameType: selectedGame,
      type: roomType,
      maxPlayers: finalMaxPlayers,
      voiceChat,
      allowSpectators,
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
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-cyberblue animate-spin mb-4"></div>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Calibrating Gravity Field...</p>
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

          <div className="flex gap-3">
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
      {/* Top Header Navigation */}
      <nav className="w-full glass-panel py-4 px-6 md:px-12 flex flex-col sm:flex-row items-center justify-between border-b border-white/5 gap-4">
        {/* Clickable Profile HUD Card */}
        <div 
          onClick={() => router.push('/profile')}
          className="flex items-center gap-4 cursor-pointer hover:opacity-90 transition-all group"
          title="Profile Settings & Configuration"
        >
          <div className="relative">
            {/* Equipped Frame Outline */}
            <div className={`w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center border-2 ${
              user.profileFrame === 'neon_glow' ? 'border-cyberblue shadow-neon-blue' : 
              user.profileFrame === 'event_horizon' ? 'border-cyberpink shadow-neon-pink' : 'border-white/10'
            }`}>
              <div className="w-11 h-11 rounded-full bg-darkbg flex items-center justify-center text-2xl">
                {AVATAR_GRAPHICS[user.avatar] || '👽'}
              </div>
            </div>
            <span className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-primary text-[10px] font-black border border-darkbg">
              {user.level}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-extrabold text-lg text-white flex items-center gap-1.5 group-hover:text-cyberpink transition-colors">
              {user.username}
              {user.role === 'ADMIN' && (
                <span className="text-[9px] font-black bg-cyberpink/20 text-cyberpink border border-cyberpink/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Admin
                </span>
              )}
            </span>
            {/* XP bar */}
            <div className="flex items-center gap-2 mt-1 w-48">
              <div className="flex-grow h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-cyberblue" style={{ width: `${xpPercent}%` }}></div>
              </div>
              <span className="text-[10px] font-semibold text-gray-500">{user.xp}/{nextLevelXp} XP</span>
            </div>
          </div>
        </div>

        {/* Action HUD Widgets */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 shadow-inner">
            <Coins size={16} className="text-cybergold" />
            <span className="text-sm font-black text-cybergold">{user.coins}</span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button 
              onClick={() => router.push('/store')} 
              className="p-3 rounded-xl glass-card border-white/10 text-gray-400 hover:text-white hover:border-cyberblue transition-all"
              title="Store"
            >
              <ShoppingBag size={18} />
            </button>
            <button 
              onClick={() => setShowSocialDrawer(!showSocialDrawer)} 
              className={`p-3 rounded-xl glass-card border-white/10 text-gray-400 hover:text-white hover:border-cyberpink transition-all ${showSocialDrawer ? 'border-cyberpink text-white shadow-neon-pink ring-1 ring-cyberpink bg-cyberpink/10' : ''}`}
              title="Add Friends & Social Console"
            >
              <Users size={18} />
            </button>
            {user.role === 'ADMIN' && (
              <button 
                onClick={() => router.push('/admin')} 
                className="p-3 rounded-xl bg-cyberpink/10 border border-cyberpink/20 text-cyberpink hover:bg-cyberpink hover:text-white transition-all font-black text-xs uppercase"
              >
                Panel
              </button>
            )}
            <button 
              onClick={() => {
                logout();
                router.push('/auth');
              }} 
              className="p-3 rounded-xl glass-card border-white/10 text-gray-400 hover:text-cybererror hover:border-cybererror/30 hover:bg-cybererror/10 transition-all"
              title="Log Out Session"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>      </nav>

      {/* Main Grid: Launcher + Sidebar */}
      <div className="flex-grow flex flex-col lg:flex-row">
        {/* Main Launcher Feed */}
        <div className="flex-1 p-6 md:p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-80px)]">
          {/* Quick Actions Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button 
              onClick={() => setShowCreateModal(true)}
              className="glass-card rounded-2xl p-5 border-white/5 flex items-center justify-between group hover:border-primary"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-all">
                  <PlusCircle size={24} />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-base">{t('createRoomBtn', 'Create Room')}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Spin up a custom lobby</p>
                </div>
              </div>
            </button>

            <button 
              onClick={() => setShowJoinModal(true)}
              className="glass-card rounded-2xl p-5 border-white/5 flex items-center justify-between group hover:border-cyberblue"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyberblue/10 text-cyberblue flex items-center justify-center group-hover:scale-105 transition-all">
                  <Users size={24} />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-base">{t('joinRoomBtn', 'Join Room')}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Enter code to join friends</p>
                </div>
              </div>
            </button>

            <button 
              onClick={() => router.push('/leaderboard')}
              className="glass-card rounded-2xl p-5 border-white/5 flex items-center justify-between group hover:border-cybergold transition-all text-left w-full"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cybergold/10 text-cybergold flex items-center justify-center group-hover:scale-105 transition-all">
                  <Trophy size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-base">Leaderboard Terminal</h4>
                  <p className="text-xs text-gray-500 mt-0.5">View global rankings</p>
                </div>
              </div>
            </button>
          </div>

          {/* Game Selection */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase font-extrabold tracking-widest text-gray-400">Launch Deck</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-4xl mx-auto w-full">
              
              {/* Ramudu-Seetha Card */}
              <div className="flex flex-col gap-4">
                <div 
                  onClick={() => setExpandedGame(expandedGame === 'RAMUDU_SEETHA' ? null : 'RAMUDU_SEETHA')}
                  className={`glass-card rounded-3xl p-5 border-white/5 hover:border-cyberpink group relative overflow-hidden flex flex-col justify-between h-[340px] transition-all hover:-translate-y-2 hover:shadow-neon-pink duration-300 ${expandedGame === 'RAMUDU_SEETHA' ? 'border-cyberpink shadow-neon-pink ring-1 ring-cyberpink' : ''}`}
                  style={{ cursor: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' style='font-size: 20px;'><text y='20'>🕵️</text></svg>"), auto` }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyberpink/5 rounded-full blur-3xl group-hover:bg-cyberpink/10 transition-all"></div>
                  
                  {/* Artwork Top */}
                  <div className="w-full h-32 rounded-2xl bg-gradient-to-br from-cyberpink/20 to-transparent border border-white/5 flex items-center justify-center relative overflow-hidden">
                    <span className="text-4xl filter drop-shadow-neon-pink transform group-hover:scale-110 transition-all duration-300">🕵️</span>
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-cyberpink/20 border border-cyberpink/30 text-[8px] font-black uppercase text-cyberpink">
                      deduction
                    </span>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-lg mt-3 text-white group-hover:text-cyberpink transition-colors">Ramudu-Seetha</h4>
                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed line-clamp-2">Deduce target profiles. Ramudu seeks Seetha. Exclusively built multiplayer deduction room.</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                    <span>3-10 Players</span>
                    <span className="text-cyberpink font-black">{expandedGame === 'RAMUDU_SEETHA' ? 'Close Panel' : 'Control Deck'}</span>
                  </div>
                </div>
                {expandedGame === 'RAMUDU_SEETHA' && (
                  <div className="block md:hidden">
                    {renderDetailsPanel()}
                  </div>
                )}
              </div>

              {/* Ludo Card */}
              <div className="flex flex-col gap-4">
                <div 
                  onClick={() => setExpandedGame(expandedGame === 'LUDO' ? null : 'LUDO')}
                  className={`glass-card rounded-3xl p-5 border-white/5 hover:border-cyberblue group relative overflow-hidden flex flex-col justify-between h-[340px] transition-all hover:-translate-y-2 hover:shadow-neon-blue duration-300 ${expandedGame === 'LUDO' ? 'border-cyberblue shadow-neon-blue ring-1 ring-cyberblue' : ''}`}
                  style={{ cursor: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' style='font-size: 20px;'><text y='20'>🎲</text></svg>"), auto` }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyberblue/5 rounded-full blur-3xl group-hover:bg-cyberblue/10 transition-all"></div>
                  
                  {/* Artwork Top */}
                  <div className="w-full h-32 rounded-2xl bg-gradient-to-br from-cyberblue/20 to-transparent border border-white/5 flex items-center justify-center relative overflow-hidden">
                    <span className="text-4xl filter drop-shadow-neon-blue transform group-hover:scale-110 transition-all duration-300">🎲</span>
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-cyberblue/20 border border-cyberblue/30 text-[8px] font-black uppercase text-cyberblue">
                      classic
                    </span>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-lg mt-3 text-white group-hover:text-cyberblue transition-colors">Cosmic Ludo</h4>
                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed line-clamp-2">Roll virtual dice, knock back spaceships, reach home terminal first. Standard board dynamics.</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                    <span>2-6 Players</span>
                    <span className="text-cyberblue font-black">{expandedGame === 'LUDO' ? 'Close Panel' : 'Control Deck'}</span>
                  </div>
                </div>
                {expandedGame === 'LUDO' && (
                  <div className="block md:hidden">
                    {renderDetailsPanel()}
                  </div>
                )}
              </div>

              {/* Chess Card */}
              <div className="flex flex-col gap-4">
                <div 
                  onClick={() => alert("Chess Game module is deploying soon! Stay tuned.")}
                  className="glass-card rounded-3xl p-5 border-white/5 relative overflow-hidden flex flex-col justify-between h-[340px] opacity-60 hover:-translate-y-2 transition-all duration-300"
                  style={{ cursor: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' style='font-size: 20px;'><text y='20'>♟️</text></svg>"), auto` }}
                >
                  <div className="absolute inset-0 bg-[#050816]/75 flex flex-col items-center justify-center z-10">
                    <Lock className="text-cyberpink mb-2 animate-pulse" size={24} />
                    <span className="text-[9px] font-black uppercase text-cyberpink tracking-widest">Launching Soon</span>
                  </div>

                  {/* Artwork Top */}
                  <div className="w-full h-32 rounded-2xl bg-gradient-to-br from-cybergold/20 to-transparent border border-white/5 flex items-center justify-center relative overflow-hidden">
                    <span className="text-4xl filter drop-shadow-neon-gold">♟️</span>
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-cybergold/20 border border-cybergold/30 text-[8px] font-black uppercase text-cybergold">
                      tactical
                    </span>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-lg mt-3 text-white">Chess Strategy</h4>
                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed line-clamp-2">Classic grandmaster strategy room. Match wits in real-time cosmic space chess.</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                    <span>2 Players</span>
                    <span className="text-gray-500 font-black">LOCKED</span>
                  </div>
                </div>
                {expandedGame === 'CHESS' && (
                  <div className="block md:hidden">
                    {renderDetailsPanel()}
                  </div>
                )}
              </div>

            </div>

            {/* Expanded Game Details Panel (Desktop only) */}
            {expandedGame && (
              <div className="hidden md:block">
                {renderDetailsPanel()}
              </div>
            )}

            {/* Global Quick-Match Lobby Board */}
            <div className="space-y-4 pt-6 border-t border-white/5 max-w-4xl mx-auto w-full">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-cyberpink">live multiplayer feeds</span>
                  <h3 className="text-xl font-black text-white mt-0.5">{t('activeLobbies', 'Active Public Lobbies')}</h3>
                </div>
                <button 
                  onClick={fetchPublicRooms}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 hover:text-white transition-all"
                >
                  Refresh Radar
                </button>
              </div>

              {publicRooms.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 border-white/5 text-center space-y-2">
                  <p className="text-xs text-gray-400 font-semibold">{t('noActiveLobbies', 'No open lobbies detected on the matchmaking radar.')}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Host a custom room to start a new transmission!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {publicRooms.map((room) => (
                    <div 
                      key={room.code}
                      className="glass-card rounded-2xl p-4 border-white/5 flex items-center justify-between hover:border-cyberblue/40 transition-all group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white">{room.name}</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-bold text-cyberblue uppercase">
                            {room.gameType === 'LUDO' ? 'Ludo' : room.gameType === 'CHESS' ? 'Chess' : 'RS'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400">Host: <strong className="text-gray-300">{room.hostName}</strong></p>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-gray-500">{room.playerCount}/{room.maxPlayers} crew</span>
                        <button
                          onClick={() => {
                            if (!user || !socket) return;
                            socket.emit('join_room', {
                              roomCode: room.code,
                              userId: user.id,
                              username: user.username,
                            });
                          }}
                          className="px-3.5 py-2 rounded-xl bg-primary hover:opacity-90 text-[10px] font-black uppercase tracking-wider text-white transition-all active:scale-95"
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

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border-white/5 relative overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-extrabold text-white mb-6">Create Lobbies</h3>
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
                    <option value="CHESS">Chess Strategy</option>
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
                  <label className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">Turn Timer Speed</label>
                  <select 
                    value={turnTimer}
                    onChange={(e) => setTurnTimer(Number(e.target.value))}
                    className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberblue"
                  >
                    <option value={15}>15s (Blitz)</option>
                    <option value={30}>30s (Normal)</option>
                    <option value={60}>60s (Slow)</option>
                  </select>
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
                  className="px-4 py-2 rounded-xl glass-card text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-xl bg-primary hover:opacity-90 text-sm font-bold shadow-neon-blue"
                >
                  Generate Room
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

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm glass-panel rounded-3xl p-6 border-white/5 relative overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-extrabold text-white mb-6">Enter Terminal Code</h3>
            {joinError && (
              <div className="mb-4 p-3 rounded-lg bg-cybererror/10 border border-cybererror/30 text-cybererror text-xs flex gap-2">
                <ShieldAlert size={16} /> <span>{joinError}</span>
              </div>
            )}
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">Room Code</label>
                <input 
                  type="text"
                  required
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="E.g., XYZA12"
                  className="w-full glass-input rounded-xl px-4 py-3 text-center text-lg font-black tracking-widest mt-1 focus:border-cyberblue uppercase"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => { setShowJoinModal(false); setJoinError(''); }} 
                  className="px-4 py-2 rounded-xl glass-card text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-cyberblue hover:opacity-90 text-sm font-bold shadow-neon-blue"
                >
                  Join Lobby
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
