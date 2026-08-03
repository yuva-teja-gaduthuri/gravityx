'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { getApiUrl, fetchWithCache } from '../../utils/api';
import { 
  Trophy, 
  ArrowLeft, 
  ShieldAlert, 
  X, 
  Gamepad2, 
  Swords, 
  Skull, 
  Copy, 
  Check, 
  ShieldCheck, 
  User, 
  UserCheck, 
  UserPlus,
  Clock,
  UserX,
  Target,
  Sparkles,
  Heart,
  MessageSquare
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export default function LeaderboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth(true);
  const { t } = useTranslation();
  
  const [boardType, setBoardType] = useState<'GLOBAL' | 'LUDO' | 'RAMUDU_SEETHA'>('GLOBAL');
  const [rankings, setRankings] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Social interaction state for profile card
  const [socialStatus, setSocialStatus] = useState<{
    likesCount: number;
    isLikedByMe: boolean;
    friendshipStatus: 'SELF' | 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS';
    requestId?: string;
  } | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    if (!user) return;

    const fetchRankings = async () => {
      setFetching(true);
      setError('');
      try {
        let endpoint = '/api/leaderboard';
        if (boardType === 'LUDO') {
          endpoint = '/api/leaderboard?gameType=LUDO';
        } else if (boardType === 'RAMUDU_SEETHA') {
          endpoint = '/api/leaderboard?gameType=RAMUDU_SEETHA';
        }

        const data = await fetchWithCache(endpoint, 60000); // 1-minute cache
        setRankings(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch rankings telemetry.');
      } finally {
        setFetching(false);
      }
    };

    fetchRankings();
  }, [user, boardType]);

  // Fetch target user card status when selected
  useEffect(() => {
    if (!selectedUser || !user) {
      setSocialStatus(null);
      setActionMsg('');
      return;
    }

    const fetchSocialStatus = async () => {
      setSocialLoading(true);
      setActionMsg('');
      try {
        const token = localStorage.getItem('gravityx_token');
        if (!token) return;
        const res = await fetch(getApiUrl(`/api/social/card-status/${selectedUser.username}`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSocialStatus({
            likesCount: data.likesCount ?? (selectedUser.likesCount || 0),
            isLikedByMe: !!data.isLikedByMe,
            friendshipStatus: data.friendshipStatus || 'NONE',
            requestId: data.requestId
          });
        } else {
          setSocialStatus({
            likesCount: selectedUser.likesCount || 0,
            isLikedByMe: false,
            friendshipStatus: selectedUser.id === user.id ? 'SELF' : 'NONE'
          });
        }
      } catch (e) {
        setSocialStatus({
          likesCount: selectedUser.likesCount || 0,
          isLikedByMe: false,
          friendshipStatus: selectedUser.id === user.id ? 'SELF' : 'NONE'
        });
      } finally {
        setSocialLoading(false);
      }
    };

    fetchSocialStatus();
  }, [selectedUser, user]);

  const handleLikeUser = async () => {
    if (!selectedUser || !user || socialLoading) return;
    if (selectedUser.id === user.id || selectedUser.username === user.username) {
      setActionMsg('You cannot like yourself!');
      return;
    }
    const token = localStorage.getItem('gravityx_token');
    if (!token) return;

    try {
      const res = await fetch(getApiUrl('/api/social/like'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetUsername: selectedUser.username })
      });
      if (res.ok) {
        const data = await res.json();
        setSocialStatus(prev => prev ? {
          ...prev,
          likesCount: data.likesCount,
          isLikedByMe: data.isLiked
        } : null);
        setActionMsg(data.isLiked ? 'Liked user profile! ❤️' : 'Unliked profile');
      } else {
        const errData = await res.json();
        setActionMsg(errData.error || 'Failed to update like');
      }
    } catch (e: any) {
      setActionMsg('Error linking with server');
    }
  };

  const handleSendFriendRequest = async () => {
    if (!selectedUser || !user || socialLoading) return;
    const token = localStorage.getItem('gravityx_token');
    if (!token) return;

    try {
      const res = await fetch(getApiUrl('/api/social/request'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ friendUsername: selectedUser.username })
      });
      if (res.ok) {
        setSocialStatus(prev => prev ? { ...prev, friendshipStatus: 'PENDING_SENT' } : null);
        setActionMsg('Friend request sent! 👥');
      } else {
        const errData = await res.json();
        setActionMsg(errData.error || 'Could not send friend request');
      }
    } catch (e: any) {
      setActionMsg('Failed to send friend request');
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!socialStatus?.requestId || socialLoading) return;
    const token = localStorage.getItem('gravityx_token');
    if (!token) return;

    try {
      const res = await fetch(getApiUrl('/api/social/accept'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ requestId: socialStatus.requestId })
      });
      if (res.ok) {
        setSocialStatus(prev => prev ? { ...prev, friendshipStatus: 'FRIENDS' } : null);
        setActionMsg('Friend request accepted! 🎉');
      }
    } catch (e) {
      setActionMsg('Failed to accept request');
    }
  };

  const handleRejectFriendRequest = async () => {
    if (!socialStatus?.requestId || socialLoading) return;
    const token = localStorage.getItem('gravityx_token');
    if (!token) return;

    try {
      const res = await fetch(getApiUrl('/api/social/reject'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ requestId: socialStatus.requestId })
      });
      if (res.ok) {
        setSocialStatus(prev => prev ? { ...prev, friendshipStatus: 'NONE', requestId: undefined } : null);
        setActionMsg('Friend request declined');
      }
    } catch (e) {
      setActionMsg('Failed to reject request');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (loading || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-cyberblue animate-spin mb-4"></div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Accessing Leaderboard Matrix...</p>
      </div>
    );
  }

  return (
    <div className="flex-grow p-3 sm:p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6 sm:space-y-8 overflow-y-auto">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/dashboard')} 
            className="p-2.5 rounded-xl glass-card border-white/10 text-gray-400 hover:text-white hover:border-cyberblue transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className="text-[10px] uppercase font-bold text-cyberpink tracking-wider">galaxy stats console</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-0.5">{t('navLeaderboard', 'Leaderboards')}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-white/5 border border-white/5 shadow-inner">
          <Trophy className="text-cybergold w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-xs sm:text-sm font-black text-gray-200">{t('rank', 'Rank')}: <strong className="text-cyberblue">{user.rank}</strong></span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-cybererror/10 border border-cybererror/30 text-cybererror text-sm flex gap-3">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs list */}
      <div className="flex rounded-2xl glass-panel p-1 border-white/5 max-w-lg w-full">
        {(['GLOBAL', 'LUDO', 'RAMUDU_SEETHA'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setBoardType(tab); }}
            className={`flex-grow py-2.5 px-1.5 sm:py-3 sm:px-3 text-[10px] sm:text-xs font-bold rounded-xl uppercase transition-all ${
              boardType === tab ? 'bg-primary shadow-lg text-white font-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'GLOBAL' ? 'Overall XP' : tab === 'LUDO' ? 'Cosmic Ludo' : 'Ramudu-Seetha'}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="glass-panel rounded-2xl sm:rounded-3xl p-2.5 sm:p-6 border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[9px] sm:text-[10px] uppercase tracking-widest text-gray-500 font-extrabold">
                <th className="py-3 px-1.5 sm:py-4 sm:px-6 w-8 sm:w-auto text-center sm:text-left">#</th>
                <th className="py-3 px-2 sm:py-4 sm:px-6">User</th>
                <th className="py-3 px-2 sm:py-4 sm:px-6 hidden sm:table-cell">Rank / Title</th>
                {boardType === 'GLOBAL' ? (
                  <>
                    <th className="py-3 px-1.5 sm:py-4 sm:px-6 text-center sm:text-left">Lvl</th>
                    <th className="py-3 px-2 sm:py-4 sm:px-6 text-right">XP</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-1.5 sm:py-4 sm:px-6 text-center sm:text-left">Matches</th>
                    <th className="py-3 px-2 sm:py-4 sm:px-6 text-right">Score</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-200">
              {fetching ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-gray-500 font-bold uppercase animate-pulse">
                    Syncing rankings data...
                  </td>
                </tr>
              ) : rankings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-gray-500 font-bold uppercase">
                    No operator records found in this board tab.
                  </td>
                </tr>
              ) : (
                rankings.map((usr, index) => (
                  <tr 
                    key={usr.id || index} 
                    onClick={() => setSelectedUser(usr)}
                    className={`hover:bg-white/10 cursor-pointer select-none transition-all duration-200 active:scale-[0.99] ${
                      usr.id === user.id ? 'bg-white/5 border-l-2 border-cyberpink' : ''
                    }`}
                    title="Click to view operator details"
                  >
                    <td className="py-3 px-1.5 sm:py-4 sm:px-6 font-black text-xs sm:text-sm text-center sm:text-left">
                      {index + 1 === 1 ? '🥇' : index + 1 === 2 ? '🥈' : index + 1 === 3 ? '🥉' : `#${index + 1}`}
                    </td>
                    <td className="py-3 px-2 sm:py-4 sm:px-6 font-bold">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-[10px] sm:text-xs uppercase border flex-shrink-0 ${
                          usr.profileFrame === 'neon_glow' ? 'border-cyberblue shadow-neon-blue' : 
                          usr.profileFrame === 'event_horizon' ? 'border-cyberpink shadow-neon-pink' : 'border-white/10'
                        }`}>
                          {usr.username?.[0] || 'U'}
                        </div>
                        <div className="min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[70px] xs:max-w-[110px] sm:max-w-none text-xs sm:text-sm block text-white group-hover:text-cyberblue transition-colors">
                              {usr.username}
                            </span>
                            {usr.isGuest && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Guest
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] font-semibold text-gray-400 block sm:hidden truncate">{usr.rank || 'Bronze V'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 sm:py-4 sm:px-6 text-xs font-semibold text-gray-400 hidden sm:table-cell">{usr.rank || 'Bronze V'}</td>
                    {boardType === 'GLOBAL' ? (
                      <>
                        <td className="py-3 px-1.5 sm:py-4 sm:px-6 text-cyberblue font-bold text-xs sm:text-sm text-center sm:text-left">{usr.level}</td>
                        <td className="py-3 px-2 sm:py-4 sm:px-6 text-right font-bold text-cyberpink text-xs sm:text-sm">{usr.xp}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-1.5 sm:py-4 sm:px-6 text-cyberblue font-bold text-xs sm:text-sm text-center sm:text-left">{usr.gamesPlayed || 0}</td>
                        <td className="py-3 px-2 sm:py-4 sm:px-6 text-right font-bold text-cyberpink text-xs sm:text-sm">{usr.score || 0}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Player Details Card Modal - Redesigned UI */}
      {selectedUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl transition-all animate-in fade-in duration-300"
          onClick={() => setSelectedUser(null)}
        >
          <div 
            className="w-[94vw] max-w-sm sm:max-w-md bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-slate-950 border border-cyan-500/30 rounded-3xl p-5 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.2)] relative overflow-hidden text-white backdrop-blur-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Background Glow Orbs */}
            <div className="absolute -top-20 -right-20 w-44 h-44 bg-cyberblue/25 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
            <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-cyberpink/25 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header & Close Button */}
            <div className="flex items-center justify-between relative z-10 mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyberblue/10 border border-cyberblue/30 text-cyberblue">
                  <Sparkles className="w-4 h-4 text-cybergold" />
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-cyberblue block">Galaxy Matrix Dossier</span>
                  <span className="text-xs font-bold text-gray-300">Operator Specification</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-gray-400 hover:text-white transition-all active:scale-95"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Avatar & Operator Identity Card */}
            <div className="flex flex-col items-center text-center relative z-10 mb-4">
              <div className="relative mb-3 group">
                <div className={`w-22 h-22 sm:w-26 sm:h-26 rounded-3xl bg-gradient-to-b from-slate-800 via-slate-900 to-black flex items-center justify-center text-3xl sm:text-4xl font-black uppercase border-2 shadow-2xl transition-transform duration-300 group-hover:scale-105 ${
                  selectedUser.profileFrame === 'neon_glow' ? 'border-cyberblue shadow-[0_0_25px_rgba(6,182,212,0.5)]' : 
                  selectedUser.profileFrame === 'event_horizon' ? 'border-cyberpink shadow-[0_0_25px_rgba(236,72,153,0.5)]' : 'border-cyan-400/40 shadow-cyan-900/30'
                }`}>
                  <span className="bg-gradient-to-b from-white via-cyan-200 to-cyberblue bg-clip-text text-transparent">
                    {selectedUser.username?.[0] || 'U'}
                  </span>
                </div>

                {/* Rank Badge Floating Overlay */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 shadow-lg">
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-slate-950 border border-cyan-400/50 text-cyan-300 tracking-wider shadow-md whitespace-nowrap flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-cybergold" />
                    {selectedUser.rank || 'Bronze V'}
                  </span>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide mt-2">
                {selectedUser.username}
              </h3>

              {/* Status Badge */}
              <div className="mt-2 flex items-center justify-center gap-2">
                {selectedUser.isGuest ? (
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                    <UserX size={12} /> Guest Operator
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                    <ShieldCheck size={12} /> Verified Commander
                  </span>
                )}
              </div>

              {/* Player ID Bar */}
              {!selectedUser.isGuest && selectedUser.id && (
                <div className="mt-3 w-full px-3.5 py-2 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs font-mono text-cyan-300">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">ID:</span>
                    <span className="truncate max-w-[170px] xs:max-w-[210px] font-bold text-white">{selectedUser.id}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedUser.id)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition-all flex-shrink-0"
                    title="Copy Player ID"
                  >
                    {copiedId ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              )}
            </div>

            {/* Social Actions Row (LIKE & FRIEND REQUEST) */}
            <div className="relative z-10 mb-4 p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="grid grid-cols-2 gap-2.5">
                {/* LIKE USER BUTTON */}
                <button
                  onClick={handleLikeUser}
                  disabled={socialStatus?.friendshipStatus === 'SELF' || socialLoading}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 ${
                    socialStatus?.isLikedByMe
                      ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                      : 'bg-white/5 border border-white/10 hover:border-rose-400/40 text-gray-300 hover:text-rose-400'
                  } ${socialStatus?.friendshipStatus === 'SELF' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Heart className={`w-4 h-4 transition-transform duration-300 ${socialStatus?.isLikedByMe ? 'fill-rose-500 text-rose-500 scale-110' : ''}`} />
                  <span>
                    {socialStatus?.isLikedByMe ? 'Liked' : 'Like'} ({socialStatus?.likesCount ?? selectedUser.likesCount ?? 0})
                  </span>
                </button>

                {/* FRIEND REQUEST / STATUS BUTTON */}
                {socialStatus?.friendshipStatus === 'SELF' ? (
                  <div className="w-full py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-bold flex items-center justify-center gap-1.5">
                    <User size={14} /> That's You
                  </div>
                ) : socialStatus?.friendshipStatus === 'FRIENDS' ? (
                  <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center justify-center gap-1.5 shadow-sm">
                    <UserCheck size={14} /> Friends ✓
                  </div>
                ) : socialStatus?.friendshipStatus === 'PENDING_SENT' ? (
                  <div className="w-full py-2.5 px-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5">
                    <Clock size={14} /> Request Sent
                  </div>
                ) : socialStatus?.friendshipStatus === 'PENDING_RECEIVED' ? (
                  <div className="flex gap-1.5 w-full">
                    <button
                      onClick={handleAcceptFriendRequest}
                      className="flex-1 py-2 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1 shadow-sm transition-all"
                    >
                      <Check size={13} /> Accept
                    </button>
                    <button
                      onClick={handleRejectFriendRequest}
                      className="py-2 px-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[11px] font-bold flex items-center justify-center transition-all hover:bg-rose-500/30"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSendFriendRequest}
                    disabled={socialLoading}
                    className="w-full py-2.5 px-3 rounded-xl bg-cyberblue hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all active:scale-95"
                  >
                    <UserPlus size={14} /> Add Friend
                  </button>
                )}
              </div>

              {/* Action Message Feedback */}
              {actionMsg && (
                <p className="text-[11px] font-black text-center text-cyberpink animate-pulse mt-1">
                  {actionMsg}
                </p>
              )}
            </div>

            {/* Performance Telemetry Grid */}
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-gray-400 px-1">
                <span>Battle Performance</span>
                <span>Win Rate: {selectedUser.gamesPlayed > 0 ? Math.round(((selectedUser.gamesWon || 0) / selectedUser.gamesPlayed) * 100) : 0}%</span>
              </div>

              {/* Win Rate Bar */}
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden p-0.5 border border-white/5">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-cyberblue via-emerald-400 to-cyberpink transition-all duration-500"
                  style={{
                    width: `${selectedUser.gamesPlayed > 0 ? Math.min(100, Math.round(((selectedUser.gamesWon || 0) / selectedUser.gamesPlayed) * 100)) : 0}%`
                  }}
                ></div>
              </div>

              {/* 3 Stat Cards */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-3 rounded-2xl bg-cyberblue/10 border border-cyberblue/25 flex flex-col items-center justify-center text-center">
                  <Gamepad2 className="w-5 h-5 text-cyberblue mb-1" />
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Total</span>
                  <span className="text-lg font-black text-white mt-0.5">{selectedUser.gamesPlayed || 0}</span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col items-center justify-center text-center">
                  <Trophy className="w-5 h-5 text-emerald-400 mb-1" />
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Won</span>
                  <span className="text-lg font-black text-emerald-400 mt-0.5">{selectedUser.gamesWon || 0}</span>
                </div>

                <div className="p-3 rounded-2xl bg-cyberpink/10 border border-cyberpink/25 flex flex-col items-center justify-center text-center">
                  <Skull className="w-5 h-5 text-cyberpink mb-1" />
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Lost</span>
                  <span className="text-lg font-black text-cyberpink mt-0.5">{selectedUser.gamesLost || 0}</span>
                </div>
              </div>
            </div>

            {/* Level & XP Footer Bar */}
            <div className="relative z-10 mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-gray-300">
              <span className="text-gray-400">Level: <strong className="text-cyberblue">{selectedUser.level || 1}</strong></span>
              <span className="text-gray-400">Total XP: <strong className="text-cyberpink">{selectedUser.xp || 0}</strong></span>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setSelectedUser(null)}
              className="mt-4 w-full py-3 rounded-2xl bg-gradient-to-r from-primary via-indigo-600 to-cyberblue hover:from-primary/90 hover:to-cyberblue/90 font-black text-xs uppercase tracking-wider text-white shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
            >
              Close Dossier
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

