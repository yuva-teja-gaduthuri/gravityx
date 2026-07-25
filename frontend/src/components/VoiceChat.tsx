'use client';

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Mic, MicOff, Volume2, VolumeX, Radio, PhoneOff, Users } from 'lucide-react';

interface Player {
  id: string;
  username: string;
  socketId: string;
  avatar: string;
  profileFrame: string;
  ready: boolean;
  isBot?: boolean;
}

interface VoiceChatProps {
  roomCode: string;
  socket: Socket;
  players: Player[];
  currentUser: { id: string; username: string };
}

export default function VoiceChat({ roomCode, socket, players, currentUser }: VoiceChatProps) {
  const [joined, setJoined] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerDeafened, setSpeakerDeafened] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('Offline');

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analysersRef = useRef<Map<string, () => void>>(new Map());

  // Refs to allow async callbacks to read fresh state without re-binding
  const joinedRef = useRef(false);
  const micMutedRef = useRef(false);
  const speakerDeafenedRef = useRef(false);
  const playersRef = useRef<Player[]>([]);

  useEffect(() => { joinedRef.current = joined; }, [joined]);
  useEffect(() => { micMutedRef.current = micMuted; }, [micMuted]);
  useEffect(() => { speakerDeafenedRef.current = speakerDeafened; }, [speakerDeafened]);
  useEffect(() => { playersRef.current = players; }, [players]);

  const getLocalStream = async (): Promise<MediaStream> => {
    if (localStreamRef.current) return localStreamRef.current;
    
    setStatus('Acquiring Microphone...');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    
    localStreamRef.current = stream;
    return stream;
  };

  const startAnalyzingStream = (socketId: string, stream: MediaStream) => {
    // Clean up existing analyzer if any
    const existingCleanup = analysersRef.current.get(socketId);
    if (existingCleanup) {
      existingCleanup();
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let isCurrentlySpeaking = false;
      let silenceTimeout: any = null;

      const intervalId = setInterval(() => {
        if (ctx.state === 'suspended') return;
        
        analyser.getByteTimeDomainData(dataArray);
        
        // Calculate RMS (root-mean-square) volume level
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / bufferLength);
        const threshold = 0.015; // Sensitivity threshold for speech

        // If local mic is muted, force silence
        const isMutedLocal = socketId === socket.id && micMutedRef.current;
        const speaking = rms > threshold && !isMutedLocal;

        if (speaking) {
          if (silenceTimeout) {
            clearTimeout(silenceTimeout);
            silenceTimeout = null;
          }
          if (!isCurrentlySpeaking) {
            isCurrentlySpeaking = true;
            window.dispatchEvent(new CustomEvent('voice_user_speaking', {
              detail: { socketId, isSpeaking: true }
            }));
            setActiveSpeakers((prev) => [...prev.filter(id => id !== socketId), socketId]);
          }
        } else {
          if (isCurrentlySpeaking && !silenceTimeout) {
            silenceTimeout = setTimeout(() => {
              isCurrentlySpeaking = false;
              window.dispatchEvent(new CustomEvent('voice_user_speaking', {
                detail: { socketId, isSpeaking: false }
              }));
              setActiveSpeakers((prev) => prev.filter(id => id !== socketId));
              silenceTimeout = null;
            }, 400); // 400ms delay to prevent flickering during natural pauses
          }
        }
      }, 100);

      const cleanup = () => {
        clearInterval(intervalId);
        if (silenceTimeout) clearTimeout(silenceTimeout);
        try {
          source.disconnect();
          analyser.disconnect();
          ctx.close();
        } catch (e) {}
      };

      analysersRef.current.set(socketId, cleanup);
      return cleanup;
    } catch (err) {
      console.error('Error starting audio analyser:', err);
    }
  };

  const closePeer = (peerSocketId: string) => {
    // 1. Clean up analyzer
    const cleanupAnalyser = analysersRef.current.get(peerSocketId);
    if (cleanupAnalyser) {
      cleanupAnalyser();
      analysersRef.current.delete(peerSocketId);
    }
    
    // Dispatch speaking stopped
    window.dispatchEvent(new CustomEvent('voice_user_speaking', {
      detail: { socketId: peerSocketId, isSpeaking: false }
    }));
    setActiveSpeakers((prev) => prev.filter(id => id !== peerSocketId));

    // 2. Close peer connection
    const pc = peersRef.current.get(peerSocketId);
    if (pc) {
      pc.close();
      peersRef.current.delete(peerSocketId);
    }
    
    // 3. Remove audio element
    const audio = audioElementsRef.current.get(peerSocketId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      audioElementsRef.current.delete(peerSocketId);
    }
  };

  const cleanupAll = () => {
    // 1. Clear analysers
    analysersRef.current.forEach((cleanup) => {
      cleanup();
    });
    analysersRef.current.clear();
    
    // Dispatch speaking stopped for local user
    if (socket.id) {
      window.dispatchEvent(new CustomEvent('voice_user_speaking', {
        detail: { socketId: socket.id, isSpeaking: false }
      }));
    }
    setActiveSpeakers([]);

    // 2. Close peer connections
    peersRef.current.forEach((pc, socketId) => {
      pc.close();
    });
    peersRef.current.clear();

    // 3. Remove remote audios
    audioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    audioElementsRef.current.clear();

    // 4. Stop mic stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setJoined(false);
    setStatus('Offline');
  };

  const initializePeer = (peerSocketId: string, stream: MediaStream, initiateOffer: boolean) => {
    if (peersRef.current.has(peerSocketId)) {
      closePeer(peerSocketId);
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    peersRef.current.set(peerSocketId, pc);

    // Add local tracks
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voice_signal', {
          roomCode,
          targetSocketId: peerSocketId,
          signal: {
            type: 'candidate',
            candidate: event.candidate,
          },
        });
      }
    };

    // Connection state & auto-reconnect trigger
    pc.onconnectionstatechange = () => {
      console.log(`WebRTC Connection State for peer ${peerSocketId}: ${pc.connectionState}`);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        closePeer(peerSocketId);
        
        // Reconnection logic
        setTimeout(() => {
          if (joinedRef.current && playersRef.current.some(p => p.socketId === peerSocketId)) {
            console.log(`Auto-reconnecting Voice peer ${peerSocketId}...`);
            const currentStream = localStreamRef.current;
            if (currentStream) {
              const initiate = socket.id ? socket.id < peerSocketId : false;
              initializePeer(peerSocketId, currentStream, initiate);
            }
          }
        }, 3000);
      }
    };

    // Remote stream capture
    pc.ontrack = (event) => {
      console.log(`Received remote audio track from ${peerSocketId}`);
      const remoteStream = event.streams[0];
      
      let audio = audioElementsRef.current.get(peerSocketId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        audioElementsRef.current.set(peerSocketId, audio);
      }
      
      audio.srcObject = remoteStream;
      audio.muted = speakerDeafenedRef.current;
      
      audio.play().catch((err) => {
        console.error('Failed to play remote audio track:', err);
      });

      // Start Web Audio analysis
      startAnalyzingStream(peerSocketId, remoteStream);
    };

    // If we are initiating, create offer on negotiation needed
    if (initiateOffer) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('voice_signal', {
            roomCode,
            targetSocketId: peerSocketId,
            signal: {
              type: 'offer',
              sdp: offer,
            },
          });
        } catch (err) {
          console.error('Failed to create WebRTC offer:', err);
        }
      };
    }

    return pc;
  };

  const handleJoinVoice = async () => {
    try {
      const stream = await getLocalStream();
      setJoined(true);
      setStatus('Connected');

      // Mute track if state says so
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !micMuted;
      });

      // Start Web Audio analysis on local mic
      if (socket.id) {
        startAnalyzingStream(socket.id, stream);
      }

      // Connect to existing active players
      const otherPlayers = players.filter(
        (p) => !p.isBot && p.socketId !== socket.id && p.socketId && p.socketId !== 'BOT_SOCKET'
      );

      otherPlayers.forEach((p) => {
        const initiate = socket.id ? socket.id < p.socketId : false;
        initializePeer(p.socketId, stream, initiate);
      });
    } catch (err: any) {
      console.error('Failed to join voice chat:', err);
      setStatus('Access Blocked');
      alert(`Could not access microphone: ${err.message}. Please check browser settings.`);
    }
  };

  // Listen to remote signaling
  useEffect(() => {
    if (!joined) return;

    const handleSignal = async ({ senderSocketId, signal }: { senderSocketId: string; signal: any }) => {
      try {
        let pc = peersRef.current.get(senderSocketId);

        if (signal.type === 'offer') {
          const stream = await getLocalStream();
          pc = initializePeer(senderSocketId, stream, false);
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          socket.emit('voice_signal', {
            roomCode,
            targetSocketId: senderSocketId,
            signal: {
              type: 'answer',
              sdp: answer,
            },
          });
        } else if (signal.type === 'answer') {
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          }
        } else if (signal.type === 'candidate') {
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        }
      } catch (err) {
        console.error('Error handling WebRTC signal:', err);
      }
    };

    socket.on('voice_signal_received', handleSignal);

    return () => {
      socket.off('voice_signal_received', handleSignal);
    };
  }, [joined, socket, roomCode, micMuted, speakerDeafened]);

  // Mesh reconciliation on player roster updates
  useEffect(() => {
    if (!joined) return;

    const stream = localStreamRef.current;
    if (!stream) return;

    const otherPlayers = players.filter(
      (p) => !p.isBot && p.socketId !== socket.id && p.socketId && p.socketId !== 'BOT_SOCKET'
    );

    const activeSocketIds = new Set(otherPlayers.map((p) => p.socketId));

    // 1. Close peers that left
    peersRef.current.forEach((pc, socketId) => {
      if (!activeSocketIds.has(socketId)) {
        closePeer(socketId);
      }
    });

    // 2. Initialize new peers
    otherPlayers.forEach((p) => {
      if (!peersRef.current.has(p.socketId)) {
        const initiate = socket.id ? socket.id < p.socketId : false;
        initializePeer(p.socketId, stream, initiate);
      }
    });
  }, [players, joined, socket]);

  // Handle Mute Mic
  const toggleMuteMic = () => {
    const nextMute = !micMuted;
    setMicMuted(nextMute);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMute;
      });
    }
    // Instantly notify speaking state
    if (socket.id) {
      window.dispatchEvent(new CustomEvent('voice_user_speaking', {
        detail: { socketId: socket.id, isSpeaking: false }
      }));
      setActiveSpeakers((prev) => prev.filter(id => id !== socket.id));
    }
  };

  // Handle Deafen Speaker
  const toggleDeafenSpeaker = () => {
    const nextDeafen = !speakerDeafened;
    setSpeakerDeafened(nextDeafen);
    audioElementsRef.current.forEach((audio) => {
      audio.muted = nextDeafen;
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAll();
    };
  }, []);

  const connectedPeersCount = peersRef.current.size;

  return (
    <div className="fixed bottom-6 left-6 z-50 glass-panel rounded-2xl border border-white/10 p-4 w-64 shadow-2xl flex flex-col gap-3 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio size={16} className={`text-cyberpink ${joined ? 'animate-pulse' : ''}`} />
          <span className="text-xs uppercase font-extrabold tracking-widest text-gray-200">Devavani Voice</span>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
          status === 'Connected' ? 'bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess' :
          status === 'Offline' ? 'bg-white/5 border border-white/10 text-gray-400' :
          'bg-cyberblue/10 border border-cyberblue/30 text-cyberblue'
        }`}>
          {status}
        </span>
      </div>

      {!joined ? (
        <button
          onClick={handleJoinVoice}
          className="w-full py-2.5 rounded-xl btn-mythic font-extrabold uppercase text-[10px] tracking-wider flex items-center justify-center gap-1.5"
        >
          🎙️ Connect Voice Chat
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between gap-2">
            <button
              onClick={toggleMuteMic}
              className={`flex-1 py-2.5 rounded-xl border font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                micMuted
                  ? 'border-cybererror/35 bg-cybererror/10 text-cybererror'
                  : 'border-white/5 bg-white/5 hover:bg-white/10 text-gray-300'
              }`}
              title={micMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {micMuted ? <MicOff size={14} /> : <Mic size={14} />}
              <span>{micMuted ? 'Muted' : 'Talk'}</span>
            </button>

            <button
              onClick={toggleDeafenSpeaker}
              className={`flex-1 py-2.5 rounded-xl border font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                speakerDeafened
                  ? 'border-cybererror/35 bg-cybererror/10 text-cybererror'
                  : 'border-white/5 bg-white/5 hover:bg-white/10 text-gray-300'
              }`}
              title={speakerDeafened ? 'Listen' : 'Deafen'}
            >
              {speakerDeafened ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span>{speakerDeafened ? 'Deafened' : 'Listen'}</span>
            </button>
          </div>

          {activeSpeakers.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-white/5 pt-2">
              <span className="text-[8px] uppercase font-bold text-gray-500">Currently Speaking:</span>
              <div className="flex flex-wrap gap-1">
                {activeSpeakers.map((socketId) => {
                  const pl = players.find(p => p.socketId === socketId);
                  const name = socketId === socket.id ? 'You' : (pl?.username || 'Peer');
                  return (
                    <span key={socketId} className="text-[9px] bg-cybersuccess/10 text-cybersuccess border border-cybersuccess/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cybersuccess animate-ping"></span>
                      {name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-gray-500 border-t border-white/5 pt-2 font-bold">
            <div className="flex items-center gap-1">
              <Users size={12} />
              <span>Voice Channel Connections</span>
            </div>
            <span className="text-gray-300">{connectedPeersCount} connected</span>
          </div>

          <button
            onClick={cleanupAll}
            className="w-full py-2 rounded-xl bg-cybererror/10 hover:bg-cybererror border border-cybererror/20 hover:border-transparent text-cybererror hover:text-white transition-all font-extrabold uppercase text-[9px] tracking-wider flex items-center justify-center gap-1"
          >
            <PhoneOff size={12} /> Disconnect Channel
          </button>
        </div>
      )}
    </div>
  );
}
