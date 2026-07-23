'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useSocket } from '../../../hooks/useSocket';
import RamuduSeethaGame from '../../../components/RamuduSeethaGame';
import LudoGame from '../../../components/LudoGame';
import { Users, Send, Crown, CheckCircle, ShieldAlert, LogOut, MessageSquare } from 'lucide-react';

interface Player {
  id: string;
  username: string;
  socketId: string;
  avatar: string;
  profileFrame: string;
  ready: boolean;
}

interface RoomData {
  code: string;
  name: string;
  gameType: 'RAMUDU_SEETHA' | 'LUDO';
  type: 'PUBLIC' | 'PRIVATE';
  maxPlayers: number;
  voiceChat: boolean;
  allowSpectators: boolean;
  hostId: string;
  status: 'LOBBY' | 'PLAYING';
  players: Player[];
}

interface ChatMessage {
  id: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = (params?.code as string)?.toUpperCase();

  const socket = useSocket();
  const { user, loading } = useAuth(true);

  const [room, setRoom] = useState<RoomData | null>(null);
  const [chatList, setChatList] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [rounds, setRounds] = useState(3);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!socket || !user || !roomCode) return;

    // Join room socket emit
    socket.emit('join_room', {
      roomCode,
      userId: user.id,
      username: user.username,
    });

    socket.on('room_joined', (roomData: RoomData) => {
      setRoom(roomData);
      const myPlayer = roomData.players.find((p) => p.id === user.id);
      if (myPlayer) {
        setIsReady(myPlayer.ready);
      }
    });

    socket.on('room_state_updated', (roomData: RoomData) => {
      setRoom(roomData);
      const myPlayer = roomData.players.find((p) => p.id === user.id);
      if (myPlayer) {
        setIsReady(myPlayer.ready);
      }
    });

    socket.on('chat_message', (msg: ChatMessage) => {
      setChatList((prev) => [...prev, msg]);
    });

    socket.on('room_deleted', () => {
      alert('The lobby was disbanded.');
      router.push('/dashboard');
    });

    socket.on('error', (msg: string) => {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    });

    return () => {
      // Clean room signals
      socket.emit('leave_room', { roomCode, userId: user.id });
      socket.off('room_joined');
      socket.off('room_state_updated');
      socket.off('chat_message');
      socket.off('room_deleted');
      socket.off('error');
    };
  }, [socket, user, roomCode, router]);

  // Scroll chat list automatically
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatList]);

  const handleToggleReady = () => {
    if (!user || !roomCode || !socket) return;
    const nextReady = !isReady;
    setIsReady(nextReady);
    socket.emit('toggle_ready', {
      roomCode,
      userId: user.id,
      ready: nextReady,
    });
  };

  const handleStartGame = () => {
    if (!socket || !room) return;
    if (room.gameType === 'LUDO') {
      socket.emit('ludo_start_game', room.code);
    } else {
      socket.emit('rs_start_game', { roomCode: room.code, maxRounds: rounds });
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket || !user) return;

    socket.emit('send_room_message', {
      roomCode,
      senderName: user.username,
      content: chatInput,
    });
    setChatInput('');
  };

  const handleLeaveRoom = () => {
    if (!user || !socket) return;
    socket.emit('leave_room', { roomCode, userId: user.id });
    router.push('/dashboard');
  };

  if (loading || !user || !room || !socket) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-cyberblue animate-spin mb-4"></div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Entering Lobby Matrix...</p>
      </div>
    );
  }

  const isHost = room.hostId === user.id;
  const canStart =
    room.players.length >= (room.gameType === 'LUDO' ? 2 : 3) &&
    room.players.every((p) => p.id === room.hostId || p.ready);

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-screen overflow-hidden">
      {/* Game gameplay layout OR waiting room layout */}
      <div className="flex-grow flex flex-col overflow-y-auto max-h-[calc(100vh-160px)] lg:max-h-screen p-6">
        
        {room.status === 'PLAYING' ? (
          // In Game Render
          room.gameType === 'RAMUDU_SEETHA' ? (
            <RamuduSeethaGame roomCode={roomCode} user={user} socket={socket} isHost={room.hostId === user.id} />
          ) : (
            <LudoGame roomCode={roomCode} user={user} socket={socket} />
          )
        ) : (
          // Lobby Waiting Room UI
          <div className="flex-grow flex flex-col justify-between max-w-4xl mx-auto w-full space-y-6">
            
            {/* Header info */}
            <div className="glass-panel rounded-3xl p-6 border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] font-black uppercase text-cyberblue tracking-wider">Lobby terminal ready</span>
                <h2 className="text-2xl font-black text-white mt-0.5">{room.name}</h2>
                <div className="text-xs text-gray-400 mt-1">
                  Game: <strong className="text-cyberpink">{room.gameType === 'LUDO' ? 'Cosmic Ludo' : 'Ramudu-Seetha'}</strong> &bull; Code: <strong className="text-white tracking-widest">{room.code}</strong>
                </div>
              </div>

              <button 
                onClick={handleLeaveRoom}
                className="px-5 py-2.5 rounded-xl border border-cybererror/35 bg-cybererror/10 hover:bg-cybererror text-cybererror hover:text-white transition-all text-xs font-bold flex items-center gap-2"
              >
                <LogOut size={14} /> Leave Deck
              </button>
            </div>

            {errorMsg && (
              <div className="p-4 rounded-xl bg-cybererror/10 border border-cybererror/30 text-cybererror text-sm flex gap-3">
                <ShieldAlert size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Crew Members Grid */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-gray-400 flex items-center gap-2">
                <Users size={16} /> Joined Crew ({room.players.length}/{room.maxPlayers})
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {room.players.map((player) => {
                  const isPlayerHost = room.hostId === player.id;
                  return (
                    <div 
                      key={player.id} 
                      className={`glass-card rounded-2xl p-5 border text-center flex flex-col items-center justify-center relative ${
                        player.ready ? 'border-cybersuccess shadow-neon-success' : 'border-white/5'
                      }`}
                    >
                      <div className="relative mb-3">
                        <div className={`w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center font-bold text-lg uppercase border border-white/10`}>
                          {player.username[0]}
                        </div>
                        {isPlayerHost && (
                          <span className="absolute -top-1.5 -right-1.5 p-1 bg-cybergold rounded-full text-darkbg shadow-md">
                            <Crown size={12} />
                          </span>
                        )}
                        {!isPlayerHost && player.ready && (
                          <span className="absolute -bottom-1.5 -right-1.5 p-1 bg-cybersuccess rounded-full text-white shadow-md">
                            <CheckCircle size={12} />
                          </span>
                        )}
                      </div>

                      <h4 className="font-extrabold text-sm text-gray-200 truncate w-full">{player.username}</h4>
                      <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">
                        {isPlayerHost ? 'Captain' : player.ready ? 'Ready to launch' : 'Calibrating'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Start Panel Actions */}
            <div className="glass-card rounded-3xl p-6 border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-gray-400 leading-relaxed max-w-md">
                {isHost ? (
                  canStart ? 
                    "All ready status telemetry approved. Captain is cleared to launch the match." : 
                    "Waiting for all crew members to toggle ready status. Ludo requires 2/4 players; RS requires 3+."
                ) : (
                  isReady ? 
                    "Telemetry active. Waiting for Captain to launch the room." : 
                    "Confirm ready status telemetry once loaded."
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                {isHost && room.gameType === 'RAMUDU_SEETHA' && (
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                    <label className="text-xs font-bold text-gray-400 whitespace-nowrap">Rounds:</label>
                    <select
                      value={rounds}
                      onChange={(e) => setRounds(Number(e.target.value))}
                      className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                    >
                      <option value={1} className="bg-[#0b0f19] text-white">1 Round</option>
                      <option value={3} className="bg-[#0b0f19] text-white">3 Rounds</option>
                      <option value={5} className="bg-[#0b0f19] text-white">5 Rounds</option>
                      <option value={7} className="bg-[#0b0f19] text-white">7 Rounds</option>
                      <option value={10} className="bg-[#0b0f19] text-white">10 Rounds</option>
                    </select>
                  </div>
                )}

                {isHost ? (
                  <button
                    onClick={handleStartGame}
                    disabled={!canStart}
                    className={`px-8 py-3.5 rounded-xl font-bold shadow-neon-blue bg-gradient-to-r from-primary to-cyberblue hover:opacity-90 transition-all ${
                      !canStart ? 'opacity-30 cursor-default' : 'active:scale-95 hover:scale-[1.01]'
                    }`}
                  >
                    Start Match
                  </button>
                ) : (
                  <button
                    onClick={handleToggleReady}
                    className={`px-8 py-3.5 rounded-xl font-bold transition-all hover:scale-[1.01] ${
                      isReady 
                        ? 'bg-cybersuccess text-white border border-cybersuccess/30 shadow-neon-success' 
                        : 'glass-card border-white/10 hover:border-cyberblue text-white'
                    }`}
                  >
                    {isReady ? 'Ready' : 'Not Ready'}
                  </button>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Side Chat Drawer */}
      <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-white/5 bg-darkbg/95 backdrop-blur-xl flex flex-col h-48 lg:h-screen shrink-0">
        <div className="p-3 border-b border-white/5 flex items-center gap-2">
          <MessageSquare size={16} className="text-cyberblue" />
          <span className="text-xs uppercase font-extrabold tracking-widest text-gray-400">Lobby Chat</span>
        </div>

        {/* Chat List */}
        <div className="flex-1 p-3 overflow-y-auto space-y-2">
          {chatList.map((chat) => (
            <div key={chat.id} className="text-xs">
              <span className={`font-black ${chat.senderName === 'SYSTEM' ? 'text-cyberpink' : 'text-cyberblue'}`}>
                {chat.senderName}:
              </span>
              <span className="text-gray-300 ml-1.5 leading-relaxed">{chat.content}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendChat} className="p-3 border-t border-white/5 flex gap-2">
          <input
            type="text"
            required
            placeholder="Comms chat..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-grow glass-input rounded-xl px-4 py-2 text-xs focus:border-cyberblue"
          />
          <button type="submit" className="px-3 rounded-xl bg-primary hover:opacity-90 text-white flex items-center justify-center">
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
