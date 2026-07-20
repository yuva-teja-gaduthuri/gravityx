'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { getApiUrl } from '../../utils/api';
import { ArrowLeft, Users, ShieldAlert, BarChart3, Database, Coins, RefreshCw } from 'lucide-react';

interface SystemStats {
  users: { total: number; guests: number; banned: number; registered: number };
  matches: { total: number; ludo: number; ramuduSeetha: number };
  economy: { totalCoinsCirculating: number; averageCoinsPerUser: number };
}

interface UserRow {
  id: string;
  username: string;
  email?: string;
  isGuest: boolean;
  isBanned: boolean;
  role: 'USER' | 'ADMIN';
  coins: number;
  xp: number;
  level: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth(true);

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAdminData = async () => {
    setError('');
    setRefreshing(true);
    const token = localStorage.getItem('gravityx_token');

    try {
      // Fetch stats
      const res1 = await fetch(getApiUrl('/api/admin/stats'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res1.ok) throw new Error('Failed to retrieve system analytics');
      const statsData = await res1.json();
      setStats(statsData);

      // Fetch users list
      const res2 = await fetch(getApiUrl('/api/admin/users'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res2.ok) throw new Error('Failed to retrieve user listing');
      const usersData = await res2.json();
      setUsers(usersData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      if (user.role !== 'ADMIN') {
        alert('Admin access credentials required.');
        router.push('/dashboard');
      } else {
        fetchAdminData();
      }
    }
  }, [user, router]);

  const handleBanToggle = async (userId: string, isBanned: boolean) => {
    setError('');
    setSuccess('');
    const token = localStorage.getItem('gravityx_token');
    const endpoint = isBanned ? 'unban' : 'ban';

    try {
      const res = await fetch(getApiUrl(`/api/admin/${endpoint}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply moderation check');

      setSuccess(`User moderation status updated to: ${isBanned ? 'Active' : 'Banned'}`);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading || !user || user.role !== 'ADMIN') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-cyberblue animate-spin mb-4"></div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-black">Calibrating Admin credentials...</p>
      </div>
    );
  }

  return (
    <div className="flex-grow p-6 md:p-8 max-w-6xl mx-auto w-full space-y-8 overflow-y-auto">
      {/* Header controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/dashboard')} 
            className="p-2.5 rounded-xl glass-card border-white/10 text-gray-400 hover:text-white hover:border-cyberblue transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className="text-[10px] uppercase font-bold text-cyberpink tracking-wider">central command node</span>
            <h2 className="text-3xl font-black text-white mt-0.5">Admin Arena Control</h2>
          </div>
        </div>

        <button 
          onClick={fetchAdminData}
          disabled={refreshing}
          className="p-3 rounded-xl glass-card border-white/10 hover:border-cyberpink text-gray-400 hover:text-white transition-all flex gap-2 items-center text-xs font-bold"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Sync Systems
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-cybererror/10 border border-cybererror/30 text-cybererror text-sm flex gap-3">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess text-sm">
          {success}
        </div>
      )}

      {/* Analytics Summary Panels */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="glass-panel rounded-2xl p-5 border-white/5 space-y-3">
            <h4 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider flex items-center gap-2">
              <Users size={16} className="text-cyberblue" /> Users Population
            </h4>
            <div className="flex justify-between items-baseline pt-2">
              <span className="text-3xl font-black">{stats.users.total}</span>
              <span className="text-xs text-gray-500 font-semibold">Registered: {stats.users.registered}</span>
            </div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Guests: {stats.users.guests} &bull; Banned: {stats.users.banned}</div>
          </div>

          <div className="glass-panel rounded-2xl p-5 border-white/5 space-y-3">
            <h4 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider flex items-center gap-2">
              <BarChart3 size={16} className="text-cyberpink" /> Arena Matches
            </h4>
            <div className="flex justify-between items-baseline pt-2">
              <span className="text-3xl font-black">{stats.matches.total}</span>
              <span className="text-xs text-gray-500 font-semibold">Ludo: {stats.matches.ludo}</span>
            </div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ramudu-Seetha Lobbies: {stats.matches.ramuduSeetha}</div>
          </div>

          <div className="glass-panel rounded-2xl p-5 border-white/5 space-y-3">
            <h4 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider flex items-center gap-2">
              <Coins size={16} className="text-cybergold" /> Coin Ledger
            </h4>
            <div className="flex justify-between items-baseline pt-2">
              <span className="text-3xl font-black">{stats.economy.totalCoinsCirculating}</span>
              <span className="text-xs text-gray-500 font-semibold">Average: {stats.economy.averageCoinsPerUser} 🪙</span>
            </div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Dynamic Token Distribution</div>
          </div>
        </div>
      )}

      {/* Users management table */}
      <div className="space-y-4">
        <h3 className="text-xs uppercase font-extrabold tracking-widest text-gray-400 flex items-center gap-2">
          <Database size={16} /> User Databases
        </h3>

        <div className="glass-card rounded-2xl border-white/5 overflow-hidden">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-500 font-extrabold">
                <th className="py-4 px-6">Username</th>
                <th className="py-4 px-6">Email / Guest</th>
                <th className="py-4 px-6">Level</th>
                <th className="py-4 px-6">Coins</th>
                <th className="py-4 px-6">Role</th>
                <th className="py-4 px-6 text-right">Moderation action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-gray-500">No database users found.</td>
                </tr>
              ) : (
                users.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5 transition-all">
                    <td className="py-4 px-6 font-bold flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xs border border-white/10 uppercase">
                        {row.username[0]}
                      </div>
                      <div className="flex flex-col">
                        <span>{row.username}</span>
                        {row.isBanned && (
                          <span className="text-[8px] font-black text-cybererror uppercase tracking-wider mt-0.5">Banned</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-xs text-gray-400">
                      {row.isGuest ? (
                        <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[9px] font-bold text-gray-500 uppercase">Guest</span>
                      ) : (
                        row.email
                      )}
                    </td>
                    <td className="py-4 px-6 text-cyberblue font-bold">Lvl {row.level}</td>
                    <td className="py-4 px-6 text-cybergold font-bold">{row.coins} 🪙</td>
                    <td className="py-4 px-6">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${
                        row.role === 'ADMIN' ? 'bg-cyberpink/20 text-cyberpink border border-cyberpink/30' : 'bg-white/5 text-gray-400'
                      }`}>
                        {row.role}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {row.role !== 'ADMIN' && (
                        <button
                          onClick={() => handleBanToggle(row.id, row.isBanned)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            row.isBanned 
                              ? 'bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess hover:bg-cybersuccess hover:text-white' 
                              : 'bg-cybererror/10 border border-cybererror/30 text-cybererror hover:bg-cybererror hover:text-white'
                          }`}
                        >
                          {row.isBanned ? 'Unban Player' : 'Ban Player'}
                        </button>
                      )}
                    </td>
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
