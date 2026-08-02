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
  UserX,
  Target,
  Sparkles
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

      {/* Player Details Card Modal */}
      {selectedUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all animate-in fade-in duration-200"
          onClick={() => setSelectedUser(null)}
        >
          <div 
            className="w-[92vw] max-w-sm sm:max-w-md glass-panel bg-slate-950/90 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-cyberblue/15 relative overflow-hidden text-white backdrop-blur-xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background Glow Accents */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-cyberblue/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-cyberpink/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header & Close Button */}
            <div className="flex items-center justify-between relative z-10 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cybergold" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Operator Dossier</span>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-gray-400 hover:text-white transition-all"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* User Avatar & Identity Header */}
            <div className="flex flex-col items-center text-center relative z-10 mt-1 mb-4">
              <div className="relative mb-3">
                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-b from-slate-800 to-slate-900 flex items-center justify-center text-3xl font-black uppercase border-2 shadow-xl ${
                  selectedUser.profileFrame === 'neon_glow' ? 'border-cyberblue shadow-neon-blue' : 
                  selectedUser.profileFrame === 'event_horizon' ? 'border-cyberpink shadow-neon-pink' : 'border-cyan-400/40'
                }`}>
                  {selectedUser.username?.[0] || 'U'}
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-900 border border-cyan-500/40 text-cyan-300 shadow-md whitespace-nowrap">
                    {selectedUser.rank || 'Bronze V'}
                  </span>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide mt-1">
                {selectedUser.username}
              </h3>

              {/* Status Badge: Registered vs Guest */}
              <div className="mt-2 flex items-center gap-2">
                {selectedUser.isGuest ? (
                  <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
                    <UserX size={12} /> Guest Operator
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                    <ShieldCheck size={12} /> Registered Pilot
                  </span>
                )}
              </div>

              {/* Player ID (ONLY rendered for registered users, NOT for guests) */}
              {!selectedUser.isGuest && selectedUser.id && (
                <div className="mt-3 w-full px-3.5 py-2 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs font-mono text-cyan-300">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Player ID:</span>
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

            {/* Performance Telemetry Stats Grid */}
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-gray-400 px-1">
                <span>Battle Performance</span>
                <span>Win Rate: {selectedUser.gamesPlayed > 0 ? Math.round(((selectedUser.gamesWon || 0) / selectedUser.gamesPlayed) * 100) : 0}%</span>
              </div>

              {/* Win Rate Progress Bar */}
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden p-0.5 border border-white/5">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-cyberblue via-emerald-400 to-cyberpink transition-all duration-500"
                  style={{
                    width: `${selectedUser.gamesPlayed > 0 ? Math.min(100, Math.round(((selectedUser.gamesWon || 0) / selectedUser.gamesPlayed) * 100)) : 0}%`
                  }}
                ></div>
              </div>

              {/* 3 Stat Cards: Total Played, Won, Lost */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
                {/* Total Games */}
                <div className="p-3 rounded-2xl bg-cyberblue/10 border border-cyberblue/25 flex flex-col items-center justify-center text-center">
                  <Gamepad2 className="w-5 h-5 text-cyberblue mb-1" />
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Total</span>
                  <span className="text-lg sm:text-xl font-black text-white mt-0.5">{selectedUser.gamesPlayed || 0}</span>
                </div>

                {/* Games Won */}
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col items-center justify-center text-center">
                  <Trophy className="w-5 h-5 text-emerald-400 mb-1" />
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Won</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5">{selectedUser.gamesWon || 0}</span>
                </div>

                {/* Games Lost */}
                <div className="p-3 rounded-2xl bg-cyberpink/10 border border-cyberpink/25 flex flex-col items-center justify-center text-center">
                  <Skull className="w-5 h-5 text-cyberpink mb-1" />
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Lost</span>
                  <span className="text-lg sm:text-xl font-black text-cyberpink mt-0.5">{selectedUser.gamesLost || 0}</span>
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
              className="mt-4 w-full py-3 rounded-2xl bg-gradient-to-r from-primary to-cyberblue hover:from-primary/90 hover:to-cyberblue/90 font-black text-xs uppercase tracking-wider text-white shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
            >
              Close Dossier
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

