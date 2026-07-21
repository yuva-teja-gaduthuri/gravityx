'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import SocialDrawer from '../../components/SocialDrawer';
import { getApiUrl, fetchWithCache } from '../../utils/api';
import { 
  Trophy, Coins, LogOut, Settings, ShoppingBag, 
  Plus, Users, Flame, PlusCircle, HelpCircle, Gamepad2, ShieldAlert
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const socket = useSocket();
  const { user, stats, refreshProfile, logout, loading } = useAuth(true);

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<'global' | 'friends'>('global');
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Form states
  const [roomName, setRoomName] = useState('');
  const [selectedGame, setSelectedGame] = useState<'RAMUDU_SEETHA' | 'LUDO'>('RAMUDU_SEETHA');
  const [roomType, setRoomType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [voiceChat, setVoiceChat] = useState(false);
  const [allowSpectators, setAllowSpectators] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [createError, setCreateError] = useState('');

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
    if (!user) return;

    socket.emit('create_room', {
      userId: user.id,
      username: user.username,
      name: roomName || `${user.username}'s Lobby`,
      gameType: selectedGame,
      type: roomType,
      maxPlayers: Number(maxPlayers),
      voiceChat,
      allowSpectators,
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    if (!user || !joinCode.trim()) return;

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

  return (
    <div className="flex flex-col flex-grow">
      {/* Top Header Navigation */}
      <nav className="w-full glass-panel py-4 px-6 md:px-12 flex flex-col sm:flex-row items-center justify-between border-b border-white/5 gap-4">
        {/* Profile Card */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {/* Custom Equipped Frame Outline */}
            <div className={`w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center border-2 ${
              user.profileFrame === 'neon_glow' ? 'border-cyberblue shadow-neon-blue' : 
              user.profileFrame === 'event_horizon' ? 'border-cyberpink shadow-neon-pink' : 'border-white/10'
            }`}>
              <div className="w-11 h-11 rounded-full bg-darkbg flex items-center justify-center font-bold text-lg uppercase text-cyberblue">
                {user.username[0]}
              </div>
            </div>
            <span className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-primary text-[10px] font-black border border-darkbg">
              {user.level}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-extrabold text-lg text-white flex items-center gap-2">
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

        {/* Action Widgets */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 shadow-inner">
            <Coins size={16} className="text-cybergold" />
            <span className="text-sm font-black text-cybergold">{user.coins}</span>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/store')} 
              className="p-3 rounded-xl glass-card border-white/10 text-gray-400 hover:text-white hover:border-cyberblue transition-all"
              title="Store"
            >
              <ShoppingBag size={18} />
            </button>
            <button 
              onClick={() => router.push('/settings')} 
              className="p-3 rounded-xl glass-card border-white/10 text-gray-400 hover:text-white hover:border-cyberpink transition-all"
              title="Settings"
            >
              <Settings size={18} />
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
              onClick={logout} 
              className="p-3 rounded-xl glass-card border-white/10 text-cybererror hover:bg-cybererror/10 transition-all"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

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
                  <h4 className="font-bold text-base">Create Room</h4>
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
                  <h4 className="font-bold text-base">Join Room</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Enter code to join friends</p>
                </div>
              </div>
            </button>

            <div className="glass-card rounded-2xl p-5 border-white/5 flex items-center justify-between group hover:border-cybergold">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cybergold/10 text-cybergold flex items-center justify-center group-hover:scale-105 transition-all">
                  <Flame size={24} />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-base">Division rank</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{user.rank}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Game Selection */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase font-extrabold tracking-widest text-gray-400">Launch Deck</h3>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Ramudu-Seetha Card */}
              <div 
                onClick={() => { setSelectedGame('RAMUDU_SEETHA'); setShowCreateModal(true); }}
                className="glass-card rounded-3xl p-6 border-white/5 cursor-pointer hover:border-cyberpink group relative overflow-hidden flex flex-col justify-between h-56"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyberpink/10 rounded-full blur-2xl group-hover:bg-cyberpink/20 transition-all"></div>
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cyberpink/10 text-cyberpink flex items-center justify-center font-bold text-lg mb-4">
                    RS
                  </div>
                  <h4 className="font-extrabold text-xl mb-1.5 group-hover:text-cyberpink transition-colors">Ramudu-Seetha</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">Deduce target profiles. Ramudu seeks Seetha. Exclusively built multiplayer deduction room.</p>
                </div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">3-10 players &bull; Deduction</div>
              </div>

              {/* Ludo Card */}
              <div 
                onClick={() => { setSelectedGame('LUDO'); setShowCreateModal(true); }}
                className="glass-card rounded-3xl p-6 border-white/5 cursor-pointer hover:border-cyberblue group relative overflow-hidden flex flex-col justify-between h-56"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyberblue/10 rounded-full blur-2xl group-hover:bg-cyberblue/20 transition-all"></div>
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cyberblue/10 text-cyberblue flex items-center justify-center font-bold text-lg mb-4">
                    LD
                  </div>
                  <h4 className="font-extrabold text-xl mb-1.5 group-hover:text-cyberblue transition-colors">Cosmic Ludo</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">Roll virtual dice, knock back spaceships, reach home terminal first. Standard board dynamics.</p>
                </div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">2 or 4 players &bull; Classic</div>
              </div>
            </div>
          </div>

          {/* Leaderboard Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-gray-400">Top Division Board</h3>
              <div className="flex rounded-lg bg-white/5 p-0.5 text-xs font-bold border border-white/5">
                <button 
                  onClick={() => setLeaderboardType('global')} 
                  className={`px-3 py-1 rounded-md transition-all ${leaderboardType === 'global' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Global
                </button>
                <button 
                  onClick={() => setLeaderboardType('friends')} 
                  className={`px-3 py-1 rounded-md transition-all ${leaderboardType === 'friends' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Friends
                </button>
              </div>
            </div>

            <div className="glass-card rounded-2xl border-white/5 overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-500 font-extrabold">
                    <th className="py-4 px-6">Placement</th>
                    <th className="py-4 px-6">User</th>
                    <th className="py-4 px-6">Level</th>
                    <th className="py-4 px-6">Division Rank</th>
                    <th className="py-4 px-6 text-right">XP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-200">
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-gray-500">Retrieving telemetry stats...</td>
                    </tr>
                  ) : (
                    leaderboard.map((usr, index) => (
                      <tr key={usr.id} className="hover:bg-white/5 transition-all">
                        <td className="py-4 px-6 font-black text-sm">
                          {index + 1 === 1 ? '🥇' : index + 1 === 2 ? '🥈' : index + 1 === 3 ? '🥉' : `#${index + 1}`}
                        </td>
                        <td className="py-4 px-6 font-bold flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xs uppercase border ${
                            usr.profileFrame === 'neon_glow' ? 'border-cyberblue' : 
                            usr.profileFrame === 'event_horizon' ? 'border-cyberpink' : 'border-white/10'
                          }`}>
                            {usr.username[0]}
                          </div>
                          <span>{usr.username}</span>
                        </td>
                        <td className="py-4 px-6 text-cyberblue font-bold">{usr.level}</td>
                        <td className="py-4 px-6 text-xs font-semibold text-gray-400">{usr.rank}</td>
                        <td className="py-4 px-6 text-right font-bold text-cyberpink">{usr.xp}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right side Social Drawer */}
        <SocialDrawer currentUserId={user.id} />
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border-white/5 relative overflow-hidden">
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
                    onChange={(e) => setSelectedGame(e.target.value as any)}
                    className="w-full glass-input rounded-xl px-4 py-2.5 text-sm mt-1 focus:border-cyberblue"
                  >
                    <option value="RAMUDU_SEETHA">Ramudu-Seetha</option>
                    <option value="LUDO">Cosmic Ludo</option>
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
                      <option value={4}>4 Players</option>
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

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm glass-panel rounded-3xl p-6 border-white/5 relative overflow-hidden">
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
