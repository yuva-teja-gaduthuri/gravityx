'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import ThemeToggle from '../../components/ThemeToggle';
import { getApiUrl } from '../../utils/api';
import { useTranslation } from '../../hooks/useTranslation';
import { languages } from '../../utils/translations';
import { 
  Trophy, Coins, LogOut, Settings, ShieldAlert, CheckCircle2,
  Volume2, ArrowLeft, Zap, Shield, Sparkles, User, PlayCircle, BarChart2,
  Heart, Star, MessageSquare, ChevronDown
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

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, refreshProfile, logout } = useAuth(true);
  const { t, currentLanguage, setLanguage: updateAppLanguage } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Profile Edit states
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('astronaut');
  const [editBio, setEditBio] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Consolidate settings states
  const [music, setMusic] = useState(true);
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(80);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState('English');
  const [privacy, setPrivacy] = useState('Public');

  // Stats tab selection
  const [activeStatsTab, setActiveStatsTab] = useState<'ALL' | 'RAMUDU_SEETHA' | 'LUDO'>('ALL');
  
  // Likes and Reviews states
  const [likesCount, setLikesCount] = useState<number>(0);
  const [reviewsList, setReviewsList] = useState<any[]>([]);

  // Profile Statistics
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);

  // Fetch full profile stats
  useEffect(() => {
    if (!user) return;
    setEditUsername(user.username);
    setEditAvatar(user.avatar || 'astronaut');
    setEditBio(user.bio || '');

    // Fetch likes and reviews from real backend API
    const fetchLikesAndReviews = async () => {
      const token = localStorage.getItem('gravityx_token');
      try {
        const likesRes = await fetch(getApiUrl(`/api/social/likes/${user.username}`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (likesRes.ok) {
          const likesData = await likesRes.json();
          setLikesCount(likesData.likesCount);
        }

        const revsRes = await fetch(getApiUrl(`/api/social/reviews/${user.username}`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (revsRes.ok) {
          const revsData = await revsRes.json();
          setReviewsList(revsData);
        }
      } catch (err) {
        console.error('Failed to fetch real likes/reviews:', err);
      }
    };
    fetchLikesAndReviews();

    const fetchStats = async () => {
      const token = localStorage.getItem('gravityx_token');
      try {
        const res = await fetch(getApiUrl('/api/auth/profile'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setInventory(data.inventory || []);
          setAchievements(data.achievements || []);
          setMatchHistory(data.matchHistory || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStats();
  }, [user]);

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
      console.error(e);
    }
  }, []);

  // 3D background animation canvas loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle class
    class Particle {
      x: number;
      y: number;
      z: number;
      size: number;
      color: string;

      constructor() {
        this.x = Math.random() * width - width / 2;
        this.y = Math.random() * height - height / 2;
        this.z = Math.random() * width;
        this.size = 1.5;
        this.color = Math.random() > 0.5 ? '#6C63FF' : '#FF5EDF';
      }

      update() {
        this.z -= 1.5;
        if (this.z <= 0) {
          this.z = width;
          this.x = Math.random() * width - width / 2;
          this.y = Math.random() * height - height / 2;
        }
      }

      draw(c: CanvasRenderingContext2D) {
        const px = (this.x / this.z) * width + width / 2;
        const py = (this.y / this.z) * height + height / 2;
        const size = Math.max(0, (1 - this.z / width) * 4);

        if (px >= 0 && px <= width && py >= 0 && py <= height && size > 0) {
          c.fillStyle = this.color;
          c.beginPath();
          c.arc(px, py, size, 0, Math.PI * 2);
          c.fill();
        }
      }
    }

    const particles: Particle[] = Array.from({ length: 120 }, () => new Particle());

    const renderLoop = () => {
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      ctx.fillStyle = isDark ? 'rgba(5, 8, 22, 0.15)' : 'rgba(250, 250, 255, 0.15)';
      ctx.fillRect(0, 0, width, height);

      particles.forEach((p) => {
        p.update();
        p.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    const token = localStorage.getItem('gravityx_token');
    try {
      localStorage.setItem('gravityx_setting_music', String(music));
      localStorage.setItem('gravityx_setting_sound', String(sound));
      localStorage.setItem('gravityx_setting_volume', String(volume));
      localStorage.setItem('gravityx_setting_notifications', String(notifications));
      localStorage.setItem('gravityx_setting_privacy', privacy);

      const res = await fetch(getApiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ username: editUsername, avatar: editAvatar, bio: editBio })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      localStorage.setItem('gravityx_user', JSON.stringify(data.user));
      window.dispatchEvent(new Event('gravityx_user_updated'));
      refreshProfile();
      setProfileSuccess('Telemetry parameters committed successfully!');
      setIsEditing(false);
      setTimeout(() => {
        setProfileSuccess('');
      }, 2000);
    } catch (err: any) {
      setProfileError(err.message);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[var(--bg-color)] text-[var(--text-color)]">
        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-cyberblue animate-spin mb-4"></div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Opening Identity File...</p>
      </div>
    );
  }

  const nextLevelXp = user.level * 200;
  const xpPercent = Math.round((user.xp / nextLevelXp) * 100);

  // Compute stats based on active stats tab switcher
  const getTabStats = () => {
    if (activeStatsTab === 'ALL') {
      const wins = matchHistory.filter(m => m.placement === 1).length;
      return {
        matchesPlayed: matchHistory.length,
        wins: wins,
        losses: matchHistory.length - wins,
        winRate: matchHistory.length > 0 ? Math.round((wins / matchHistory.length) * 100) : 0
      };
    }
    const filtered = matchHistory.filter(m => m.gameType === activeStatsTab);
    const wins = filtered.filter(m => m.placement === 1).length;
    return {
      matchesPlayed: filtered.length,
      wins: wins,
      losses: filtered.length - wins,
      winRate: filtered.length > 0 ? Math.round((wins / filtered.length) * 100) : 0
    };
  };

  const displayedStats = getTabStats();

  const averageRating = reviewsList.length > 0 
    ? (reviewsList.reduce((acc, r) => acc + r.rating, 0) / reviewsList.length).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] relative overflow-x-hidden flex flex-col font-sans">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0 opacity-45" />

      {/* Top Header */}
      <header className="relative z-10 w-full glass-panel py-5 px-6 md:px-12 flex items-center justify-between border-b border-white/5">
        <button 
          onClick={() => router.push('/dashboard')}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-cyberpink transition-all"
          title="Back to Dashboard"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black uppercase text-cyberpink tracking-wider">identity unit: authenticated</span>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Console Layout */}
      <main className="relative z-10 flex-grow max-w-3xl mx-auto w-full p-6 md:p-8 flex flex-col gap-8 pb-16">
        
        {/* TOP PANEL: Identity Telemetry picker */}
        <div className="glass-panel rounded-3xl p-6 border-white/5 space-y-6 shadow-neon-pink relative overflow-hidden w-full">
          {!isEditing ? (
            // View Profile Card Mode
            <div className="space-y-6 flex-grow flex flex-col justify-between">
              <div className="flex flex-col items-center text-center space-y-4">
                {/* Visual Avatar display */}
                <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-cyberpink/20 to-primary/20 border-2 border-cyberpink flex items-center justify-center text-6xl shadow-neon-pink relative overflow-hidden">
                  <span>{AVATAR_GRAPHICS[editAvatar] || '👽'}</span>
                  <span className="absolute -bottom-1 -right-1 px-3 py-1 rounded-full bg-cyberpink text-xs font-black border-2 border-[var(--bg-color)] shadow-md text-white">
                    {user.level}
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">{user.username}</h2>
                  <p className="text-[10px] uppercase text-slate-500 dark:text-gray-400 font-bold tracking-widest mt-1">Level {user.level} Operator</p>
                  <p className="text-[10px] font-mono text-slate-400 dark:text-gray-500 mt-2 select-all bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5">
                    Player ID: {user.id}
                  </p>
                  {user.bio && (
                    <p className="text-xs text-slate-650 dark:text-gray-300 italic text-center max-w-sm mt-3 px-4 leading-relaxed">
                      "{user.bio}"
                    </p>
                  )}
                  
                  {/* Likes badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full bg-cyberpink/10 border border-cyberpink/30 text-cyberpink text-xs font-black">
                    <Heart size={12} className="fill-cyberpink text-cyberpink animate-pulse" />
                    <span>{likesCount} Likes</span>
                  </div>
                </div>

                {/* XP progress */}
                <div className="w-full">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-gray-400 mb-1">
                    <span>XP PROGRESS</span>
                    <span>{user.xp}/{nextLevelXp} XP</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-white/5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-cyberpink" style={{ width: `${xpPercent}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200 dark:border-white/5 w-full flex">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-cyberpink text-white font-bold text-xs uppercase tracking-wider shadow-neon-pink hover:opacity-90 active:scale-95 transition-all"
                >
                  {t('editProfile', 'Edit Profile')}
                </button>
            </div>
          </div>
        ) : (
          // Edit Profile Mode
          <div className="space-y-6 flex-grow flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white border-b border-slate-200 dark:border-white/5 pb-2 mb-4">
                  {t('editProfile', 'Edit Profile')}
                </h3>
                
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  {profileError && (
                    <div className="p-3 rounded-lg bg-cybererror/10 border border-cybererror/30 text-cybererror text-xs flex gap-2">
                      <ShieldAlert size={16} /> <span>{profileError}</span>
                    </div>
                  )}
                  {profileSuccess && (
                    <div className="p-3 rounded-lg bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess text-xs flex gap-2">
                      <CheckCircle2 size={16} /> <span>{profileSuccess}</span>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-gray-400 tracking-wider">
                      {t('username', 'Change Display Name')}
                    </label>
                    <input 
                      type="text" 
                      required
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberpink text-slate-800 dark:text-white bg-slate-50 dark:bg-white/5"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-gray-400 tracking-wider">
                      {t('bio', 'Bio Description')}
                    </label>
                    <textarea 
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Tell the galaxy about yourself..."
                      rows={3}
                      className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberpink text-slate-800 dark:text-white bg-slate-50 dark:bg-white/5 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-gray-400 tracking-wider">
                      {t('avatar', 'Select Identity Avatar')}
                    </label>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {Object.keys(AVATAR_GRAPHICS).map((av) => (
                        <button
                          key={av}
                          type="button"
                          onClick={() => setEditAvatar(av)}
                          className={`p-2 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                            editAvatar === av 
                              ? 'border-cyberpink bg-cyberpink/10 text-slate-800 dark:text-white shadow-neon-pink' 
                              : 'border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:text-slate-800 hover:dark:text-white hover:border-slate-300 hover:dark:border-white/10'
                          }`}
                        >
                          <span className="text-xl">{AVATAR_GRAPHICS[av]}</span>
                          <span className="text-[8px] uppercase tracking-tighter truncate w-full text-center">{av}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setEditUsername(user.username);
                        setEditAvatar(user.avatar || 'astronaut');
                        setIsEditing(false);
                      }}
                      className="flex-1 py-3 rounded-xl bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white font-bold text-xs uppercase tracking-wider transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-cyberpink text-white font-bold text-xs uppercase tracking-wider shadow-neon-pink hover:opacity-90 active:scale-95 transition-all"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* MIDDLE PANEL: Statistics & Equipped Items */}
        <div className="space-y-6 w-full">
          {/* Stats card */}
          <div className="glass-panel rounded-3xl p-6 border-white/5 space-y-4 shadow-neon-blue">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 dark:border-white/5 pb-3 gap-3">
              <h3 className="text-xs uppercase font-extrabold text-cyberblue tracking-wider flex items-center gap-1.5">
                <BarChart2 size={14} /> Mission Performance
              </h3>
              
              {/* Game TABS */}
              <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setActiveStatsTab('ALL')}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    activeStatsTab === 'ALL' ? 'bg-cyberblue text-white shadow-neon-blue' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  All Games
                </button>
                <button
                  onClick={() => setActiveStatsTab('RAMUDU_SEETHA')}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    activeStatsTab === 'RAMUDU_SEETHA' ? 'bg-cyberblue text-white shadow-neon-blue' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Ramudu Seetha
                </button>
                <button
                  onClick={() => setActiveStatsTab('LUDO')}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    activeStatsTab === 'LUDO' ? 'bg-cyberblue text-white shadow-neon-blue' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Ludo
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex flex-col items-center">
                <span className="text-2xl font-black text-slate-800 dark:text-white">{displayedStats.matchesPlayed}</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-gray-400 mt-1">Matches Played</span>
              </div>
              <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex flex-col items-center">
                <span className="text-2xl font-black text-cybersuccess">{displayedStats.wins}</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-gray-400 mt-1">Victories</span>
              </div>
              <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex flex-col items-center">
                <span className="text-2xl font-black text-cybererror">{displayedStats.losses}</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-gray-400 mt-1">Defeats</span>
              </div>
              <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex flex-col items-center">
                <span className="text-2xl font-black text-cyberblue">{displayedStats.winRate}%</span>
                <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-gray-400 mt-1">Win Ratio</span>
              </div>
            </div>

            {/* Division Rank */}
            <div className="bg-gradient-to-r from-cyberpink/10 to-cyberblue/10 border border-[#FF5EDF]/20 p-4 rounded-2xl flex items-center justify-between w-full mt-4">
              <div className="flex items-center gap-3">
                <Trophy className="text-cybergold" size={20} />
                <span className="text-xs uppercase font-extrabold text-slate-700 dark:text-gray-300">Division Rank</span>
              </div>
              <span className="text-lg font-black text-cybergold">{user.rank}</span>
            </div>
          </div>

          {/* Reviews & Feedback section */}
          <div className="glass-panel rounded-3xl p-6 border-white/5 space-y-4 shadow-neon-blue">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
              <h3 className="text-xs uppercase font-extrabold text-cyberblue tracking-wider flex items-center gap-1.5">
                <MessageSquare size={14} /> Reviews & Feedback
              </h3>
              <span className="text-xs font-black text-cybergold flex items-center gap-1">
                ★ {averageRating} Avg ({reviewsList.length} reviews)
              </span>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {reviewsList.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-gray-400 italic py-2">No reviews recorded yet.</p>
              ) : (
                reviewsList.map((rev, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-white/5 border border-white/5 text-xs space-y-2">
                    <div className="flex justify-between items-center text-[10px] text-gray-400">
                      <span className="font-extrabold text-cyberblue">{rev.reviewerName || rev.username}</span>
                      <span>{rev.date}</span>
                    </div>
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-gray-300 leading-normal">{rev.comment}</p>
                      <span className="text-cybergold text-[10px] whitespace-nowrap">
                        {'★'.repeat(rev.rating)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Equipped Skins / Inventory */}
          <div className="glass-panel rounded-3xl p-6 border-white/5 space-y-4 w-full">
            <h3 className="text-xs uppercase font-extrabold text-cyberpink tracking-wider flex items-center gap-1.5 border-b border-slate-200 dark:border-white/5 pb-2">
              <Zap size={14} /> Equipped Inventory
            </h3>
            {inventory.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-gray-400 italic py-2">No equipped skins found. Purchase telemetry overrides in the store.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {inventory.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex flex-col">
                    <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{item.name}</span>
                    <span className="text-[8px] uppercase font-bold text-cyberpink mt-1">{item.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM PANEL: Settings Panel */}
        <div className="glass-panel rounded-3xl p-6 border-white/5 space-y-6 shadow-neon-blue w-full">
          <h3 className="text-xs uppercase font-extrabold text-cyberblue tracking-wider flex items-center gap-1.5 border-b border-slate-200 dark:border-white/5 pb-2">
            <Volume2 size={14} /> Hardware Parameters
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700 dark:text-gray-300">Ambient Background Music</span>
              <button 
                type="button"
                onClick={() => setMusic(!music)}
                className={`w-10 h-5 rounded-full p-0.5 transition-all ${music ? 'bg-primary' : 'bg-slate-200 dark:bg-white/10'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-all ${music ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </button>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700 dark:text-gray-300">Interactive Game Sound Effects</span>
              <button 
                type="button"
                onClick={() => setSound(!sound)}
                className={`w-10 h-5 rounded-full p-0.5 transition-all ${sound ? 'bg-primary' : 'bg-slate-200 dark:bg-white/10'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-all ${sound ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-gray-400">
                <span>Console Volume</span>
                <span>{volume}%</span>
              </div>
              <input 
                type="range" 
                min={0} 
                max={100}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full h-1 bg-slate-200 dark:bg-white/5 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-gray-400 tracking-wider">
                {t('selectLanguage', 'Language Selection')}
              </label>
              <div className="relative">
                <select
                  value={currentLanguage}
                  onChange={(e) => updateAppLanguage(e.target.value as any)}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-800 dark:text-white rounded-xl px-4 py-2.5 text-xs font-bold focus:border-cyberblue appearance-none outline-none cursor-pointer"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white font-bold">
                      {lang.flag} {lang.label}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-gray-400 tracking-wider">Profile Privacy</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { code: 'Public', label: 'Public', desc: 'Global Boards' },
                  { code: 'Friends', label: 'Friends Only', desc: 'Friends feed' },
                  { code: 'Private', label: 'Private', desc: 'Hidden mode' },
                ].map((priv) => (
                  <button
                    key={priv.code}
                    type="button"
                    onClick={() => setPrivacy(priv.code)}
                    className={`p-2.5 rounded-xl border transition-all flex flex-col items-center justify-center text-center ${
                      privacy === priv.code
                        ? 'border-cyberpink bg-cyberpink/10 text-slate-800 dark:text-white shadow-neon-pink'
                        : 'border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:text-slate-800 hover:dark:text-white hover:border-slate-300 hover:dark:border-white/10'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-tight">{priv.label}</span>
                    <span className="text-[7.5px] text-gray-500 lowercase mt-0.5">{priv.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button 
            onClick={handleUpdateProfile}
            className="w-full py-3 rounded-xl bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300 hover:border-cyberblue transition-all"
          >
            Apply Configurations
          </button>
        </div>

      </main>
    </div>
  );
}
