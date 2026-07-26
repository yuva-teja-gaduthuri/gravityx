'use client';

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { Trophy, Timer, Play, ShieldAlert, Sparkles, Volume2, VolumeX, Settings, Eye, Heart, UserPlus, MessageSquare, X, Maximize, Minimize } from 'lucide-react';
import { getApiUrl } from '../utils/api';
import { useTranslation } from '../hooks/useTranslation';

interface LudoToken {
  id: number;
  position: number;
}

interface LudoPlayer {
  id: string;
  username: string;
  socketId: string;
  color: 'red' | 'green' | 'yellow' | 'blue';
  tokens: LudoToken[];
  isWinner: boolean;
  placement?: number;
}

interface LudoState {
  players: LudoPlayer[];
  activePlayerIndex: number;
  diceValue: number | null;
  hasRolled: boolean;
  turnTimeLeft: number;
}

interface LudoGameProps {
  roomCode: string;
  user: { id: string; username: string; isGuest?: boolean };
  socket: Socket;
  isHost: boolean;
  matchEndedData?: any;
  onReturnToLobby?: () => void;
}

// Map 52 outer track indexes to [col, row] indexes (0-based) on a 15x15 grid
const TRACK_COORDINATES: { [idx: number]: [number, number] } = {
  0: [1, 6], 1: [2, 6], 2: [3, 6], 3: [4, 6], 4: [5, 6],
  5: [6, 5], 6: [6, 4], 7: [6, 3], 8: [6, 2], 9: [6, 1], 10: [6, 0],
  11: [7, 0],
  12: [8, 0], 13: [8, 1], 14: [8, 2], 15: [8, 3], 16: [8, 4], 17: [8, 5],
  18: [9, 6], 19: [10, 6], 20: [11, 6], 21: [12, 6], 22: [13, 6], 23: [14, 6],
  24: [14, 7],
  25: [14, 8], 26: [13, 8], 27: [12, 8], 28: [11, 8], 29: [10, 8], 30: [9, 8],
  31: [8, 9], 32: [8, 10], 33: [8, 11], 34: [8, 12], 35: [8, 13], 36: [8, 14],
  37: [7, 14],
  38: [6, 14], 39: [6, 13], 40: [6, 12], 41: [6, 11], 42: [6, 10], 43: [6, 9],
  44: [5, 8], 45: [4, 8], 46: [3, 8], 47: [2, 8], 48: [1, 8], 49: [0, 8],
  50: [0, 7],
  51: [0, 6],
};

const STRETCH_COORDINATES: { [color: string]: { [idx: number]: [number, number] } } = {
  red: {
    52: [1, 7], 53: [2, 7], 54: [3, 7], 55: [4, 7], 56: [5, 7], 57: [6, 7], 58: [7, 7]
  },
  green: {
    52: [7, 1], 53: [7, 2], 54: [7, 3], 55: [7, 4], 56: [7, 5], 57: [7, 6], 58: [7, 7]
  },
  yellow: {
    52: [13, 7], 53: [12, 7], 54: [11, 7], 55: [10, 7], 56: [9, 7], 57: [8, 7], 58: [7, 7]
  },
  blue: {
    52: [7, 13], 53: [7, 12], 54: [7, 11], 55: [7, 10], 56: [7, 9], 57: [7, 8], 58: [7, 7]
  }
};

const BASE_COORDINATES: { [color: string]: [number, number][] } = {
  red: [[2, 2], [3, 2], [2, 3], [3, 3]],
  green: [[11, 2], [12, 2], [11, 3], [12, 3]],
  yellow: [[11, 11], [12, 11], [11, 12], [12, 12]],
  blue: [[2, 11], [3, 11], [2, 12], [3, 12]]
};

const COLOR_CONFIGS: { [color: string]: { startCell: number; lastCell: number; stretchStart: number } } = {
  red: { startCell: 0, lastCell: 50, stretchStart: 52 },
  green: { startCell: 13, lastCell: 11, stretchStart: 52 },
  yellow: { startCell: 26, lastCell: 24, stretchStart: 52 },
  blue: { startCell: 39, lastCell: 37, stretchStart: 52 },
};

const SAFE_CELLS = [0, 8, 13, 21, 26, 34, 39, 47];

// Web Audio API dynamic audio synthesizer
class LudoAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  setMute(muted: boolean) {
    this.isMuted = muted;
  }

  private init() {
    if (this.isMuted) return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playRoll() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.6);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.6);
  }

  playImpact() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(75, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.2);
    
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playStep() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.07);
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playCapture() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.45);
    
    oscGain.gain.setValueAtTime(0.15, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.45);
    
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    noise.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    
    noise.start(now);
    noise.stop(now + 0.4);
  }

  playHome() {
    if (this.isMuted) return;
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);
      
      gain.gain.setValueAtTime(0.14, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.22);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(noteTime);
      osc.stop(noteTime + 0.22);
    });
  }

  playTurn() {
    if (this.isMuted) return;
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [440, 554.37];
    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);
      
      gain.gain.setValueAtTime(0.07, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.18);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(noteTime);
      osc.stop(noteTime + 0.18);
    });
  }

  playSelect() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.06);
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  shape: 'circle' | 'star' | 'square';
}

interface VisualToken {
  col: number;
  row: number;
  scale: number;
  rotation: number;
  translateY: number;
  isMoving: boolean;
  isCaptured: boolean;
}

