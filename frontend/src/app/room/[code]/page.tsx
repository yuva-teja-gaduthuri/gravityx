'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useSocket } from '../../../hooks/useSocket';
import RamuduSeethaGame from '../../../components/RamuduSeethaGame';
import LudoGame from '../../../components/LudoGame';
import ChessGame from '@/components/ChessGame';
import VoiceChat from '../../../components/VoiceChat';
import { useTranslation } from '../../../hooks/useTranslation';
import { Users, Send, Crown, CheckCircle, ShieldAlert, LogOut, MessageSquare, X } from 'lucide-react';

interface Player {
  id: string;
  username: string;
  socketId: string;
  avatar: string;
  profileFrame: string;
  ready: boolean;
  isBot?: boolean;
}

interface RoomData {
  code: string;
  name: string;
  gameType: 'RAMUDU_SEETHA' | 'LUDO' | 'CHESS';
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
  const { t } = useTranslation();

  const socket = useSocket();
  const { user, loading } = useAuth(true);

  const [room, setRoom] = useState<RoomData | null>(null);
  const [chatList, setChatList] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const [rounds, setRounds] = useState(3);
  const [matchEndedData, setMatchEndedData] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [speakingPlayers, setSpeakingPlayers] = useState<Set<string>>(new Set());

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const isUnloadingRef = useRef(false);

