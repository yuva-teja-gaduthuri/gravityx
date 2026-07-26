'use client';

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Mic, MicOff, Volume2, VolumeX, Radio, PhoneOff, Users } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

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
  const { t } = useTranslation();
  const [joined, setJoined] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerDeafened, setSpeakerDeafened] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('Offline');

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analysersRef = useRef<Map<string, () => void>>(new Map());
  const candidateQueuesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

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

    // Clean up ICE candidate queue
    candidateQueuesRef.current.delete(peerSocketId);

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
    // Tell backend we left voice
    if (socket && joinedRef.current) {
      socket.emit('leave_voice', roomCode);
    }

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
    candidateQueuesRef.current.clear();

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

    console.log(`Initializing peer connection for ${peerSocketId}, initiating: ${initiateOffer}`);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    peersRef.current.set(peerSocketId, pc);

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
      if (peersRef.current.get(peerSocketId) !== pc) {
        return;
      }
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
        audio.playsInline = true;
        audioElementsRef.current.set(peerSocketId, audio);
      }
      
      audio.srcObject = remoteStream;
      document.body.appendChild(audio);
      audio.muted = speakerDeafenedRef.current;
      
      audio.play().catch((err) => {
        console.error('Failed to play remote audio track:', err);
      });

      // Start Web Audio analysis
      startAnalyzingStream(peerSocketId, remoteStream);
    };

    // Negotiation
    if (initiateOffer) {
      pc.onnegotiationneeded = async () => {
        try {
          console.log(`Creating WebRTC offer for peer ${peerSocketId}`);
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

    // Add local tracks (onnegotiationneeded must be set BEFORE adding tracks)
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

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

      // Tell backend we joined voice
      socket.emit('join_voice', roomCode);
    } catch (err: any) {
      console.error('Failed to join voice chat:', err);
      setStatus('Access Blocked');
    }
  };

  // Automatically join voice on mount
  useEffect(() => {
    if (!socket) return;
    handleJoinVoice();
    return () => {
      cleanupAll();
    };
  }, [socket]);

  // Listen to socket connection status for auto-rejoin
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      console.log('Socket connected/reconnected. Joining voice room:', roomCode);
      if (joinedRef.current) {
        socket.emit('join_voice', roomCode);
      }
    };

    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket, roomCode]);

  // Listen to remote signaling and voice events
  useEffect(() => {
    if (!joined) return;

    const handleVoicePeersList = (peerSocketIds: string[]) => {
      console.log('Received voice peers list:', peerSocketIds);
      const stream = localStreamRef.current;
      if (!stream) return;

      peerSocketIds.forEach((peerId) => {
        initializePeer(peerId, stream, true); // Initiate connection to existing voice peers
      });
    };

    const handleUserJoinedVoice = ({ socketId }: { socketId: string }) => {
      console.log(`User joined voice: ${socketId}. Waiting for them to initiate...`);
    };

    const handleUserLeftVoice = ({ socketId }: { socketId: string }) => {
      console.log(`User left voice: ${socketId}. Cleaning up peer.`);
      closePeer(socketId);
    };

    const handleSignal = async ({ senderSocketId, signal }: { senderSocketId: string; signal: any }) => {
      try {
        let pc = peersRef.current.get(senderSocketId);

        if (signal.type === 'offer') {
          console.log(`Received WebRTC offer from ${senderSocketId}`);
          const stream = await getLocalStream();
          pc = initializePeer(senderSocketId, stream, false);
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          
          // Apply queued candidates
          const queue = candidateQueuesRef.current.get(senderSocketId) || [];
          for (const cand of queue) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.error('Error applying queued candidate:', e);
            }
          }
          candidateQueuesRef.current.delete(senderSocketId);

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
          console.log(`Received WebRTC answer from ${senderSocketId}`);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            
            // Apply queued candidates
            const queue = candidateQueuesRef.current.get(senderSocketId) || [];
            for (const cand of queue) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.error('Error applying queued candidate:', e);
              }
            }
            candidateQueuesRef.current.delete(senderSocketId);
          }
        } else if (signal.type === 'candidate') {
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            // Queue candidate
            const queue = candidateQueuesRef.current.get(senderSocketId) || [];
            queue.push(signal.candidate);
            candidateQueuesRef.current.set(senderSocketId, queue);
          }
        }
      } catch (err) {
        console.error('Error handling WebRTC signal:', err);
      }
    };

    socket.on('voice_peers_list', handleVoicePeersList);
    socket.on('user_joined_voice', handleUserJoinedVoice);
    socket.on('user_left_voice', handleUserLeftVoice);
    socket.on('voice_signal_received', handleSignal);

    return () => {
      socket.off('voice_peers_list', handleVoicePeersList);
      socket.off('user_joined_voice', handleUserJoinedVoice);
      socket.off('user_left_voice', handleUserLeftVoice);
      socket.off('voice_signal_received', handleSignal);
    };
  }, [joined, socket, roomCode, micMuted, speakerDeafened]);

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

  const connectedPeersCount = peersRef.current.size;

  const renderStatus = () => {
    if (status === 'Connected') return t('voiceConnected', 'Connected');
    if (status === 'Offline') return t('voiceOffline', 'Offline');
    if (status === 'Acquiring Microphone...') return t('voiceConnecting', 'Connecting Voice...');
    if (status === 'Access Blocked') return t('voiceBlocked', 'Access Blocked');
    return status;
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 glass-panel rounded-2xl border border-white/10 p-4 w-64 shadow-2xl flex flex-col gap-3 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio size={16} className={`text-cyberpink ${joined ? 'animate-pulse' : ''}`} />
          <span className="text-xs uppercase font-extrabold tracking-widest text-gray-200">
            {t('voiceHeader', 'Devavani Voice')}
          </span>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
          status === 'Connected' ? 'bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess' :
          status === 'Offline' ? 'bg-white/5 border border-white/10 text-gray-400' :
          'bg-cyberblue/10 border border-cyberblue/30 text-cyberblue'
        }`}>
          {renderStatus()}
        </span>
      </div>

      {!joined ? (
        <button
          onClick={handleJoinVoice}
          className="w-full py-2.5 rounded-xl btn-mythic font-extrabold uppercase text-[10px] tracking-wider flex items-center justify-center gap-1.5"
        >
          {t('connectVoiceBtn', '🎙️ Connect Voice Chat')}
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
              <span>{micMuted ? t('off', 'Muted') : t('talkBtn', 'Talk')}</span>
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
              <span>{speakerDeafened ? t('deafenedBtn', 'Deafened') : t('listenBtn', 'Listen')}</span>
            </button>
          </div>

          {activeSpeakers.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-white/5 pt-2">
              <span className="text-[8px] uppercase font-bold text-gray-500">
                {t('speakingLabel', 'Currently Speaking:')}
              </span>
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
              <span>{t('connectionsLabel', 'Voice Channel Connections')}</span>
            </div>
            <span className="text-gray-300">{connectedPeersCount} {t('connected', 'connected')}</span>
          </div>

          <button
            onClick={cleanupAll}
            className="w-full py-2 rounded-xl bg-cybererror/10 hover:bg-cybererror border border-cybererror/20 hover:border-transparent text-cybererror hover:text-white transition-all font-extrabold uppercase text-[9px] tracking-wider flex items-center justify-center gap-1"
          >
            <PhoneOff size={12} /> {t('disconnectBtn', 'Disconnect Channel')}
          </button>
        </div>
      )}
    </div>
  );
}
