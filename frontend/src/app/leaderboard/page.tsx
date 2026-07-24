'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { getApiUrl, fetchWithCache } from '../../utils/api';
import { Trophy, ArrowLeft, ShieldAlert, Coins } from 'lucide-react';

export default function LeaderboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth(true);
  
  const [boardType, setBoardType] = useState<'GLOBAL' | 'LUDO' | 'RAMUDU_SEETHA'>('GLOBAL');
  const [rankings, setRankings] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(false);

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

  if (loading || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-cyberblue animate-spin mb-4"></div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Accessing Leaderboard Matrix...</p>
      </div>
    );
  }

  return (
    <div className="flex-grow p-6 md:p-8 max-w-4xl mx-auto w-full space-y-8 overflow-y-auto">
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
            <h2 className="text-3xl font-black text-white mt-0.5">Leaderboards</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/5 shadow-inner">
          <Trophy className="text-cybergold w-5 h-5" />
          <span className="text-sm font-black text-gray-200">Rank: <strong className="text-cyberblue">{user.rank}</strong></span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-cybererror/10 border border-cybererror/30 text-cybererror text-sm flex gap-3">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs list */}
      <div className="flex rounded-2xl glass-panel p-1 border-white/5 max-w-lg">
        {(['GLOBAL', 'LUDO', 'RAMUDU_SEETHA'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setBoardType(tab); }}
            className={`flex-grow py-3 text-xs font-bold rounded-xl uppercase transition-all ${
              boardType === tab ? 'bg-primary shadow-lg text-white font-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'GLOBAL' ? 'Overall XP' : tab === 'LUDO' ? 'Cosmic Ludo' : 'Ramudu-Seetha'}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="glass-panel rounded-3xl p-6 border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-500 font-extrabold">
                <th className="py-4 px-6">Placement</th>
                <th className="py-4 px-6">User</th>
                <th className="py-4 px-6">Rank / Title</th>
                {boardType === 'GLOBAL' ? (
                  <>
                    <th className="py-4 px-6">Level</th>
                    <th className="py-4 px-6 text-right">XP Points</th>
                  </>
                ) : (
                  <>
                    <th className="py-4 px-6">Matches</th>
                    <th className="py-4 px-6 text-right">Aggregated Score</th>
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
                    className={`hover:bg-white/5 transition-all ${usr.id === user.id ? 'bg-white/5 border-l-2 border-cyberpink' : ''}`}
                  >
                    <td className="py-4 px-6 font-black text-sm">
                      {index + 1 === 1 ? '🥇' : index + 1 === 2 ? '🥈' : index + 1 === 3 ? '🥉' : `#${index + 1}`}
                    </td>
                    <td className="py-4 px-6 font-bold flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xs uppercase border ${
                        usr.profileFrame === 'neon_glow' ? 'border-cyberblue shadow-neon-blue' : 
                        usr.profileFrame === 'event_horizon' ? 'border-cyberpink shadow-neon-pink' : 'border-white/10'
                      }`}>
                        {usr.username?.[0] || 'U'}
                      </div>
                      <span>{usr.username}</span>
                    </td>
                    <td className="py-4 px-6 text-xs font-semibold text-gray-400">{usr.rank || 'Bronze V'}</td>
                    {boardType === 'GLOBAL' ? (
                      <>
                        <td className="py-4 px-6 text-cyberblue font-bold">{usr.level}</td>
                        <td className="py-4 px-6 text-right font-bold text-cyberpink">{usr.xp}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-4 px-6 text-cyberblue font-bold">{usr.gamesPlayed || 0}</td>
                        <td className="py-4 px-6 text-right font-bold text-cyberpink">{usr.score || 0}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