export default function LudoGame({ roomCode, user, socket, isHost, matchEndedData, onReturnToLobby }: LudoGameProps) {
  const { t } = useTranslation();
  const [gameState, setGameState] = useState<LudoState | null>(null);
  const [validTokens, setValidTokens] = useState<number[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [rollingValue, setRollingValue] = useState<number>(1);
  const [matchEnded, setMatchEnded] = useState(false);
  const [scoreboard, setScoreboard] = useState<any[]>([]);

  // Social Stats States
  const [likesMap, setLikesMap] = useState<{[username: string]: number}>({});
  const [friendStatus, setFriendStatus] = useState<{[username: string]: string}>({});
  const [reviewModalUser, setReviewModalUser] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Accessibility & Polish Settings
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isCameraShakeMuted, setIsCameraShakeMuted] = useState(false);
  const [isParticlesMuted, setIsParticlesMuted] = useState(false);
  const [isSpeedUp, setIsSpeedUp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Animation states
  const [visualTokens, setVisualTokens] = useState<{ [key: string]: VisualToken }>({});
  const [comicText, setComicText] = useState<{ text: string; col: number; row: number } | null>(null);
  const [luckySix, setLuckySix] = useState(false);
  const [yourTurnAlert, setYourTurnAlert] = useState(false);
  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const [camZoom, setCamZoom] = useState(1.0);
  const [camX, setCamX] = useState(0);
  const [camY, setCamY] = useState(0);
  const [eliminatedKey, setEliminatedKey] = useState<string | null>(null);
  const [winnerKey, setWinnerKey] = useState<string | null>(null);

  // Audio and Canvas references
  const audioRef = useRef<LudoAudioEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  // Initialize Audio Engine once
  if (!audioRef.current) {
    audioRef.current = new LudoAudioEngine();
  }

  useEffect(() => {
    audioRef.current?.setMute(isAudioMuted);
  }, [isAudioMuted]);

  // Sync initial visual tokens when game state is loaded/loaded
  useEffect(() => {
    if (!gameState) return;
    const initialVisuals: { [key: string]: VisualToken } = {};
    gameState.players.forEach((p) => {
      p.tokens.forEach((t) => {
        const key = `${p.color}-${t.id}`;
        // Snap visual token to state coordinate if not currently in move animation
        if (!visualTokens[key]?.isMoving && !visualTokens[key]?.isCaptured) {
          const [col, row] = getTokenCoords(p.color, t.id, t.position);
          initialVisuals[key] = {
            col,
            row,
            scale: 1.0,
            rotation: 0,
            translateY: 0,
            isMoving: false,
            isCaptured: false
          };
        }
      });
    });

    setVisualTokens((prev) => ({ ...prev, ...initialVisuals }));
  }, [gameState]);

  // Canvas particle loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const updateParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.alpha = 1 - p.life / p.maxLife;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        if (p.shape === 'star') {
          // Draw star shape
          ctx.beginPath();
          for (let j = 0; j < 5; j++) {
            ctx.lineTo(
              p.x + Math.cos(((18 + j * 72) * Math.PI) / 180) * p.size,
              p.y - Math.sin(((18 + j * 72) * Math.PI) / 180) * p.size
            );
            ctx.lineTo(
              p.x + Math.cos(((54 + j * 72) * Math.PI) / 180) * (p.size / 2),
              p.y - Math.sin(((54 + j * 72) * Math.PI) / 180) * (p.size / 2)
            );
          }
          ctx.closePath();
          ctx.fill();
        } else if (p.shape === 'square') {
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }

      animId = requestAnimationFrame(updateParticles);
    };

    updateParticles();

    return () => cancelAnimationFrame(animId);
  }, []);

  // Sync canvas dimensions
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Emit particle helper
  const spawnParticles = (col: number, row: number, type: 'dust' | 'sparkle' | 'confetti' | 'smoke', count = 4, customColor?: string) => {
    if (isParticlesMuted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cellW = canvas.width / 15;
    const cellH = canvas.height / 15;
    const startX = (col + 0.5) * cellW;
    const startY = (row + 0.5) * cellH;

    const particles = particlesRef.current;

    for (let i = 0; i < count; i++) {
      let vx = (Math.random() - 0.5) * 4;
      let vy = (Math.random() - 0.5) * 4;
      let size = Math.random() * 3 + 2;
      let maxLife = Math.random() * 20 + 15;
      let color = customColor || 'rgba(255, 255, 255, 0.7)';
      let shape: 'circle' | 'star' | 'square' = 'circle';

      if (type === 'sparkle') {
        shape = 'star';
        color = customColor || 'rgba(0, 245, 255, 0.8)';
        vx = (Math.random() - 0.5) * 6;
        vy = (Math.random() - 0.5) * 6;
        size = Math.random() * 4 + 4;
      } else if (type === 'confetti') {
        shape = 'square';
        const colors = ['#00F5FF', '#FF5EDF', '#FFD54F', '#00D084', '#6C63FF'];
        color = colors[Math.floor(Math.random() * colors.length)];
        vx = (Math.random() - 0.5) * 5;
        vy = -Math.random() * 6 - 2; // shoot upwards
        size = Math.random() * 5 + 4;
        maxLife = Math.random() * 40 + 30;
      } else if (type === 'smoke') {
        shape = 'circle';
        color = 'rgba(150, 150, 150, 0.4)';
        size = Math.random() * 8 + 8;
        maxLife = Math.random() * 25 + 20;
        vx = (Math.random() - 0.5) * 2;
        vy = (Math.random() - 0.5) * 2;
      }

      particles.push({
        x: startX,
        y: startY,
        vx,
        vy,
        color,
        size,
        alpha: 1,
        life: 0,
        maxLife,
        shape
      });
    }
  };

  const triggerFireworks = (col: number, row: number) => {
    const colors = ['#FFD54F', '#FF5EDF', '#00F5FF', '#00D084'];
    colors.forEach((color) => {
      spawnParticles(col, row, 'sparkle', 12, color);
    });
  };

  // Calculate Ludo track position array path
  const getPathPositions = (color: string, startPos: number, endPos: number): number[] => {
    if (startPos === -1) {
      const startCell = COLOR_CONFIGS[color].startCell;
      return [startCell];
    }
    
    const path: number[] = [];
    const config = COLOR_CONFIGS[color];
    let temp = startPos;
    let enteredStretch = startPos >= 52;
    
    for (let i = 0; i < 10; i++) {
      if (temp === endPos) break;
      
      if (temp === config.lastCell) {
        temp = config.stretchStart;
        enteredStretch = true;
      } else if (enteredStretch) {
        temp += 1;
      } else {
        temp = (temp + 1) % 52;
      }
      path.push(temp);
    }
    return path;
  };

  // Handlers for step-by-step walking animations
  const animatePawnPath = (
    color: 'red' | 'green' | 'yellow' | 'blue',
    tokenId: number,
    path: number[],
    captured: boolean,
    finalPlayersState: any
  ) => {
    const key = `${color}-${tokenId}`;
    let stepIndex = 0;
    const intervalTime = isSpeedUp ? 130 : 260;

    const takeStep = () => {
      if (stepIndex >= path.length) {
        // Landing rebound
        setVisualTokens(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            scale: 1.25,
            translateY: 0,
            isMoving: false
          }
        }));

        setTimeout(() => {
          setVisualTokens(prev => ({
            ...prev,
            [key]: {
              ...prev[key],
              scale: 1.0
            }
          }));
        }, 120);

        audioRef.current?.playImpact();

        const finalPos = path[path.length - 1];
        
        // Spawn sparkles on land
        spawnParticles(visualTokens[key]?.col || 7, visualTokens[key]?.row || 7, 'sparkle', 6);

        // Home entry visual celebration
        if (finalPos === 58) {
          audioRef.current?.playHome();
          triggerFireworks(7, 7);
          confetti({ particleCount: 50, spread: 60, origin: { x: 0.5, y: 0.5 } });
        }

        if (captured) {
          setWinnerKey(key);
          handleCaptureAnimation(finalPos, finalPlayersState);
        } else {
          setGameState(prev => prev ? { ...prev, players: finalPlayersState, diceValue: null, hasRolled: false } : null);
          setValidTokens([]);
          setCamZoom(1.0);
          setCamX(0);
          setCamY(0);
        }
        return;
      }

      const nextPos = path[stepIndex];
      const [col, row] = getTokenCoords(color, tokenId, nextPos);

      // Track walking pawn with dynamic camera
      const camTargetX = (7 - col) * 12;
      const camTargetY = (7 - row) * 12;
      setCamZoom(1.18);
      setCamX(camTargetX);
      setCamY(camTargetY);

      // Orientation turn rotation
      const currentVisual = visualTokens[key];
      const startX = currentVisual ? currentVisual.col : BASE_COORDINATES[color][tokenId][0];
      const startY = currentVisual ? currentVisual.row : BASE_COORDINATES[color][tokenId][1];
      const dx = col - startX;
      const dy = row - startY;
      let rotation = 0;
      if (dx > 0) rotation = 0;
      else if (dx < 0) rotation = 180;
      else if (dy > 0) rotation = 90;
      else if (dy < 0) rotation = 270;

      setVisualTokens(prev => ({
        ...prev,
        [key]: {
          col,
          row,
          scale: 1.15,
          rotation,
          translateY: -16, // lift up
          isMoving: true,
          isCaptured: false
        }
      }));

      audioRef.current?.playStep();
      spawnParticles(col, row, 'dust', 3);

      setTimeout(() => {
        setVisualTokens(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            translateY: 0,
            scale: 1.0
          }
        }));
      }, intervalTime / 2);

      stepIndex++;
      setTimeout(takeStep, intervalTime);
    };

    takeStep();
  };

  // Opponent captures walking loop
  const handleCaptureAnimation = (capturePos: number, finalPlayersState: any) => {
    if (!gameState) return;
    const activePlayer = gameState.players[gameState.activePlayerIndex];

    let capturedKey = '';
    let targetBaseCoords: [number, number] = [0, 0];
    let opponentColor = '';

    gameState.players.forEach((p) => {
      if (p.id === activePlayer.id) return;
      p.tokens.forEach((t) => {
        const finalP = finalPlayersState.find((fp: any) => fp.id === p.id);
        const finalT = finalP?.tokens.find((ft: any) => ft.id === t.id);
        if (t.position === capturePos && finalT?.position === -1) {
          capturedKey = `${p.color}-${t.id}`;
          opponentColor = p.color;
          targetBaseCoords = BASE_COORDINATES[p.color][t.id];
        }
      });
    });

    if (capturedKey) {
      setEliminatedKey(capturedKey);
      if (!isCameraShakeMuted) {
        setIsScreenShaking(true);
        setTimeout(() => setIsScreenShaking(false), 500);
      }

      audioRef.current?.playCapture();

      const [col, row] = TRACK_COORDINATES[capturePos] || [7, 7];
      
      // Zoom camera on capture conflict tile
      const camTargetX = (7 - col) * 14;
      const camTargetY = (7 - row) * 14;
      setCamZoom(1.3);
      setCamX(camTargetX);
      setCamY(camTargetY);
      
      // Spawn capture explosions and smoke
      spawnParticles(col, row, 'smoke', 12);
      triggerFireworks(col, row);

      setComicText({ text: 'BOOM!', col, row });
      setTimeout(() => setComicText(null), 1200);

      // Slide and spin captured token back to its yard base
      setVisualTokens((prev) => ({
        ...prev,
        [capturedKey]: {
          ...prev[capturedKey],
          isCaptured: true,
          rotation: 360
        }
      }));

      let progress = 0;
      const slideDuration = 900;
      const slideInterval = 30;
      const startCoords = [visualTokens[capturedKey]?.col || col, visualTokens[capturedKey]?.row || row];
      const endCoords = targetBaseCoords;

      const slideTimer = setInterval(() => {
        progress += slideInterval;
        const ratio = progress / slideDuration;

        if (ratio >= 1) {
          clearInterval(slideTimer);
          setVisualTokens((prev) => ({
            ...prev,
            [capturedKey]: {
              col: endCoords[0],
              row: endCoords[1],
              scale: 1.0,
              rotation: 0,
              translateY: 0,
              isMoving: false,
              isCaptured: false
            }
          }));

          setGameState((prev) => prev ? { ...prev, players: finalPlayersState, diceValue: null, hasRolled: false } : null);
          setValidTokens([]);
          setEliminatedKey(null);
          setWinnerKey(null);
          setCamZoom(1.0);
          setCamX(0);
          setCamY(0);
        } else {
          // Linear interpolation for coordinate mapping
          const interpCol = startCoords[0] + (endCoords[0] - startCoords[0]) * ratio;
          const interpRow = startCoords[1] + (endCoords[1] - startCoords[1]) * ratio;

          setVisualTokens((prev) => ({
            ...prev,
            [capturedKey]: {
              ...prev[capturedKey],
              col: interpCol,
              row: interpRow,
              rotation: prev[capturedKey].rotation + 35
            }
          }));

          // Emit trail smoke while sliding
          if (Math.random() > 0.6) {
            spawnParticles(Math.floor(interpCol), Math.floor(interpRow), 'smoke', 2);
          }
        }
      }, slideInterval);
    } else {
      setGameState((prev) => prev ? { ...prev, players: finalPlayersState, diceValue: null, hasRolled: false } : null);
      setValidTokens([]);
      setEliminatedKey(null);
      setWinnerKey(null);
      setCamZoom(1.0);
      setCamX(0);
      setCamY(0);
    }
  };

  const gameStateRef = useRef<LudoState | null>(null);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    socket.on('ludo_game_started', (data: any) => {
      setGameState(data.gameState);
      setMatchEnded(false);
      setScoreboard([]);
      setValidTokens([]);
    });

    socket.on('ludo_state_sync', (state: LudoState) => {
      setGameState(state);
    });

    socket.on('ludo_timer_tick', (timeLeft: number) => {
      setGameState(prev => prev ? { ...prev, turnTimeLeft: timeLeft } : null);
    });

    socket.on('ludo_dice_rolled', (data: any) => {
      setIsRolling(true);
      audioRef.current?.playRoll();

      // Simulate dice rotation cycle
      let count = 0;
      const interval = setInterval(() => {
        setRollingValue(Math.floor(Math.random() * 6) + 1);
        count++;
        if (count > 12) {
          clearInterval(interval);
          setIsRolling(false);
          setRollingValue(data.diceValue);

          // Dice thud sound
          audioRef.current?.playImpact();

          // Rule: Lucky 6 visual alert
          if (data.diceValue === 6) {
            setLuckySix(true);
            setTimeout(() => setLuckySix(false), 1500);
            // Spawn fireworks around dice console
            triggerFireworks(12, 12);
          }

          setGameState(prev => prev ? { ...prev, diceValue: data.diceValue, hasRolled: true } : null);
          
          const currentGS = gameStateRef.current;
          const isMyTurnNow = currentGS?.players[currentGS.activePlayerIndex]?.id === user.id;
          if (isMyTurnNow) {
            setValidTokens(data.validTokens);
          }
        }
      }, 70);
    });

    socket.on('ludo_token_moved', (data: any) => {
      const currentGS = gameStateRef.current;
      if (!currentGS) return;
      const activePlayer = currentGS.players[currentGS.activePlayerIndex];
      
      const currentToken = activePlayer.tokens.find(t => t.id === data.tokenId);
      const startPos = currentToken ? currentToken.position : -1;
      const endPos = data.newPosition;

      // Build path sequence
      const path = getPathPositions(activePlayer.color, startPos, endPos);
      
      // Animate movement walk
      animatePawnPath(activePlayer.color, data.tokenId, path, data.captured, data.players);
    });

    socket.on('ludo_new_turn', (data: any) => {
      setGameState(prev => prev ? { 
        ...prev, 
        activePlayerIndex: data.activePlayerIndex,
        diceValue: null,
        hasRolled: false
      } : null);
      setValidTokens([]);

      // Play turn transitions chime
      const currentGS = gameStateRef.current;
      const nextActivePlayer = currentGS?.players[data.activePlayerIndex];
      if (nextActivePlayer && nextActivePlayer.id === user.id) {
        audioRef.current?.playTurn();
        setYourTurnAlert(true);
        setTimeout(() => setYourTurnAlert(false), 1500);
      }
    });

    socket.on('ludo_match_ended', (data: any) => {
      setMatchEnded(true);
      setScoreboard(data.scoreboard);
      confetti({ particleCount: 200, spread: 90 });
    });

    // Sync room deck state
    socket.emit('ludo_sync_state', roomCode);

    return () => {
      socket.off('ludo_game_started');
      socket.off('ludo_state_sync');
      socket.off('ludo_timer_tick');
      socket.off('ludo_dice_rolled');
      socket.off('ludo_token_moved');
      socket.off('ludo_new_turn');
      socket.off('ludo_match_ended');
    };
  }, [socket, roomCode, user.id]);

  // Sync match ended data on mount/change
  useEffect(() => {
    if (matchEndedData) {
      setMatchEnded(true);
      setScoreboard(matchEndedData.scoreboard || []);
    }
  }, [matchEndedData]);

  // Load initial likes when scoreboard changes
  useEffect(() => {
    if (matchEnded && scoreboard.length > 0) {
      const fetchLikes = async () => {
        const token = localStorage.getItem('gravityx_token');
        const initialLikes: {[username: string]: number} = {};
        for (const row of scoreboard) {
          try {
            const res = await fetch(getApiUrl(`/api/social/likes/${row.username}`), {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const data = await res.json();
              initialLikes[row.username] = data.likesCount;
            } else {
              initialLikes[row.username] = 15;
            }
          } catch (e) {
            initialLikes[row.username] = 15;
          }
        }
        setLikesMap(initialLikes);
      };
      fetchLikes();
    }
  }, [matchEnded, scoreboard]);

  // Fullscreen state listeners
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          setIsFullscreen(false);
        });
      }
    }
  };

  const handleLike = async (username: string) => {
    try {
      const token = localStorage.getItem('gravityx_token');
      const res = await fetch(getApiUrl('/api/social/like'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetUsername: username })
      });
      if (res.ok) {
        const data = await res.json();
        setLikesMap(prev => ({ ...prev, [username]: data.likesCount }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveReview = async (username: string) => {
    if (user.isGuest) return;
    try {
      const token = localStorage.getItem('gravityx_token');
      const res = await fetch(getApiUrl('/api/social/review'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUsername: username,
          rating: reviewRating,
          comment: reviewComment
        })
      });
      if (res.ok) {
        setReviewModalUser(null);
        setReviewComment('');
        setReviewRating(5);
        alert(`Feedback saved successfully for ${username}!`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddFriendClick = async (friendUsername: string) => {
    try {
      setFriendStatus(prev => ({ ...prev, [friendUsername]: 'sending' }));
      const token = localStorage.getItem('gravityx_token');
      const res = await fetch(getApiUrl('/api/social/request'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ friendUsername })
      });
      if (res.ok) {
        setFriendStatus(prev => ({ ...prev, [friendUsername]: 'sent' }));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send friend request');
        setFriendStatus(prev => ({ ...prev, [friendUsername]: 'error' }));
      }
    } catch (err) {
      console.error(err);
      setFriendStatus(prev => ({ ...prev, [friendUsername]: 'error' }));
    }
  };

  const handleRollDice = () => {
    if (!gameState) return;
    const activePlayer = gameState.players[gameState.activePlayerIndex];
    if (activePlayer.id !== user.id) return;
    if (gameState.hasRolled || isRolling) return;

    socket.emit('ludo_roll_dice', roomCode);
  };

  const handleMoveToken = (tokenId: number) => {
    if (!gameState) return;
    const activePlayer = gameState.players[gameState.activePlayerIndex];
    if (activePlayer.id !== user.id) return;
    if (!validTokens.includes(tokenId)) return;

    audioRef.current?.playSelect();
    socket.emit('ludo_move_token', { roomCode, tokenId });
  };

  if (!gameState) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <p className="text-sm font-bold text-gray-500 animate-pulse">Syncing Ludo Game state...</p>
      </div>
    );
  }

  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const isMyTurn = activePlayer.id === user.id;

  const getTokenCoords = (playerColor: string, tokenId: number, position: number): [number, number] => {
    if (position === -1) {
      return BASE_COORDINATES[playerColor][tokenId];
    } else if (position >= 0 && position <= 51) {
      return TRACK_COORDINATES[position];
    } else if (position >= 52 && position <= 58) {
      return STRETCH_COORDINATES[playerColor][position];
    }
    return [7, 7];
  };

  const renderBaseDice = (color: 'red' | 'green' | 'yellow' | 'blue') => {
    if (!gameState) return null;
    
    // Find if player exists in game
    const playerIndex = gameState.players.findIndex(p => p.color === color);
    if (playerIndex === -1) return null;
    
    const player = gameState.players[playerIndex];
    const isPlayerActive = gameState.activePlayerIndex === playerIndex;
    const isMyDice = player.id === user.id;
    const canIRoll = isPlayerActive && isMyDice && !gameState.hasRolled && !isRolling;
    
    // Position classes inside the base card
    let positionClass = '';
    if (color === 'red') positionClass = 'absolute bottom-2 right-2';
    else if (color === 'green') positionClass = 'absolute bottom-2 left-2';
    else if (color === 'blue') positionClass = 'absolute top-2 right-2';
    else if (color === 'yellow') positionClass = 'absolute top-2 left-2';

    // Dice colors matching the team
    let diceFaceBg = 'bg-cybererror';
    let dotBg = 'bg-white';
    if (color === 'green') { diceFaceBg = 'bg-cybersuccess'; }
    else if (color === 'yellow') { diceFaceBg = 'bg-[#fbc02d]'; dotBg = 'bg-[#1a0802]'; }
    else if (color === 'blue') { diceFaceBg = 'bg-cyberblue'; }

    const displayRollValue = isPlayerActive && isRolling ? rollingValue : (gameState.diceValue || 1);

    return (
      <div className={`${positionClass} z-20`}>
        {/* Glow backdrop for active dice */}
        {isPlayerActive && (
          <div className={`absolute inset-[-12px] rounded-2xl animate-pulse blur-md -z-10 ${
            color === 'red' ? 'bg-cybererror/40' :
            color === 'green' ? 'bg-cybersuccess/40' :
            color === 'yellow' ? 'bg-cybergold/40' : 'bg-cyberblue/40'
          }`} />
        )}
        
        <button
          onClick={handleRollDice}
          disabled={!canIRoll}
          className={`dice-scene select-none transition-all duration-300 ${
            canIRoll ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-default'
          }`}
          style={{
            pointerEvents: canIRoll ? 'auto' : 'none'
          }}
        >
          <div 
            className={`dice-cube ${isRolling && isPlayerActive ? 'animate-spin-slow' : ''}`}
            data-roll={displayRollValue}
          >
            {/* Face 1 */}
            <div className={`dice-face ${diceFaceBg} text-white flex items-center justify-center shadow-inner`} style={{ transform: 'rotateY(0deg) translateZ(calc(var(--dice-size) / 2))' }}>
              <span className={`w-2.5 h-2.5 rounded-full ${color === 'yellow' ? 'bg-[#1a0802]' : 'bg-white'} shadow-md`}></span>
            </div>
            {/* Face 6 */}
            <div className={`dice-face ${diceFaceBg} text-white shadow-inner`} style={{ transform: 'rotateY(180deg) translateZ(calc(var(--dice-size) / 2))' }}>
              <div className="grid grid-cols-2 gap-1.5 p-1 w-full h-full justify-items-center items-center">
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`}></span>
              </div>
            </div>
            {/* Face 2 */}
            <div className={`dice-face ${diceFaceBg} text-white shadow-inner`} style={{ transform: 'rotateY(90deg) translateZ(calc(var(--dice-size) / 2))' }}>
              <div className="flex flex-col justify-between p-1 w-full h-full">
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg} self-start`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg} self-end`}></span>
              </div>
            </div>
            {/* Face 5 */}
            <div className={`dice-face ${diceFaceBg} text-white shadow-inner`} style={{ transform: 'rotateY(-90deg) translateZ(calc(var(--dice-size) / 2))' }}>
              <div className="grid grid-cols-3 gap-1 p-1 w-full h-full items-center justify-items-center">
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg} col-start-1 col-end-2`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg} col-start-3 col-end-4`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg} col-start-2 col-end-3`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg} col-start-1 col-end-2`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg} col-start-3 col-end-4`}></span>
              </div>
            </div>
            {/* Face 3 */}
            <div className={`dice-face ${diceFaceBg} text-white shadow-inner`} style={{ transform: 'rotateX(90deg) translateZ(calc(var(--dice-size) / 2))' }}>
              <div className="flex flex-col justify-between p-1 w-full h-full items-center">
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg} self-start`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg} self-end`}></span>
              </div>
            </div>
            {/* Face 4 */}
            <div className={`dice-face ${diceFaceBg} text-white shadow-inner`} style={{ transform: 'rotateX(-90deg) translateZ(calc(var(--dice-size) / 2))' }}>
              <div className="grid grid-cols-2 gap-2 p-1 w-full h-full justify-items-center items-center">
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`}></span>
                <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`}></span>
              </div>
            </div>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-[92vh] w-full p-2 md:p-4 transition-all duration-100 select-none overflow-hidden ${
      isScreenShaking ? 'animate-shake' : ''
    }`}>
      
      {/* Premium AAA Ludo stylesheet override */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --dice-size: clamp(34px, 7.5vmin, 46px);
        }
        
        /* Premium Wood Frame */
        .wood-board-frame {
          background: linear-gradient(135deg, #402010 0%, #2c140a 50%, #1a0802 100%);
          border: clamp(6px, 1.8vmin, 12px) solid #52301c;
          box-shadow: 
            0 20px 40px rgba(0, 0, 0, 0.65),
            inset 0 3px 6px rgba(255, 255, 255, 0.08),
            inset 0 -3px 6px rgba(0, 0, 0, 0.5);
          border-radius: clamp(16px, 4vmin, 28px);
          overflow: hidden;
        }

        /* Wood Board Grid Cells */
        .wood-cell-default {
          background: #eedcb3; /* birch wood color */
          border: 1px solid #dcd0b3;
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.45), inset 0 -1px 2px rgba(0,0,0,0.06);
        }

        /* Wood base yard panels */
        .wood-base-yard {
          background: #dfc8a5;
          border: clamp(2px, 0.5vmin, 4px) solid #bfa57b;
          border-radius: clamp(8px, 2.5vmin, 16px);
          box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        /* Spotlight & Reflection overlay */
        .spotlight-overlay {
          background: radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.14) 0%, rgba(0, 0, 0, 0.3) 100%);
          mix-blend-mode: overlay;
        }
        .reflection-overlay {
          background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 45%, rgba(255,255,255,0.03) 100%);
        }

        /* 3D Dice styling */
        .dice-scene {
          perspective: 300px;
          width: var(--dice-size);
          height: var(--dice-size);
        }

        .dice-cube {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 1s cubic-bezier(0.2, 0.8, 0.3, 1);
        }

        .dice-face {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: clamp(4px, 1.2vmin, 8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0,0,0,0.3);
        }

        /* Roll positions using responsive variable calc */
        .dice-cube[data-roll="1"] { transform: rotateX(0deg) rotateY(0deg); }
        .dice-cube[data-roll="6"] { transform: rotateX(180deg) rotateY(0deg); }
        .dice-cube[data-roll="3"] { transform: rotateX(-90deg) rotateY(0deg); }
        .dice-cube[data-roll="4"] { transform: rotateX(90deg) rotateY(0deg); }
        .dice-cube[data-roll="2"] { transform: rotateX(0deg) rotateY(90deg); }
        .dice-cube[data-roll="5"] { transform: rotateX(0deg) rotateY(-90deg); }

        /* Character Styles */
        .pawn-character {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pawn-shadow {
          position: absolute;
          bottom: 2px;
          width: 75%;
          height: 4px;
          background: rgba(0, 0, 0, 0.45);
          border-radius: 50%;
          filter: blur(1px);
          transform: translateZ(-1px);
        }

        .pawn-body-wrapper {
          position: absolute;
          bottom: 4px;
          width: 100%;
          height: 125%;
          display: flex;
          flex-direction: column;
          align-items: center;
          transform-origin: bottom center;
        }

        /* Head */
        .pawn-head {
          position: relative;
          width: clamp(14px, 3.5vmin, 22px);
          height: clamp(14px, 3.5vmin, 22px);
          background: #ffdbac;
          border-radius: 50%;
          z-index: 10;
          box-shadow: inset -1.5px -1.5px 4px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.2);
        }

        /* Eyes */
        .pawn-eyes {
          position: absolute;
          top: 30%;
          left: 15%;
          right: 15%;
          display: flex;
          justify-content: space-between;
        }

        .pawn-eye {
          width: 28%;
          height: 28%;
          background: #fff;
          border-radius: 50%;
          position: relative;
          overflow: hidden;
          animation: blink 4s infinite;
        }

        .pawn-pupil {
          width: 60%;
          height: 60%;
          background: #1c0e07;
          border-radius: 50%;
          position: absolute;
          top: 20%;
          left: 20%;
        }

        @keyframes blink {
          0%, 95%, 100% { transform: scaleY(1); }
          97% { transform: scaleY(0.1); }
        }

        .pawn-mouth {
          position: absolute;
          bottom: 15%;
          left: 50%;
          transform: translateX(-50%);
          width: 32%;
          height: 16%;
          background: #731212;
          border-radius: 0 0 100px 100px;
        }

        /* Red Team: Warrior */
        .team-red .pawn-head { background: #ffd1a9; }
        .warrior-hair {
          position: absolute;
          top: -30%;
          left: -10%;
          width: 120%;
          height: 60%;
          background: #2a1810;
          border-radius: 100px 100px 0 0;
        }
        .warrior-hair::after {
          content: '';
          position: absolute;
          top: -40%;
          left: 35%;
          border-left: clamp(3px, 0.8vmin, 5px) solid transparent;
          border-right: clamp(3px, 0.8vmin, 5px) solid transparent;
          border-bottom: clamp(5px, 1.2vmin, 8px) solid #ef4444;
        }
        .team-red .pawn-outfit {
          position: relative;
          width: 80%;
          height: 80%;
          background: #ef4444;
          border-radius: clamp(3px, 0.8vmin, 6px);
          margin-top: -15%;
          border: 1px solid #991b1b;
          box-shadow: inset 0 1px 2px rgba(255,255,255,0.2);
        }
        .pawn-cape {
          position: absolute;
          top: 0;
          left: -10%;
          width: 120%;
          height: 110%;
          background: #b91c1c;
          border-radius: clamp(2px, 0.5vmin, 4px);
          transform: rotateX(15deg);
          z-index: -1;
          transform-origin: top center;
        }

        /* Blue Team: Adventurer */
        .team-blue .pawn-head { background: #ffe0bd; }
        .adventurer-hat {
          position: absolute;
          top: -40%;
          left: -20%;
          width: 140%;
          height: 50%;
          background: #8d6e63;
          border-radius: clamp(3px, 0.8vmin, 6px) clamp(3px, 0.8vmin, 6px) 2px 2px;
        }
        .adventurer-hat::after {
          content: '';
          position: absolute;
          bottom: -15%;
          left: -10%;
          width: 120%;
          height: 30%;
          background: #5d4037;
          border-radius: 100px;
        }
        .team-blue .pawn-outfit {
          position: relative;
          width: 80%;
          height: 80%;
          background: #3b82f6;
          border-radius: clamp(3px, 0.8vmin, 6px);
          margin-top: -15%;
          border: 1px solid #1d4ed8;
        }

        /* Green Team: Forest Explorer */
        .team-green .pawn-head { background: #ffd1a9; }
        .explorer-hat {
          position: absolute;
          top: -35%;
          left: -15%;
          width: 130%;
          height: 45%;
          background: #689f38;
          border-radius: 100px 100px 0 0;
        }
        .team-green .pawn-outfit {
          position: relative;
          width: 80%;
          height: 80%;
          background: #22c55e;
          border-radius: clamp(3px, 0.8vmin, 6px);
          margin-top: -15%;
          border: 1px solid #15803d;
        }

        /* Yellow Team: Champion */
        .team-yellow .pawn-head { background: #ffe0bd; }
        .champion-crown {
          position: absolute;
          top: -40%;
          left: 10%;
          width: 80%;
          height: 50%;
          background: #f59e0b;
          clip-path: polygon(0% 100%, 0% 20%, 25% 60%, 50% 0%, 75% 60%, 100% 20%, 100% 100%);
        }
        .team-yellow .pawn-outfit {
          position: relative;
          width: 80%;
          height: 80%;
          background: #eab308;
          border-radius: clamp(3px, 0.8vmin, 6px);
          margin-top: -15%;
          border: 1px solid #a16207;
        }
        .pawn-medal {
          position: absolute;
          top: 15%;
          left: 30%;
          width: 40%;
          height: 40%;
          background: #facc15;
          border-radius: 50%;
          border: 1px solid #ca8a04;
        }

        /* Limbs */
        .pawn-limbs {
          position: absolute;
          bottom: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .pawn-arm {
          position: absolute;
          top: 55%;
          width: 16%;
          height: 45%;
          background: inherit;
          border-radius: 100px;
          transform-origin: top center;
        }
        .left-arm { left: -10%; }
        .right-arm { right: -10%; }

        .pawn-leg {
          position: absolute;
          bottom: -20%;
          width: 22%;
          height: 35%;
          background: #3e2723;
          border-radius: 100px;
          transform-origin: top center;
        }
        .left-leg { left: 20%; }
        .right-leg { right: 20%; }

        /* Idle breathe cycle */
        .pawn-character.idle .pawn-body-wrapper {
          animation: breathe 3s infinite ease-in-out;
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04, 0.96); }
        }

        /* Walking loops */
        .pawn-character.walking .pawn-body-wrapper {
          animation: walk-bounce 0.22s infinite alternate ease-in-out;
        }
        .pawn-character.walking .left-leg {
          animation: walk-leg-l 0.22s infinite alternate linear;
        }
        .pawn-character.walking .right-leg {
          animation: walk-leg-r 0.22s infinite alternate linear;
        }
        .pawn-character.walking .left-arm {
          animation: walk-arm-l 0.22s infinite alternate linear;
        }
        .pawn-character.walking .right-arm {
          animation: walk-arm-r 0.22s infinite alternate linear;
        }

        @keyframes walk-bounce {
          0% { transform: translateY(0) rotate(3deg); }
          100% { transform: translateY(-5px) rotate(-3deg); }
        }
        @keyframes walk-leg-l {
          0% { transform: rotate(40deg); }
          100% { transform: rotate(-40deg); }
        }
        @keyframes walk-leg-r {
          0% { transform: rotate(-40deg); }
          100% { transform: rotate(40deg); }
        }
        @keyframes walk-arm-l {
          0% { transform: rotate(-35deg); }
          100% { transform: rotate(35deg); }
        }
        @keyframes walk-arm-r {
          0% { transform: rotate(35deg); }
          100% { transform: rotate(-35deg); }
        }

        /* Victory celebrations */
        .pawn-character.victory-dance .pawn-body-wrapper {
          animation: victory-jump 0.38s infinite alternate ease-out;
        }
        .pawn-character.victory-dance .left-arm {
          animation: victory-wave-l 0.18s infinite alternate linear;
        }
        .pawn-character.victory-dance .right-arm {
          animation: victory-wave-r 0.18s infinite alternate linear;
        }
        @keyframes victory-jump {
          0% { transform: translateY(0) scaleY(0.85); }
          100% { transform: translateY(-15px) scaleY(1.15); }
        }
        @keyframes victory-wave-l {
          0% { transform: rotate(110deg); }
          100% { transform: rotate(175deg); }
        }
        @keyframes victory-wave-r {
          0% { transform: rotate(-110deg); }
          100% { transform: rotate(-175deg); }
        }

        /* Dizzy stars on eliminated */
        .pawn-character.eliminated .pawn-body-wrapper {
          animation: faint-spin 1.1s forwards cubic-bezier(0.2, 0.9, 0.4, 1);
        }
        .pawn-character.eliminated::after {
          content: '💫';
          position: absolute;
          top: -15px;
          left: 50%;
          transform: translateX(-50%);
          font-size: clamp(8px, 2vmin, 12px);
          animation: dizzy-stars 1s infinite linear;
          z-index: 30;
        }
        @keyframes dizzy-stars {
          0% { transform: translateX(-50%) rotate(0deg); }
          100% { transform: translateX(-50%) rotate(360deg); }
        }
        @keyframes faint-spin {
          0% { transform: rotate(0) scale(1); }
          20% { transform: translateY(-20px) rotate(180deg) scale(1.3); }
          100% { transform: translateY(0) rotate(720deg) scale(0); opacity: 0; }
        }
      `}} />

      {/* Settings Panel Toggle */}
      <div className="absolute top-4 right-4 z-30">
        <button 
          onClick={() => setShowSettings(!showSettings)} 
          className="p-3 bg-white/5 border border-white/10 hover:border-cyberblue text-white rounded-xl transition-all"
        >
          <Settings size={18} />
        </button>
        {showSettings && (
          <div className="absolute right-0 mt-2 w-48 glass-panel border border-white/10 rounded-xl p-4 shadow-2xl space-y-3">
            <h5 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Aesthetics Config</h5>
            
            <button 
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              className="w-full flex items-center justify-between text-xs text-gray-300 hover:text-white"
            >
              <span>Sound Effects</span>
              {isAudioMuted ? <VolumeX size={14} className="text-cybererror" /> : <Volume2 size={14} className="text-cybersuccess" />}
            </button>

            <button 
              onClick={() => setIsCameraShakeMuted(!isCameraShakeMuted)}
              className="w-full flex items-center justify-between text-xs text-gray-300 hover:text-white"
            >
              <span>Screen Shake</span>
              {isCameraShakeMuted ? <span className="text-cybererror">OFF</span> : <span className="text-cybersuccess">ON</span>}
            </button>

            <button 
              onClick={() => setIsParticlesMuted(!isParticlesMuted)}
              className="w-full flex items-center justify-between text-xs text-gray-300 hover:text-white"
            >
              <span>Particles Density</span>
              {isParticlesMuted ? <span className="text-cybererror">Muted</span> : <span className="text-cybersuccess">AAA</span>}
            </button>

            <button 
              onClick={() => setIsSpeedUp(!isSpeedUp)}
              className="w-full flex items-center justify-between text-xs text-gray-300 hover:text-white"
            >
              <span>Walking Speed</span>
              {isSpeedUp ? <span className="text-cyberblue font-bold">Fast x2</span> : <span className="text-gray-500">Normal</span>}
            </button>
          </div>
        )}
      </div>

      {/* Floating Notifications */}
      {luckySix && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-cybergold to-amber-500 text-darkbg px-6 py-2.5 rounded-full font-black text-sm uppercase tracking-widest border border-white/40 shadow-[0_0_20px_rgba(255,213,79,0.6)] animate-bounce select-none">
          🔥 LUCKY SIX! 🔥
        </div>
      )}

      {yourTurnAlert && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-cyberblue to-blue-500 text-white px-6 py-2.5 rounded-full font-black text-sm uppercase tracking-widest border border-white/20 shadow-neon-blue animate-pulse select-none">
          ⚡ YOUR TURN! ⚡
        </div>
      )}

      {/* Glassmorphic Top Telemetry Overlay */}
      <div className="w-full max-w-[680px] glass-panel rounded-2xl p-4 border border-white/10 mb-4 flex items-center justify-between shadow-2xl relative overflow-hidden z-20">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border border-white/10 uppercase transition-all duration-300 ${
            activePlayer.color === 'red' ? 'bg-cybererror/20 text-cybererror shadow-[0_0_10px_rgba(255,77,77,0.3)]' :
            activePlayer.color === 'green' ? 'bg-cybersuccess/20 text-cybersuccess shadow-[0_0_10px_rgba(0,208,132,0.3)]' :
            activePlayer.color === 'yellow' ? 'bg-[#fbc02d]/20 text-[#fbc02d] shadow-[0_0_10px_rgba(255,213,79,0.3)]' : 'bg-cyberblue/20 text-cyberblue shadow-[0_0_10px_rgba(0,245,255,0.3)]'
          }`}>
            {activePlayer.username[0]}
          </div>
          <div>
            <div className="text-sm font-extrabold flex items-center gap-2 text-white">
              {activePlayer.username} 
              <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                activePlayer.color === 'red' ? 'text-cybererror border-cybererror/30 bg-cybererror/5' :
                activePlayer.color === 'green' ? 'text-cybersuccess border-cybersuccess/30 bg-cybersuccess/5' :
                activePlayer.color === 'yellow' ? 'text-cybergold border-cybergold/30 bg-cybergold/5' : 'text-cyberblue border-cyberblue/30 bg-cyberblue/5'
              }`}>
                {activePlayer.color}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {isMyTurn ? t('yourTurn', 'Your Turn!') : t('waitingTurn', 'Waiting for player turn...')}
            </p>
          </div>
        </div>
        
        {/* Turn timer indicator */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('timeLeft', 'Time Left')}</span>
          <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-linear ${
                gameState.turnTimeLeft <= 5 ? 'bg-cybererror animate-pulse' : 'bg-cyberblue'
              }`}
              style={{ width: `${(gameState.turnTimeLeft / 15) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Ludo Board Panel with Dynamic Camera Zoom/Pan */}
      <div 
        className="wood-board-frame relative shrink-0 transition-transform duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]"
        style={{
          width: 'min(92vw, 92vh, 680px)',
          height: 'min(92vw, 92vh, 680px)',
          transform: `scale(${camZoom}) translate(${camX}px, ${camY}px)`,
        }}
      >
        
        {/* Render 15x15 Ludo Grid Layout */}
        <div className="grid grid-cols-15 grid-rows-15 w-full h-full gap-0.5 relative bg-[#eedcb3]">
          
          {/* Top-Left Red Base */}
          <div className="col-span-6 row-span-6 bg-gradient-to-br from-[#c62828]/10 to-[#b71c1c]/20 border-4 border-[#5d1616] rounded-3xl relative flex items-center justify-center shadow-2xl">
            <span className="text-cybererror font-black text-xs sm:text-sm uppercase tracking-widest absolute top-2 left-2">Red Yard</span>
            
            {/* Wooden Base Panel */}
            <div className="wood-base-yard w-[85%] h-[85%] relative flex items-center justify-center">
              <div className="grid grid-cols-2 gap-6">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#b71c1c] bg-[#ff8a80]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#b71c1c] bg-[#ff8a80]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#b71c1c] bg-[#ff8a80]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#b71c1c] bg-[#ff8a80]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
              </div>
              
              {/* Integrated Dice */}
              {renderBaseDice('red')}
            </div>
          </div>

          {/* Top-Middle Green Column Track */}
          <div className="col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 gap-0.5">
            {Array.from({ length: 18 }).map((_, idx) => {
              const col = idx % 3;
              const row = Math.floor(idx / 3);
              let bg = 'wood-cell-default';
              if (col === 1 && row > 0) bg = 'bg-[#00e676]/85 border border-[#00a152] shadow-inner'; // Home stretch
              if (col === 2 && row === 1) bg = 'bg-[#00e676]/85 border border-white/20 shadow-inner'; // Green start
              const isStar = (col === 2 && row === 1) || (col === 0 && row === 2);
              return (
                <div key={`g-${idx}`} className={`rounded ${bg} flex items-center justify-center text-[10px] text-white/30 font-bold`}>
                  {isStar ? '★' : ''}
                </div>
              );
            })}
          </div>

          {/* Top-Right Green Base */}
          <div className="col-span-6 row-span-6 bg-gradient-to-br from-[#2e7d32]/10 to-[#1b5e20]/20 border-4 border-[#124216] rounded-3xl relative flex items-center justify-center shadow-2xl">
            <span className="text-cybersuccess font-black text-xs sm:text-sm uppercase tracking-widest absolute top-2 right-2">Green Yard</span>
            
            {/* Wooden Base Panel */}
            <div className="wood-base-yard w-[85%] h-[85%] relative flex items-center justify-center">
              <div className="grid grid-cols-2 gap-6">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#2e7d32] bg-[#b9f6ca]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#2e7d32] bg-[#b9f6ca]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#2e7d32] bg-[#b9f6ca]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#2e7d32] bg-[#b9f6ca]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
              </div>
              
              {/* Integrated Dice */}
              {renderBaseDice('green')}
            </div>
          </div>

          {/* Left-Middle Red Column Track */}
          <div className="col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 gap-0.5">
            {Array.from({ length: 18 }).map((_, idx) => {
              const col = idx % 6;
              const row = Math.floor(idx / 6);
              let bg = 'wood-cell-default';
              if (row === 1 && col > 0) bg = 'bg-[#ff5d5d]/85 border border-[#d33a3a] shadow-inner'; // Home stretch
              if (row === 0 && col === 1) bg = 'bg-[#ff5d5d]/85 border border-white/20 shadow-inner'; // Red start
              const isStar = (row === 0 && col === 1) || (row === 2 && col === 2);
              return (
                <div key={`r-${idx}`} className={`rounded ${bg} flex items-center justify-center text-[10px] text-white/30 font-bold`}>
                  {isStar ? '★' : ''}
                </div>
              );
            })}
          </div>

          {/* Center Goal Terminal */}
          <div className="col-span-3 row-span-3 bg-gradient-to-br from-[#805030] to-[#50301a] border border-[#a67c52] rounded-xl flex items-center justify-center flex-col relative overflow-hidden shadow-inner">
            {/* Traditional Triangles */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon points="0,0 50,50 0,100" fill="rgba(239, 68, 68, 0.75)" stroke="#501010" strokeWidth="0.5" />
              <polygon points="0,0 100,0 50,50" fill="rgba(34, 197, 94, 0.75)" stroke="#105010" strokeWidth="0.5" />
              <polygon points="100,0 100,100 50,50" fill="rgba(234, 179, 8, 0.75)" stroke="#504005" strokeWidth="0.5" />
              <polygon points="0,100 50,50 100,100" fill="rgba(59, 130, 246, 0.75)" stroke="#051050" strokeWidth="0.5" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center">
              <Trophy className="text-cybergold sm:w-7 sm:h-7 w-4 h-4 animate-float-slow" />
              <span className="text-[7px] sm:text-[9px] uppercase font-black tracking-widest mt-0.5 text-white">Goal</span>
            </div>
          </div>

          {/* Right-Middle Yellow Column Track */}
          <div className="col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 gap-0.5">
            {Array.from({ length: 18 }).map((_, idx) => {
              const col = idx % 6;
              const row = Math.floor(idx / 6);
              let bg = 'wood-cell-default';
              if (row === 1 && col < 5) bg = 'bg-[#ffd740]/85 border border-[#ffb300] shadow-inner'; // Home stretch
              if (row === 2 && col === 4) bg = 'bg-[#ffd740]/85 border border-white/20 shadow-inner'; // Yellow start
              const isStar = (row === 2 && col === 4) || (row === 0 && col === 3);
              return (
                <div key={`y-${idx}`} className={`rounded ${bg} flex items-center justify-center text-[10px] text-white/30 font-bold`}>
                  {isStar ? '★' : ''}
                </div>
              );
            })}
          </div>

          {/* Bottom-Left Blue Base */}
          <div className="col-span-6 row-span-6 bg-gradient-to-br from-[#1565c0]/10 to-[#0d47a1]/20 border-4 border-[#092c68] rounded-3xl relative flex items-center justify-center shadow-2xl">
            <span className="text-cyberblue font-black text-xs sm:text-sm uppercase tracking-widest absolute bottom-2 left-2">Blue Yard</span>
            
            {/* Wooden Base Panel */}
            <div className="wood-base-yard w-[85%] h-[85%] relative flex items-center justify-center">
              <div className="grid grid-cols-2 gap-6">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#1565c0] bg-[#82b1ff]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#1565c0] bg-[#82b1ff]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#1565c0] bg-[#82b1ff]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#1565c0] bg-[#82b1ff]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
              </div>
              
              {/* Integrated Dice */}
              {renderBaseDice('blue')}
            </div>
          </div>

          {/* Bottom-Middle Blue Column Track */}
          <div className="col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 gap-0.5">
            {Array.from({ length: 18 }).map((_, idx) => {
              const col = idx % 3;
              const row = Math.floor(idx / 3);
              let bg = 'wood-cell-default';
              if (col === 1 && row < 5) bg = 'bg-[#2979ff]/85 border border-[#2962ff] shadow-inner'; // Home stretch
              if (col === 0 && row === 4) bg = 'bg-[#2979ff]/85 border border-white/20 shadow-inner'; // Blue start
              const isStar = (col === 0 && row === 4) || (col === 2 && row === 3);
              return (
                <div key={`b-${idx}`} className={`rounded ${bg} flex items-center justify-center text-[10px] text-white/30 font-bold`}>
                  {isStar ? '★' : ''}
                </div>
              );
            })}
          </div>

          {/* Bottom-Right Yellow Base */}
          <div className="col-span-6 row-span-6 bg-gradient-to-br from-[#f57f17]/10 to-[#f57f17]/20 border-4 border-[#824400] rounded-3xl relative flex items-center justify-center shadow-2xl">
            <span className="text-cybergold font-black text-xs sm:text-sm uppercase tracking-widest absolute bottom-2 right-2">Yellow Yard</span>
            
            {/* Wooden Base Panel */}
            <div className="wood-base-yard w-[85%] h-[85%] relative flex items-center justify-center">
              <div className="grid grid-cols-2 gap-6">
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#f57f17] bg-[#ffe57f]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#f57f17] bg-[#ffe57f]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#f57f17] bg-[#ffe57f]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#f57f17] bg-[#ffe57f]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.5)]"></div>
              </div>
              
              {/* Integrated Dice */}
              {renderBaseDice('yellow')}
            </div>
          </div>

          {/* Absolute Tokens Overlay Layer with Stacking Displacement */}
          {(() => {
            const tokenGroups: { [coordKey: string]: { player: LudoPlayer; token: LudoToken; isEligible: boolean; playerIndex: number }[] } = {};

            gameState.players.forEach((p, pIdx) => {
              p.tokens.forEach((t) => {
                const key = `${p.color}-${t.id}`;
                const visual = visualTokens[key];
                const col = visual ? visual.col : BASE_COORDINATES[p.color][t.id][0];
                const row = visual ? visual.row : BASE_COORDINATES[p.color][t.id][1];
                
                const coordKey = `${Math.round(col)},${Math.round(row)}`;
                const isTokenEligible = isMyTurn && validTokens.includes(t.id);
                
                if (!tokenGroups[coordKey]) {
                  tokenGroups[coordKey] = [];
                }
                tokenGroups[coordKey].push({ player: p, token: t, isEligible: isTokenEligible, playerIndex: pIdx });
              });
            });

            return Object.entries(tokenGroups).flatMap(([coordKey, tokensInGroup]) => {
              const [colStr, rowStr] = coordKey.split(',');
              const col = parseFloat(colStr);
              const row = parseFloat(rowStr);
              const count = tokensInGroup.length;

              return tokensInGroup.map((item, idx) => {
                const { player: p, token: t, isEligible: isTokenEligible } = item;
                const key = `${p.color}-${t.id}`;
                const visual = visualTokens[key];

                let dx = 0;
                let dy = 0;

                if (count > 1 && !visual?.isMoving) {
                  const angle = (idx * 2 * Math.PI) / count;
                  const radius = count === 2 ? 5 : 7;
                  dx = Math.cos(angle) * radius;
                  dy = Math.sin(angle) * radius;
                }

                const isSafeCell = t.position !== -1 && SAFE_CELLS.includes(t.position);
                const isWinnerCelebration = t.position === 58;

                return (
                  <button
                    key={`${p.color}-${t.id}`}
                    onClick={() => handleMoveToken(t.id)}
                    disabled={!isTokenEligible}
                    className={`absolute z-20 select-none transition-all duration-75 ${
                      isTokenEligible ? 'cursor-pointer scale-110 z-30' : 'cursor-default'
                    }`}
                    style={{
                      left: `calc((${visual?.col ?? col} * 100% / 15))`,
                      top: `calc((${visual?.row ?? row} * 100% / 15))`,
                      width: 'calc(100% / 15)',
                      height: 'calc(100% / 15)',
                      transform: `translate(${dx}px, ${dy + (visual?.translateY ?? 0)}px) scale(${visual?.scale ?? 1.0}) rotate(${visual?.rotation ?? 0}deg)`,
                    }}
                  >
                    {/* Tiny Pixar-Style Human Model */}
                    <div className={`pawn-character team-${p.color} ${visual?.isMoving ? 'walking' : 'idle'} ${eliminatedKey === key ? 'eliminated' : ''} ${winnerKey === key ? 'victory-dance' : ''} ${isWinnerCelebration ? 'victory-dance' : ''}`}>
                      {/* Character shadow on ground */}
                      <div className="pawn-shadow"></div>
                      
                      <div className="pawn-body-wrapper">
                        {/* Body / clothes outfit */}
                        <div className="pawn-outfit">
                          {p.color === 'red' && <div className="pawn-cape"></div>}
                          {p.color === 'yellow' && <div className="pawn-medal"></div>}
                          <div className="pawn-chest"></div>
                        </div>
                        
                        {/* Head */}
                        <div className="pawn-head">
                          {p.color === 'red' && <div className="pawn-hair warrior-hair"></div>}
                          {p.color === 'blue' && <div className="pawn-hair adventurer-hat"></div>}
                          {p.color === 'green' && <div className="pawn-hair explorer-hat"></div>}
                          {p.color === 'yellow' && <div className="pawn-hair champion-crown"></div>}
                          
                          {/* Face */}
                          <div className="pawn-face">
                            <div className="pawn-eyes">
                              <div className="pawn-eye left-eye"><div className="pawn-pupil"></div></div>
                              <div className="pawn-eye right-eye"><div className="pawn-pupil"></div></div>
                            </div>
                            <div className="pawn-mouth"></div>
                          </div>
                        </div>

                        {/* Limbs */}
                        <div className="pawn-limbs">
                          <div className="pawn-arm left-arm"></div>
                          <div className="pawn-arm right-arm"></div>
                          <div className="pawn-leg left-leg"></div>
                          <div className="pawn-leg right-leg"></div>
                        </div>
                      </div>
                      
                      {/* Safe Shield Indicator */}
                      {isSafeCell && (
                        <span className="absolute -top-1 -left-1 p-0.5 bg-cyberblue rounded-full text-white text-[6px] font-bold shadow-md animate-pulse z-30">
                          🛡️
                        </span>
                      )}

                      {/* Selection Glow for eligible moves */}
                      {isTokenEligible && (
                        <div className="absolute inset-[-4px] rounded-full border-2 border-cyberblue animate-ping opacity-75 pointer-events-none"></div>
                      )}
                    </div>
                  </button>
                );
              });
            });
          })()}

          {/* Comic Popup Alert */}
          {comicText && (
            <div 
              className="absolute z-40 bg-gradient-to-r from-cyberpink to-purple-600 text-white font-black text-[9px] sm:text-xs px-2.5 py-1 rounded-xl shadow-neon-pink select-none uppercase tracking-wider animate-bounce flex items-center justify-center gap-1 border border-white/20"
              style={{
                left: `calc((${comicText.col} * 100% / 15) - 25px)`,
                top: `calc((${comicText.row} * 100% / 15) - 30px)`,
              }}
            >
              💥 {comicText.text}
            </div>
          )}

          {/* Canvas Particle Overlay */}
          <canvas 
            ref={canvasRef}
            className="absolute inset-0 z-30 pointer-events-none w-full h-full"
          />

          {/* Glossy PBR overlays */}
          <div className="absolute inset-0 spotlight-overlay pointer-events-none z-10" />
          <div className="absolute inset-0 reflection-overlay pointer-events-none z-10" />

        </div>
      </div>

      {/* Floating Eligible Movements Selector for touch-friendliness */}
      {isMyTurn && validTokens.length > 0 && (
        <div className="fixed bottom-6 inset-x-4 max-w-sm mx-auto z-30 glass-panel rounded-2xl p-4 border border-cyberblue/30 shadow-[0_10px_30px_rgba(0,245,255,0.25)] space-y-3">
          <h5 className="text-[10px] uppercase font-bold text-cyberblue tracking-wider flex items-center gap-1.5 justify-center">
            <Sparkles size={12} className="animate-spin-slow" /> Eligible Movements
          </h5>
          <div className="grid grid-cols-2 gap-3">
            {validTokens.map((tokenId) => (
              <button
                key={tokenId}
                onClick={() => handleMoveToken(tokenId)}
                className={`py-3 rounded-xl border text-xs font-black text-white hover:scale-[1.02] active:scale-95 transition-all shadow-md ${
                  activePlayer.color === 'red' ? 'border-cybererror/35 bg-cybererror/10 hover:bg-cybererror/20' :
                  activePlayer.color === 'green' ? 'border-cybersuccess/35 bg-cybersuccess/10 hover:bg-cybersuccess/20' :
                  activePlayer.color === 'yellow' ? 'border-cybergold/35 bg-cybergold/10 hover:bg-cybergold/20' :
                  'border-cyberblue/35 bg-cyberblue/10 hover:bg-cyberblue/20'
                }`}
              >
                Move Tiny Human {tokenId + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Match Results Scoreboard Modal */}
      {matchEnded && scoreboard.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden shadow-neon-purple animate-float-slow">
            
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-cyberpink/10 rounded-full blur-2xl"></div>

            <div className="text-center mb-6 relative">
              <span className="text-[10px] font-black uppercase text-cyberblue tracking-widest">Match Terminal Ended</span>
              <h3 className="text-3xl font-extrabold text-white mt-1">Standings Log</h3>
              <p className="text-sm text-gray-400 mt-1">Placements locked. Transmitting rewards.</p>
            </div>

            <div className="space-y-3 mb-6 relative">
              <div className="divide-y divide-white/5 bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                {scoreboard.map((row) => (
                  <div key={row.userId} className="flex justify-between items-center py-2 text-sm first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className={`font-black w-4 ${
                        row.placement === 1 ? 'text-cybergold' : 'text-gray-500'
                      }`}>
                        #{row.placement}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs uppercase font-bold border border-white/10 ${
                          row.color === 'red' ? 'bg-cybererror/20 text-cybererror' :
                          row.color === 'green' ? 'bg-cybersuccess/20 text-cybersuccess' :
                          row.color === 'yellow' ? 'bg-cybergold/20 text-cybergold' : 'bg-cyberblue/20 text-cyberblue'
                        }`}>
                          {row.username[0]}
                        </div>
                        <div>
                          <span className="font-extrabold text-gray-200">{row.username}</span>
                          <span className="text-[9px] text-gray-500 ml-2 font-semibold uppercase">({row.color})</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 items-center shrink-0">
                      <span className="text-[10px] font-bold text-gray-400">+{row.xpEarned} XP</span>
                      <span className="text-xs font-black text-cybergold">+{row.coinsEarned} 🪙</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => onReturnToLobby && onReturnToLobby()}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-cyberblue font-bold shadow-neon-blue hover:opacity-90 active:scale-95 transition-all text-center relative"
            >
              Return to Lobby deck
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
