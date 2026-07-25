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

  const peersStateRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  useEffect(() => {
    peersStateRef.current = peersRef.current;
  });

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

  const closePeer = (peerSocketId: string) => {
    // Close connection
    const pc = peersRef.current.get(peerSocketId);
    if (pc) {
      pc.close();
      peersRef.current.delete(peerSocketId);
    }
    
    // Remove audio element
    const audio = audioElementsRef.current.get(peerSocketId);
    if (audio) {
      audio.pause();
      audio.remove();
      audioElementsRef.current.delete(peerSocketId);
    }
  };

  const cleanupAll = () => {
    // Close all peer connections
    peersRef.current.forEach((pc, socketId) => {
      pc.close();
    });
    peersRef.current.clear();

    // Remove all remote audios
    audioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.remove();
    });
    audioElementsRef.current.clear();

    // Stop mic stream
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

    // Connection state log
    pc.onconnectionstatechange = () => {
      console.log(`WebRTC Connection State for peer ${peerSocketId}: ${pc.connectionState}`);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        closePeer(peerSocketId);
      }
    };

    // Remote streams hookup
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
      audio.muted = speakerDeafened;
      
      audio.play().catch((err) => {
        console.error('Failed to play remote audio track:', err);
      });
    };

    // If we are initiating the connection, create offer
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

      // Join the voice channel on backend
      socket.emit('join_voice', roomCode);
    } catch (err: any) {
      console.error('Failed to join voice chat:', err);
      setStatus('Access Blocked');
      alert(`Could not access microphone: ${err.message}. Please check browser settings.`);
    }
  };

  // Listen to remote signaling and voice list updates
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

    const handlePeersList = async (peerSocketIds: string[]) => {
      const stream = await getLocalStream();
      peerSocketIds.forEach((peerSocketId) => {
        if (!peersRef.current.has(peerSocketId)) {
          initializePeer(peerSocketId, stream, true); // Initiate connection to existing voice users
        }
      });
    };

    const handleUserJoinedVoice = async ({ socketId }: { socketId: string }) => {
      const stream = await getLocalStream();
      if (!peersRef.current.has(socketId)) {
        initializePeer(socketId, stream, false); // Passive connection, wait for offer from joining user
      }
    };

    const handleUserLeftVoice = ({ socketId }: { socketId: string }) => {
      closePeer(socketId);
    };

    socket.on('voice_signal_received', handleSignal);
    socket.on('voice_peers_list', handlePeersList);
    socket.on('user_joined_voice', handleUserJoinedVoice);
    socket.on('user_left_voice', handleUserLeftVoice);

    return () => {
      socket.off('voice_signal_received', handleSignal);
      socket.off('voice_peers_list', handlePeersList);
      socket.off('user_joined_voice', handleUserJoinedVoice);
      socket.off('user_left_voice', handleUserLeftVoice);
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
      // Notify others we left
      if (joined) {
        socket.emit('leave_voice', roomCode);
      }
      cleanupAll();
    };
  }, [joined]);

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
