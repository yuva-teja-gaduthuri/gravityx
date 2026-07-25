'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

interface Player {
  id: string;
  username: string;
  socketId: string;
  avatar: string;
  profileFrame: string;
  ready: boolean;
  isBot?: boolean;
}

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function useVoiceChat(
  socket: Socket | null,
  roomCode: string,
  players: Player[],
  currentUserId: string,
  enabled: boolean
) {
  const [isMuted, setIsMuted] = useState(false);
  const [micError, setMicError] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map()); // targetSocketId -> RTCPeerConnection
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map()); // targetSocketId -> HTMLAudioElement

  // 1. Initialize local stream if voice chat is enabled
  useEffect(() => {
    if (!enabled) return;

    let active = true;

    async function initLocalStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        // Apply initial mute state
        stream.getAudioTracks().forEach(track => {
          track.enabled = !isMuted;
        });
        setMicError(false);
        console.log('🎙️ Local audio stream acquired successfully.');
      } catch (err: any) {
        console.error('❌ Failed to get local microphone stream:', err);
        setMicError(true);
      }
    }

    initLocalStream();

    return () => {
      active = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
    };
  }, [enabled]);

  // Apply mute changes to local tracks
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // 2. Handle signaling events
  useEffect(() => {
    if (!socket || !enabled) return;

    const handleVoiceSignal = async ({
      senderSocketId,
      signal,
    }: {
      senderSocketId: string;
      signal: any;
    }) => {
      try {
        // If we don't have a peer connection yet, create one
        let pc = peersRef.current.get(senderSocketId);
        if (!pc) {
          pc = createPeerConnection(senderSocketId);
        }

        if (signal.type === 'offer') {
          console.log(`🎙️ Received SDP offer from peer socket ${senderSocketId}`);
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          
          // Add local tracks if not already added
          const senders = pc.getSenders();
          if (senders.length === 0 && localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
              pc!.addTrack(track, localStreamRef.current!);
            });
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('voice_signal', {
            roomCode,
            targetSocketId: senderSocketId,
            signal: { type: 'answer', sdp: answer },
          });
        } else if (signal.type === 'answer') {
          console.log(`🎙️ Received SDP answer from peer socket ${senderSocketId}`);
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === 'candidate' && signal.candidate) {
          console.log(`🎙️ Received ICE candidate from peer socket ${senderSocketId}`);
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error('Error handling WebRTC voice signal:', err);
      }
    };

    socket.on('voice_signal_received', handleVoiceSignal);

    return () => {
      socket.off('voice_signal_received', handleVoiceSignal);
    };
  }, [socket, roomCode, enabled]);

  // 3. Monitor players list to establish/close connections
  useEffect(() => {
    if (!socket || !enabled) {
      // Cleanup all connections if disabled
      cleanupAllPeers();
      return;
    }

    const activeSocketIds = new Set<string>();

    players.forEach(player => {
      // We don't connect to ourselves, bots, or players without socket IDs
      if (player.id === currentUserId || player.isBot || !player.socketId || player.socketId === 'BOT_SOCKET') {
        return;
      }

      activeSocketIds.add(player.socketId);

      // If connection doesn't exist, check if we should initiate it
      if (!peersRef.current.has(player.socketId)) {
        // Deterministic connection initiation: player with alphabetically larger ID initiates
        const shouldInitiate = currentUserId > player.id;
        const pc = createPeerConnection(player.socketId);

        if (shouldInitiate) {
          console.log(`🎙️ Initiating voice connection with ${player.username} (${player.socketId})`);
          // Start negotiation
          initiateCall(player.socketId, pc);
        } else {
          console.log(`🎙️ Registered receiver slot for ${player.username} (${player.socketId})`);
        }
      }
    });

    // Cleanup peers who left the room
    peersRef.current.forEach((_, socketId) => {
      if (!activeSocketIds.has(socketId)) {
        console.log(`🎙️ Closing connection for peer socket ${socketId} (player left)`);
        cleanupPeer(socketId);
      }
    });

  }, [players, enabled, socket, currentUserId]);

  // Clean up all connections on unmount
  useEffect(() => {
    return () => {
      cleanupAllPeers();
    };
  }, []);

  // --- Helper Functions ---

  const createPeerConnection = (targetSocketId: string): RTCPeerConnection => {
    if (peersRef.current.has(targetSocketId)) {
      return peersRef.current.get(targetSocketId)!;
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peersRef.current.set(targetSocketId, pc);

    // Track state logging
    pc.onconnectionstatechange = () => {
      console.log(`🎙️ WebRTC Connection State with socket ${targetSocketId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        cleanupPeer(targetSocketId);
      }
    };

    // Forward ICE candidates to peer
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('voice_signal', {
          roomCode,
          targetSocketId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    // Play remote track on track event
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      console.log(`🎙️ Remote stream track received from socket ${targetSocketId}`);

      let audio = audioElementsRef.current.get(targetSocketId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audioElementsRef.current.set(targetSocketId, audio);
      }
      audio.srcObject = remoteStream;
      audio.play().catch(e => console.error('Error playing remote audio:', e));
    };

    return pc;
  };

  const initiateCall = async (targetSocketId: string, pc: RTCPeerConnection) => {
    try {
      // Add local audio tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (socket) {
        socket.emit('voice_signal', {
          roomCode,
          targetSocketId,
          signal: { type: 'offer', sdp: offer },
        });
      }
    } catch (err) {
      console.error(`Failed to initiate voice call to socket ${targetSocketId}:`, err);
    }
  };

  const cleanupPeer = (socketId: string) => {
    const pc = peersRef.current.get(socketId);
    if (pc) {
      pc.close();
      peersRef.current.delete(socketId);
    }

    const audio = audioElementsRef.current.get(socketId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audioElementsRef.current.delete(socketId);
    }
  };

  const cleanupAllPeers = () => {
    peersRef.current.forEach((_, socketId) => {
      cleanupPeer(socketId);
    });
    peersRef.current.clear();
    audioElementsRef.current.clear();
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  return {
    isMuted,
    toggleMute,
    micError,
  };
}
