'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { getApiUrl } from '../../utils/api';
import { ArrowLeft, Users, ShieldAlert, BarChart3, Database, Coins, RefreshCw, Trash2, Edit3, Award, MessageSquare } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

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
  rank?: string;
}

interface UserReviewRow {
  id: string;
  targetUsername: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface FeedbackRow {
  id: string;
  game: string;
  username: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface DivisionRankRow {
  id: string;
  minLevel: number;
  name: string;
  badgeIcon: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth(true);
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'users' | 'moderation' | 'ranks' | 'analytics'>('users');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [reviews, setReviews] = useState<UserReviewRow[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [divisionRanks, setDivisionRanks] = useState<DivisionRankRow[]>([]);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Edit user state modal
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editCoins, setEditCoins] = useState(0);
  const [editLevel, setEditLevel] = useState(1);
  const [editXp, setEditXp] = useState(0);
  const [editRole, setEditRole] = useState<'USER' | 'ADMIN'>('USER');

  // Edit rank state modal
  const [editingRankMinLevel, setEditingRankMinLevel] = useState(1);
  const [editingRankName, setEditingRankName] = useState('');
  const [editingRankBadge, setEditingRankBadge] = useState('bronze_badge');

  const fetchAdminData = async () => {
    setError('');
    setRefreshing(true);
    const token = localStorage.getItem('gravityx_token');

    try {
      // Fetch stats
      const res1 = await fetch(getApiUrl('/api/admin/stats'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res1.ok) setStats(await res1.json());

      // Fetch users
      const res2 = await fetch(getApiUrl('/api/admin/users'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res2.ok) setUsers(await res2.json());

      // Fetch reviews moderation
      const res3 = await fetch(getApiUrl('/api/admin/reviews'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res3.ok) setReviews(await res3.json());

      // Fetch feedback moderation
      const res4 = await fetch(getApiUrl('/api/admin/feedback'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res4.ok) setFeedbacks(await res4.json());

      // Fetch division ranks
      const res5 = await fetch(getApiUrl('/api/admin/ranks'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res5.ok) setDivisionRanks(await res5.json());

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
      if (!res.ok) throw new Error('Failed to toggle ban status');
      setSuccess(`User moderation status updated.`);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateUserSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const token = localStorage.getItem('gravityx_token');
    try {
      const res = await fetch(getApiUrl('/api/admin/user/update'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: editingUser.id,
          coins: editCoins,
          level: editLevel,
          xp: editXp,
          role: editRole,
        }),
      });
      if (!res.ok) throw new Error('Failed to update user profile');
      setSuccess('User updated successfully');
      setEditingUser(null);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to permanently delete this user from the database?')) return;
    const token = localStorage.getItem('gravityx_token');
    try {
      const res = await fetch(getApiUrl('/api/admin/user/delete'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('Failed to delete user');
      setSuccess('User deleted from database');
      fetchAdminData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteReview = async (id: string) => {
    const token = localStorage.getItem('gravityx_token');
    try {
      await fetch(getApiUrl(`/api/admin/reviews/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess('Review deleted from database');
      fetchAdminData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    const token = localStorage.getItem('gravityx_token');
    try {
      await fetch(getApiUrl(`/api/admin/feedback/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess('Feedback deleted from database');
      fetchAdminData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveRank = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('gravityx_token');
    try {
      const res = await fetch(getApiUrl('/api/admin/ranks'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          minLevel: editingRankMinLevel,
          name: editingRankName,
          badgeIcon: editingRankBadge,
        }),
      });
      if (!res.ok) throw new Error('Failed to save division rank');
      setSuccess('Division rank saved to database');
      setEditingRankName('');
      fetchAdminData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteRank = async (id: string) => {
    const token = localStorage.getItem('gravityx_token');
    try {
      await fetch(getApiUrl(`/api/admin/ranks/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess('Division rank deleted');
      fetchAdminData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading || !user || user.role !== 'ADMIN') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-cyberblue animate-spin mb-4"></div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-black">Decrypting Super Admin Console...</p>
      </div>
    );
  }

  return (
    <div className="flex-grow p-6 md:p-8 max-w-6xl mx-auto w-full space-y-8 overflow-y-auto">
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
            <span className="text-[10px] uppercase font-bold text-cyberpink tracking-wider">Super Admin Host Command</span>
            <h2 className="text-3xl font-black text-white mt-0.5">GravityX Control Node</h2>
          </div>
        </div>

        <button 
          onClick={fetchAdminData}
          disabled={refreshing}
          className="p-3 rounded-xl glass-card border-white/10 hover:border-cyberpink text-gray-400 hover:text-white transition-all flex gap-2 items-center text-xs font-bold"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Sync Database
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-cybererror/10 border border-cybererror/30 text-cybererror text-sm flex gap-3">
          <ShieldAlert size={18} /> <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess text-sm">
          {success}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/5 gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'users' ? 'bg-primary text-white shadow-neon-blue' : 'glass-card text-gray-400 hover:text-white'
          }`}
        >
          <Users size={16} /> User Database ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('moderation')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'moderation' ? 'bg-cyberpink text-white shadow-neon-pink' : 'glass-card text-gray-400 hover:text-white'
          }`}
        >
          <MessageSquare size={16} /> Content Moderation ({reviews.length + feedbacks.length})
        </button>
        <button
          onClick={() => setActiveTab('ranks')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'ranks' ? 'bg-cybergold text-black font-black shadow-neon-gold' : 'glass-card text-gray-400 hover:text-white'
          }`}
        >
          <Award size={16} /> Division Ranks ({divisionRanks.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'analytics' ? 'bg-cyberblue text-white shadow-neon-blue' : 'glass-card text-gray-400 hover:text-white'
          }`}
        >
          <BarChart3 size={16} /> System Telemetry
        </button>
      </div>

      {/* TAB 1: User Database */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl border-white/5 overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-500 font-extrabold">
                  <th className="py-4 px-6">User / Email</th>
                  <th className="py-4 px-6">Level / XP</th>
                  <th className="py-4 px-6">Coins</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Banned</th>
                  <th className="py-4 px-6 text-right">Super Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-200">
                {users.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5 transition-all">
                    <td className="py-4 px-6 font-bold flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xs border border-white/10 uppercase">
                        {row.username[0]}
                      </div>
                      <div className="flex flex-col">
                        <span>{row.username}</span>
                        <span className="text-[10px] text-gray-500">{row.isGuest ? 'Guest Account' : row.email}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-cyberblue font-bold">
                      Lvl {row.level} <span className="text-[10px] text-gray-500">({row.xp} XP)</span>
                    </td>
                    <td className="py-4 px-6 text-cybergold font-bold">{row.coins} 🪙</td>
                    <td className="py-4 px-6">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${
                        row.role === 'ADMIN' ? 'bg-cyberpink/20 text-cyberpink border border-cyberpink/30' : 'bg-white/5 text-gray-400'
                      }`}>
                        {row.role}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {row.isBanned ? (
                        <span className="text-[10px] text-cybererror font-black uppercase">Yes</span>
                      ) : (
                        <span className="text-[10px] text-cybersuccess font-black uppercase">No</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingUser(row);
                          setEditCoins(row.coins);
                          setEditLevel(row.level);
                          setEditXp(row.xp);
                          setEditRole(row.role);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <Edit3 size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handleBanToggle(row.id, row.isBanned)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          row.isBanned ? 'bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess' : 'bg-cybererror/10 border border-cybererror/30 text-cybererror'
                        }`}
                      >
                        {row.isBanned ? 'Unban' : 'Ban'}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(row.id)}
                        className="p-1.5 rounded-xl bg-cybererror/20 text-cybererror border border-cybererror/30 hover:bg-cybererror hover:text-white transition-all"
                        title="Delete User"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Content Moderation */}
      {activeTab === 'moderation' && (
        <div className="space-y-8">
          {/* User Reviews */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase font-extrabold tracking-widest text-cyberpink">Player Profile Reviews ({reviews.length})</h3>
            <div className="glass-card rounded-2xl border-white/5 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase text-gray-500 font-extrabold">
                    <th className="py-3 px-4">Target User</th>
                    <th className="py-3 px-4">Reviewer</th>
                    <th className="py-3 px-4">Rating</th>
                    <th className="py-3 px-4">Comment</th>
                    <th className="py-3 px-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reviews.length === 0 ? (
                    <tr><td colSpan={5} className="py-4 text-center text-gray-500">No user reviews in database.</td></tr>
                  ) : (
                    reviews.map((r) => (
                      <tr key={r.id} className="hover:bg-white/5">
                        <td className="py-3 px-4 font-bold text-white">{r.targetUsername}</td>
                        <td className="py-3 px-4 text-gray-400">{r.reviewerName}</td>
                        <td className="py-3 px-4 text-cybergold font-bold">{'★'.repeat(r.rating)}</td>
                        <td className="py-3 px-4 text-gray-300">{r.comment}</td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => handleDeleteReview(r.id)} className="p-1.5 rounded-lg bg-cybererror/20 text-cybererror hover:bg-cybererror hover:text-white">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Game Feedback */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase font-extrabold tracking-widest text-cyberblue">Game Feedback Logs ({feedbacks.length})</h3>
            <div className="glass-card rounded-2xl border-white/5 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase text-gray-500 font-extrabold">
                    <th className="py-3 px-4">Game</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Rating</th>
                    <th className="py-3 px-4">Comment</th>
                    <th className="py-3 px-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {feedbacks.length === 0 ? (
                    <tr><td colSpan={5} className="py-4 text-center text-gray-500">No game feedback logs in database.</td></tr>
                  ) : (
                    feedbacks.map((f) => (
                      <tr key={f.id} className="hover:bg-white/5">
                        <td className="py-3 px-4 font-bold text-cyberblue">{f.game}</td>
                        <td className="py-3 px-4 text-gray-400">{f.username}</td>
                        <td className="py-3 px-4 text-cybergold font-bold">{'★'.repeat(f.rating)}</td>
                        <td className="py-3 px-4 text-gray-300">{f.comment}</td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => handleDeleteFeedback(f.id)} className="p-1.5 rounded-lg bg-cybererror/20 text-cybererror hover:bg-cybererror hover:text-white">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Division Ranks Configuration */}
      {activeTab === 'ranks' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveRank} className="glass-panel p-5 rounded-2xl border-white/5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400">Min Level</label>
              <input
                type="number"
                required
                value={editingRankMinLevel}
                onChange={(e) => setEditingRankMinLevel(Number(e.target.value))}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm mt-1 focus:border-cybergold"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400">Rank Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Conqueror"
                value={editingRankName}
                onChange={(e) => setEditingRankName(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm mt-1 focus:border-cybergold"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400">Badge Icon</label>
              <input
                type="text"
                value={editingRankBadge}
                onChange={(e) => setEditingRankBadge(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm mt-1 focus:border-cybergold"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-cybergold text-black font-black uppercase text-xs hover:opacity-90 transition-all">
              Save Rank Entry
            </button>
          </form>

          <div className="glass-card rounded-2xl border-white/5 overflow-hidden">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase text-gray-500 font-extrabold">
                  <th className="py-4 px-6">Min Level</th>
                  <th className="py-4 px-6">Division Rank Name</th>
                  <th className="py-4 px-6">Badge Icon</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {divisionRanks.map((rk) => (
                  <tr key={rk.id} className="hover:bg-white/5">
                    <td className="py-4 px-6 font-bold text-cyberblue">Level {rk.minLevel}+</td>
                    <td className="py-4 px-6 font-extrabold text-white">{rk.name}</td>
                    <td className="py-4 px-6 text-xs text-gray-400">{rk.badgeIcon}</td>
                    <td className="py-4 px-6 text-right">
                      <button onClick={() => handleDeleteRank(rk.id)} className="p-2 rounded-xl bg-cybererror/20 text-cybererror hover:bg-cybererror hover:text-white">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Analytics */}
      {activeTab === 'analytics' && stats && (
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
              <span className="text-xs text-gray-500 font-semibold">Cosmic Ludo: {stats.matches.ludo}</span>
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

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border-white/10 space-y-4">
            <h3 className="text-xl font-extrabold text-white">Edit User: {editingUser.username}</h3>
            <form onSubmit={handleUpdateUserSave} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-extrabold text-gray-400">Coins Balance</label>
                <input
                  type="number"
                  value={editCoins}
                  onChange={(e) => setEditCoins(Number(e.target.value))}
                  className="w-full glass-input rounded-xl px-4 py-2 text-sm mt-1 focus:border-cybergold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-extrabold text-gray-400">Level</label>
                  <input
                    type="number"
                    value={editLevel}
                    onChange={(e) => setEditLevel(Number(e.target.value))}
                    className="w-full glass-input rounded-xl px-4 py-2 text-sm mt-1 focus:border-cyberblue"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-extrabold text-gray-400">XP</label>
                  <input
                    type="number"
                    value={editXp}
                    onChange={(e) => setEditXp(Number(e.target.value))}
                    className="w-full glass-input rounded-xl px-4 py-2 text-sm mt-1 focus:border-cyberblue"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-extrabold text-gray-400">System Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full glass-input rounded-xl px-4 py-2 text-sm mt-1 focus:border-cyberpink"
                >
                  <option value="USER" className="bg-darkbg text-white">USER</option>
                  <option value="ADMIN" className="bg-darkbg text-white">ADMIN (Super Admin)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-xs uppercase shadow-neon-blue">
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditingUser(null)} className="px-5 py-3 rounded-xl glass-card text-gray-400 text-xs font-bold">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