  // Set up unload listener to guard refreshes
  useEffect(() => {
    const handleBeforeUnload = () => {
      isUnloadingRef.current = true;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Join room on mount and leave on unmount
  useEffect(() => {
    if (!socket || !user || !roomCode) return;

    const handleConnect = () => {
      socket.emit('join_room', {
        roomCode,
        userId: user.id,
        username: user.username,
      });
    };

    if (socket.connected) {
      handleConnect();
    }

    socket.on('connect', handleConnect);

    return () => {
      if (!isUnloadingRef.current) {
        socket.emit('leave_room', { roomCode, userId: user.id });
      }
      socket.off('connect', handleConnect);
    };
  }, [socket, roomCode]); // DO NOT run when user updates to avoid leave/join cycles

  // Register socket event listeners
  useEffect(() => {
    if (!socket || !user) return;

    const handleRoomJoined = (roomData: RoomData) => {
      setRoom(roomData);
      const myPlayer = roomData.players.find((p) => p.id === user.id);
      if (myPlayer) {
        setIsReady(myPlayer.ready);
      }
    };

    const handleRoomStateUpdated = (roomData: RoomData) => {
      setRoom(roomData);
      const myPlayer = roomData.players.find((p) => p.id === user.id);
      if (myPlayer) {
        setIsReady(myPlayer.ready);
      }
      if (roomData.status === 'LOBBY') {
        setMatchEndedData(null);
      }
    };

    const handleRoomKicked = ({ message }: { message: string }) => {
      alert(message);
      router.push('/dashboard');
    };

    const handleChatMessage = (msg: ChatMessage) => {
      setChatList((prev) => [...prev, msg]);
    };

    const handleRoomDeleted = () => {
      alert('The lobby was disbanded.');
      router.push('/dashboard');
    };

    const handleError = (msg: string) => {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    };

    const handleRsMatchEnded = (data: any) => {
      setMatchEndedData({ gameType: 'RAMUDU_SEETHA', data });
    };

    const handleLudoMatchEnded = (data: any) => {
      setMatchEndedData({ gameType: 'LUDO', data });
    };

    const handleChessMatchEnded = (data: any) => {
      setMatchEndedData({ gameType: 'CHESS', data });
    };

    socket.on('room_joined', handleRoomJoined);
    socket.on('room_state_updated', handleRoomStateUpdated);
    socket.on('room_kicked', handleRoomKicked);
    socket.on('chat_message', handleChatMessage);
    socket.on('room_deleted', handleRoomDeleted);
    socket.on('error', handleError);
    socket.on('rs_match_ended', handleRsMatchEnded);
    socket.on('ludo_match_ended', handleLudoMatchEnded);
    socket.on('chess_match_ended', handleChessMatchEnded);

    return () => {
      socket.off('room_joined', handleRoomJoined);
      socket.off('room_state_updated', handleRoomStateUpdated);
      socket.off('room_kicked', handleRoomKicked);
      socket.off('chat_message', handleChatMessage);
      socket.off('room_deleted', handleRoomDeleted);
      socket.off('error', handleError);
      socket.off('rs_match_ended', handleRsMatchEnded);
      socket.off('ludo_match_ended', handleLudoMatchEnded);
      socket.off('chess_match_ended', handleChessMatchEnded);
    };
  }, [socket, user, router]);

  // Scroll chat list automatically
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatList]);

  // Voice chat speaking indicator listener
  useEffect(() => {
    const handleSpeaking = (e: any) => {
      const { socketId, isSpeaking } = e.detail;
      setSpeakingPlayers((prev) => {
        const next = new Set(prev);
        if (isSpeaking) {
          next.add(socketId);
        } else {
          next.delete(socketId);
        }
        return next;
      });
    };
    window.addEventListener('voice_user_speaking', handleSpeaking);
    return () => window.removeEventListener('voice_user_speaking', handleSpeaking);
  }, []);

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
    setMatchEndedData(null);
    if (room.gameType === 'LUDO') {
      socket.emit('ludo_start_game', room.code);
    } else if (room.gameType === 'CHESS') {
      socket.emit('chess_start_game', room.code);
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

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const shareLink = `${window.location.origin}/room/${roomCode}`;
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
    room.players.length >= (room.gameType === 'LUDO' ? 2 : room.gameType === 'CHESS' ? 2 : 3) &&
    room.players.every((p) => p.id === room.hostId || p.ready);

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-screen lg:h-screen lg:overflow-hidden relative">
      {/* Game gameplay layout OR waiting room layout */}
      <div className="flex-grow flex flex-col overflow-y-auto h-full p-4 md:p-6 min-h-0">
        
        {room.status === 'PLAYING' || matchEndedData !== null ? (
          // In Game Render orstandings screen
          room.gameType === 'RAMUDU_SEETHA' ? (
            <RamuduSeethaGame 
              roomCode={roomCode} 
              user={user} 
              socket={socket} 
              isHost={room.hostId === user.id} 
              matchEndedData={matchEndedData?.gameType === 'RAMUDU_SEETHA' ? matchEndedData.data : null}
              onReturnToLobby={() => setMatchEndedData(null)}
            />
          ) : room.gameType === 'CHESS' ? (
            <ChessGame 
              roomCode={roomCode} 
              user={user} 
              socket={socket} 
              isHost={isHost}
              matchEndedData={matchEndedData?.gameType === 'CHESS' ? matchEndedData.data : null}
              onReturnToLobby={() => {
                if (isHost) {
                  socket.emit('chess_return_to_lobby', roomCode);
                }
                setMatchEndedData(null);
              }}
            />
          ) : (
            <LudoGame 
              roomCode={roomCode} 
              user={user} 
              socket={socket} 
              isHost={isHost}
              matchEndedData={matchEndedData?.gameType === 'LUDO' ? matchEndedData.data : null}
              onReturnToLobby={() => {
                if (isHost) {
                  socket.emit('ludo_return_to_lobby', roomCode);
                }
                setMatchEndedData(null);
              }}
            />
          )
        ) : (
          // Lobby Waiting Room UI
          <div className="flex-grow flex flex-col justify-between max-w-4xl mx-auto w-full space-y-6">
            
            {/* Header info */}
            <div className="glass-panel rounded-3xl p-6 border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] font-black uppercase text-cyberblue tracking-wider">Lobby terminal ready</span>
                <h2 className="text-2xl font-black text-white mt-0.5">{room.name}</h2>
                <div className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                  <span>Game: <strong className="text-cyberpink">{room.gameType === 'LUDO' ? 'Cosmic Ludo' : room.gameType === 'CHESS' ? 'Chess Strategy' : 'Ramudu-Seetha'}</strong></span>
                  <span>&bull;</span>
                  <span>Code: <strong className="text-white tracking-widest">{room.code}</strong></span>
                  <button
                    onClick={handleCopyLink}
                    className="ml-2 px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-cyberblue text-[10px] font-black text-gray-400 hover:text-white transition-all flex items-center gap-1 active:scale-95 uppercase tracking-wider"
                  >
                    {copied ? 'Link Copied!' : 'Share Lobby'}
                  </button>
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
              <div className="flex justify-between items-center">
                <h3 className="text-xs uppercase font-extrabold tracking-widest text-gray-400 flex items-center gap-2">
                  <Users size={16} /> Joined Crew ({room.players.length}/{room.maxPlayers})
                </h3>
                {isHost && room.players.length < room.maxPlayers && (
                  <button
                    onClick={() => socket.emit('add_bot', { roomCode })}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyberpink text-[10px] font-black uppercase text-gray-400 hover:text-white transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                  >
                    Add AI Crew
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {room.players.map((player) => {
                  const isPlayerHost = room.hostId === player.id;
                  const isSpeaking = speakingPlayers.has(player.socketId);
                  return (
                    <div 
                      key={player.id} 
                      className={`glass-card rounded-2xl p-5 border text-center flex flex-col items-center justify-center relative group transition-all ${
                        isSpeaking ? 'border-cybersuccess shadow-[0_0_15px_rgba(0,230,118,0.55)] ring-2 ring-cybersuccess/50' :
                        player.ready ? 'border-cybersuccess shadow-neon-success' : 'border-white/5'
                      }`}
                    >
                      {isHost && player.id !== user.id && (
                        <button
                          onClick={() => socket.emit('kick_player', { roomCode, userId: player.id })}
                          className="absolute top-2 right-2 p-1.5 rounded bg-cybererror/10 hover:bg-cybererror border border-cybererror/20 hover:border-transparent text-cybererror hover:text-white transition-all duration-200 z-30 opacity-0 group-hover:opacity-100 flex items-center justify-center animate-fade-in"
                          title="Remove Crew Member"
                        >
                          <LogOut size={10} className="w-2.5 h-2.5" />
                        </button>
                      )}

                      <div className="relative mb-3">
                        <div className={`w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center font-bold text-lg uppercase border transition-all ${
                          isSpeaking ? 'border-cybersuccess shadow-[0_0_12px_rgba(0,230,118,0.6)] ring-2 ring-cybersuccess' : 'border-white/10'
                        }`}>
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

                      <h4 className="font-extrabold text-sm text-gray-200 truncate w-full flex items-center justify-center gap-1">
                        {player.username}
                        {isSpeaking && (
                          <span className="text-cybersuccess animate-pulse" title="Speaking">
                            🎙️
                          </span>
                        )}
                        {player.isBot && (
                          <span className="px-1 py-0.5 rounded bg-cyberpink/20 border border-cyberpink/30 text-[8px] font-black text-cyberpink uppercase">
                            AI
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">
                        {isPlayerHost ? 'Captain' : player.ready ? 'Ready to launch' : 'Calibrating'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Host Settings panel */}
            {isHost && (
              <div className="glass-card rounded-3xl p-6 border-white/5 space-y-4">
                <h3 className="text-xs uppercase font-extrabold tracking-widest text-gray-400">
                  Lobby Settings Configuration
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Visibility</label>
                    <select
                      value={room.type}
                      onChange={(e) => socket.emit('edit_room_settings', {
                        roomCode: room.code,
                        type: e.target.value as 'PUBLIC' | 'PRIVATE',
                        maxPlayers: room.maxPlayers,
                        voiceChat: room.voiceChat,
                        allowSpectators: room.allowSpectators
                      })}
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:border-cyberblue mt-1 bg-white/5 text-white"
                    >
                      <option value="PUBLIC" className="bg-[#0b0f19] text-white">PUBLIC</option>
                      <option value="PRIVATE" className="bg-[#0b0f19] text-white">PRIVATE</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Max Players</label>
                    <select
                      value={room.maxPlayers}
                      onChange={(e) => socket.emit('edit_room_settings', {
                        roomCode: room.code,
                        type: room.type,
                        maxPlayers: Number(e.target.value),
                        voiceChat: room.voiceChat,
                        allowSpectators: room.allowSpectators
                      })}
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:border-cyberblue mt-1 bg-white/5 text-white"
                    >
                      {room.gameType !== 'RAMUDU_SEETHA' && (
                        <option value={2} className="bg-[#0b0f19] text-white">2 Players</option>
                      )}
                      <option value={3} className="bg-[#0b0f19] text-white">3 Players</option>
                      <option value={4} className="bg-[#0b0f19] text-white">4 Players</option>
                      <option value={6} className="bg-[#0b0f19] text-white">6 Players</option>
                      <option value={8} className="bg-[#0b0f19] text-white">8 Players</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Voice Chat</label>
                    <select
                      value={room.voiceChat ? 'true' : 'false'}
                      onChange={(e) => socket.emit('edit_room_settings', {
                        roomCode: room.code,
                        type: room.type,
                        maxPlayers: room.maxPlayers,
                        voiceChat: e.target.value === 'true',
                        allowSpectators: room.allowSpectators
                      })}
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:border-cyberblue mt-1 bg-white/5 text-white"
                    >
                      <option value="true" className="bg-[#0b0f19] text-white">Enabled</option>
                      <option value="false" className="bg-[#0b0f19] text-white">Disabled</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to disband and delete this lobby?')) {
                          socket.emit('delete_room', room.code);
                        }
                      }}
                      className="w-full py-2 rounded-xl bg-cybererror/10 hover:bg-cybererror border border-cybererror/20 hover:border-transparent text-cybererror hover:text-white transition-all text-xs font-bold text-center"
                    >
                      Disband Lobby Room
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                    <label className="text-xs font-bold text-gray-400 whitespace-nowrap">{t('roundsLabel', 'Session Rounds count')}:</label>
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
                    className={`px-8 py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all ${
                      !canStart ? 'opacity-30 cursor-default bg-white/5 border border-white/10 text-gray-500' : 'btn-mythic-gold active:scale-95'
                    }`}
                  >
                    {t('startGameBtn', 'Start Game Operation')}
                  </button>
                ) : (
                  <button
                    onClick={handleToggleReady}
                    className={`px-8 py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all ${
                      isReady 
                        ? 'bg-cybersuccess text-white border border-cybersuccess/30 shadow-neon-success hover:bg-cybersuccess/90 active:scale-95' 
                        : 'btn-mythic active:scale-95'
                    }`}
                  >
                    {isReady ? t('readyBtn', 'READY') : t('notReadyBtn', 'NOT READY')}
                  </button>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Side Chat Drawer */}
      <div className={`
        ${isChatOpen ? 'fixed inset-x-0 bottom-0 h-[45vh] z-50 rounded-t-3xl border-t border-white/10' : 'hidden'} 
        lg:flex lg:relative lg:inset-auto lg:h-screen lg:w-80 lg:rounded-none lg:border-t-0 lg:border-l lg:border-white/5
        bg-darkbg/98 backdrop-blur-xl flex flex-col shrink-0 shadow-2xl transition-all duration-300
      `}>
        <div className="p-3 border-b border-white/5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-cyberblue" />
            <span className="text-xs uppercase font-extrabold tracking-widest text-gray-400">{t('chatConsole', 'Chat Console')}</span>
          </div>
          {/* Close button visible only on mobile/tablet */}
          <button 
            onClick={() => setIsChatOpen(false)}
            className="lg:hidden p-1 text-gray-400 hover:text-white"
          >
            <X size={16} />
          </button>
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
            placeholder={t('chatPlaceholder', 'Comms chat...')}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-grow glass-input rounded-xl px-4 py-2 text-xs focus:border-cyberblue"
          />
          <button type="submit" className="px-3 rounded-xl bg-primary hover:opacity-90 text-white flex items-center justify-center">
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* Floating Chat FAB for Mobile/Tablet */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 z-40 lg:hidden p-4 rounded-full bg-primary hover:bg-primary/95 text-white shadow-neon-blue transition-all duration-300"
      >
        <MessageSquare size={20} />
      </button>

      {room.voiceChat && socket && (
        <VoiceChat 
          roomCode={roomCode} 
          socket={socket} 
          players={room.players} 
          currentUser={user} 
        />
      )}
    </div>
  );
}
