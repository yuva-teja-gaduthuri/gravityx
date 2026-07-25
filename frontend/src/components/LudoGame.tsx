'use client';

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { Trophy, Timer, Play, ShieldAlert, Sparkles, Volume2, VolumeX, Settings, Eye } from 'lucide-react';

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
  user: { id: string; username: string };
  socket: Socket;
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

export default function LudoGame({ roomCode, user, socket, matchEndedData, onReturnToLobby }: LudoGameProps) {
  const [gameState, setGameState] = useState<LudoState | null>(null);
  const [validTokens, setValidTokens] = useState<number[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [rollingValue, setRollingValue] = useState<number>(1);
  const [matchEnded, setMatchEnded] = useState(false);
  const [scoreboard, setScoreboard] = useState<any[]>([]);

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
          handleCaptureAnimation(finalPos, finalPlayersState);
        } else {
          setGameState(prev => prev ? { ...prev, players: finalPlayersState, diceValue: null, hasRolled: false } : null);
          setValidTokens([]);
        }
        return;
      }

      const nextPos = path[stepIndex];
      const [col, row] = getTokenCoords(color, tokenId, nextPos);

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
      if (!isCameraShakeMuted) {
        setIsScreenShaking(true);
        setTimeout(() => setIsScreenShaking(false), 500);
      }

      audioRef.current?.playCapture();

      const [col, row] = TRACK_COORDINATES[capturePos] || [7, 7];
      
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
    }
  };

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

          // Dice stop glow thud sound
          audioRef.current?.playImpact();

          // Rule: Lucky 6 visual alert
          if (data.diceValue === 6) {
            setLuckySix(true);
            setTimeout(() => setLuckySix(false), 1500);
            // Spawn fireworks around dice console
            triggerFireworks(12, 12);
          }

          setGameState(prev => prev ? { ...prev, diceValue: data.diceValue, hasRolled: true } : null);
          
          const isMyTurnNow = gameState?.players[gameState.activePlayerIndex]?.id === user.id;
          if (isMyTurnNow) {
            setValidTokens(data.validTokens);
          }
        }
      }, 70);
    });

    socket.on('ludo_token_moved', (data: any) => {
      if (!gameState) return;
      const activePlayer = gameState.players[gameState.activePlayerIndex];
      
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
      const nextActivePlayer = gameState?.players[data.activePlayerIndex];
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
  }, [socket, gameState, roomCode, user.id]);

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

  return (
    <div className={`flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto w-full p-4 items-center justify-center transition-all duration-100 ${
      isScreenShaking ? 'animate-shake' : ''
    }`}>
      
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

      {/* Ludo Board Panel */}
      <div className="relative w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] bg-darkbg border border-white/10 rounded-2xl p-1 overflow-hidden shadow-neon-blue shrink-0">
        
        {/* Render 15x15 Ludo Grid Layout */}
        <div className="grid grid-cols-15 grid-rows-15 w-full h-full gap-0.5 relative">
          
          {/* Top-Left Red Base */}
          <div className="col-span-6 row-span-6 bg-cybererror/10 border border-cybererror/20 rounded-xl relative flex items-center justify-center">
            <span className="text-cybererror font-black text-xs sm:text-sm uppercase tracking-widest absolute top-2 left-2">Yard</span>
            <div className="grid grid-cols-2 gap-4">
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cybererror/30 bg-cybererror/5 animate-pulse-slow"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cybererror/30 bg-cybererror/5 animate-pulse-slow"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cybererror/30 bg-cybererror/5 animate-pulse-slow"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cybererror/30 bg-cybererror/5 animate-pulse-slow"></div>
            </div>
          </div>

          {/* Top-Middle Green Column Track */}
          <div className="col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 gap-0.5">
            {Array.from({ length: 18 }).map((_, idx) => {
              const col = idx % 3;
              const row = Math.floor(idx / 3);
              let bg = 'bg-white/5 border border-white/5';
              if (col === 1 && row > 0) bg = 'bg-cybersuccess/40 border border-cybersuccess/20'; // Home stretch
              if (col === 2 && row === 1) bg = 'bg-cybersuccess/80 border border-white/20'; // Green start
              const isStar = (col === 2 && row === 1) || (col === 0 && row === 2);
              return (
                <div key={`g-${idx}`} className={`rounded ${bg} flex items-center justify-center text-[10px] text-white/30 font-bold`}>
                  {isStar ? '★' : ''}
                </div>
              );
            })}
          </div>

          {/* Top-Right Green Base */}
          <div className="col-span-6 row-span-6 bg-cybersuccess/10 border border-cybersuccess/20 rounded-xl relative flex items-center justify-center">
            <span className="text-cybersuccess font-black text-xs sm:text-sm uppercase tracking-widest absolute top-2 right-2">Yard</span>
            <div className="grid grid-cols-2 gap-4">
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cybersuccess/30 bg-cybersuccess/5 animate-pulse-slow"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cybersuccess/30 bg-cybersuccess/5 animate-pulse-slow"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cybersuccess/30 bg-cybersuccess/5 animate-pulse-slow"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cybersuccess/30 bg-cybersuccess/5 animate-pulse-slow"></div>
            </div>
          </div>

          {/* Left-Middle Red Column Track */}
          <div className="col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 gap-0.5">
            {Array.from({ length: 18 }).map((_, idx) => {
              const col = idx % 6;
              const row = Math.floor(idx / 6);
              let bg = 'bg-white/5 border border-white/5';
              if (row === 1 && col > 0) bg = 'bg-cybererror/40 border border-cybererror/20'; // Home stretch
              if (row === 0 && col === 1) bg = 'bg-cybererror/80 border border-white/20'; // Red start
              const isStar = (row === 0 && col === 1) || (row === 2 && col === 2);
              return (
                <div key={`r-${idx}`} className={`rounded ${bg} flex items-center justify-center text-[10px] text-white/30 font-bold`}>
                  {isStar ? '★' : ''}
                </div>
              );
            })}
          </div>

          {/* Center Goal Terminal */}
          <div className="col-span-3 row-span-3 bg-gradient-to-br from-primary to-darkbg border border-white/10 rounded-xl flex items-center justify-center flex-col relative">
            <Trophy className="text-cybergold sm:w-8 sm:h-8 w-5 h-5 animate-float-slow" />
            <span className="text-[8px] sm:text-[10px] uppercase font-black tracking-widest mt-1 text-cyberblue">Home</span>
            <div className="absolute inset-0 rounded-xl border border-cybergold/20 animate-pulse bg-cybergold/5 pointer-events-none"></div>
          </div>

          {/* Right-Middle Yellow Column Track */}
          <div className="col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 gap-0.5">
            {Array.from({ length: 18 }).map((_, idx) => {
              const col = idx % 6;
              const row = Math.floor(idx / 6);
              let bg = 'bg-white/5 border border-white/5';
              if (row === 1 && col < 5) bg = 'bg-cybergold/40 border border-cybergold/20'; // Home stretch
              if (row === 2 && col === 4) bg = 'bg-cybergold/80 border border-white/20'; // Yellow start
              const isStar = (row === 2 && col === 4) || (row === 0 && col === 3);
              return (
                <div key={`y-${idx}`} className={`rounded ${bg} flex items-center justify-center text-[10px] text-white/30 font-bold`}>
                  {isStar ? '★' : ''}
                </div>
              );
            })}
          </div>

          {/* Bottom-Left Blue Base */}
          <div className="col-span-6 row-span-6 bg-cyberblue/10 border border-cyberblue/20 rounded-xl relative flex items-center justify-center">
            <span className="text-cyberblue font-black text-xs sm:text-sm uppercase tracking-widest absolute bottom-2 left-2">Yard</span>
            <div className="grid grid-cols-2 gap-4">
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cyberblue/30 bg-cyberblue/5 animate-pulse-slow"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cyberblue/30 bg-cyberblue/5 animate-pulse-slow"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cyberblue/30 bg-cyberblue/5 animate-pulse-slow"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cyberblue/30 bg-cyberblue/5 animate-pulse-slow"></div>
            </div>
          </div>

          {/* Bottom-Middle Blue Column Track */}
          <div className="col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 gap-0.5">
            {Array.from({ length: 18 }).map((_, idx) => {
              const col = idx % 3;
              const row = Math.floor(idx / 3);
              let bg = 'bg-white/5 border border-white/5';
              if (col === 1 && row < 5) bg = 'bg-cyberblue/40 border border-cyberblue/20'; // Home stretch
              if (col === 0 && row === 4) bg = 'bg-cyberblue/80 border border-white/20'; // Blue start
              const isStar = (col === 0 && row === 4) || (col === 2 && row === 3);
              return (
                <div key={`b-${idx}`} className={`rounded ${bg} flex items-center justify-center text-[10px] text-white/30 font-bold`}>
                  {isStar ? '★' : ''}
                </div>
              );
            })}
          </div>

          {/* Bottom-Right Yellow Base */}
          <div className="col-span-6 row-span-6 bg-cybergold/10 border border-cybergold/20 rounded-xl relative flex items-center justify-center">
            <span className="text-cybergold font-black text-xs sm:text-sm uppercase tracking-widest absolute bottom-2 right-2">Yard</span>
            <div className="grid grid-cols-2 gap-4">
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cybergold/30 bg-cybergold/5 animate-pulse-slow"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cybergold/30 bg-cybergold/5 animate-pulse-slow"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cybergold/30 bg-cybergold/5 animate-pulse-slow"></div>
              <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full border border-cybergold/30 bg-cybergold/5 animate-pulse-slow"></div>
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

                let tokenBg = 'bg-cybererror border-white/60 shadow-neon-error';
                let glowColor = 'rgba(255, 77, 77, 0.4)';
                if (p.color === 'green') {
                  tokenBg = 'bg-cybersuccess border-white/60 shadow-neon-success';
                  glowColor = 'rgba(0, 208, 132, 0.4)';
                } else if (p.color === 'yellow') {
                  tokenBg = 'bg-cybergold border-white/60 shadow-neon-gold';
                  glowColor = 'rgba(255, 213, 79, 0.4)';
                } else if (p.color === 'blue') {
                  tokenBg = 'bg-cyberblue border-white/60 shadow-neon-blue';
                  glowColor = 'rgba(0, 245, 255, 0.4)';
                }

                let dx = 0;
                let dy = 0;
                let sizeClass = 'w-5 h-5 sm:w-8 sm:h-8';
                let textClass = 'text-[8px] sm:text-xs';

                if (count > 1 && !visual?.isMoving) {
                  sizeClass = 'w-4 h-4 sm:w-6 sm:h-6';
                  textClass = 'text-[6px] sm:text-[10px]';
                  const angle = (idx * 2 * Math.PI) / count;
                  const radius = count === 2 ? 6 : 8;
                  dx = Math.cos(angle) * radius;
                  dy = Math.sin(angle) * radius;
                }

                // Check if current tile position is safe
                const isSafeCell = t.position !== -1 && SAFE_CELLS.includes(t.position);
                const isActiveTurnPawn = gameState.activePlayerIndex === item.playerIndex;

                return (
                  <button
                    key={`${p.color}-${t.id}`}
                    onClick={() => handleMoveToken(t.id)}
                    disabled={!isTokenEligible}
                    className={`absolute rounded-full border-2 flex items-center justify-center font-bold text-white z-20 select-none select-none transition-transform duration-75 ${sizeClass} ${textClass} ${tokenBg} ${
                      isTokenEligible 
                        ? 'animate-bounce cursor-pointer scale-110 border-cyberblue ring-4 ring-cyberblue/50 z-30' 
                        : 'cursor-default'
                    } ${
                      isActiveTurnPawn && !visual?.isMoving ? 'animate-pulse' : ''
                    }`}
                    style={{
                      left: `calc((${visual?.col ?? col} * 100% / 15) + 2px)`,
                      top: `calc((${visual?.row ?? row} * 100% / 15) + 2px)`,
                      transform: `translate(${dx}px, ${dy + (visual?.translateY ?? 0)}px) scale(${visual?.scale ?? 1.0}) rotate(${visual?.rotation ?? 0}deg)`,
                      boxShadow: visual?.isMoving ? `0 12px 24px ${glowColor}, 0 0 10px rgba(255, 255, 255, 0.4)` : undefined
                    }}
                  >
                    {/* Pawn visual facial detail representation (tiny AAA eyes for breathing personality) */}
                    <span className="absolute top-[2px] flex gap-[2px] justify-center w-full opacity-60">
                      <span className="w-1 h-1 rounded-full bg-white animate-pulse"></span>
                      <span className="w-1 h-1 rounded-full bg-white animate-pulse"></span>
                    </span>
                    
                    <span className="mt-[2px]">{t.id + 1}</span>

                    {/* Safe Shield Indicator */}
                    {isSafeCell && (
                      <span className="absolute -top-1 -left-1 p-0.5 bg-cyberblue rounded-full text-white text-[6px] font-bold shadow-md animate-pulse">
                        🛡️
                      </span>
                    )}
                  </button>
                );
              });
            });
          })()}

          {/* Comic Popup Alert */}
          {comicText && (
            <div 
              className="absolute z-40 bg-cyberpink border-2 border-white px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-neon-pink scale-110 animate-bounce select-none pointer-events-none"
              style={{
                left: `calc((${comicText.col} * 100% / 15) - 15px)`,
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

        </div>
      </div>

      {/* Control Console Sidebar */}
      <div className="w-full max-w-sm flex flex-col gap-5 shrink-0">
        
        {/* Status card */}
        <div className="glass-panel rounded-2xl p-5 border-white/5 space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Console Telemetry</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-cybersuccess/10 border border-cybersuccess/20 text-xs font-semibold text-cybersuccess animate-pulse">
              LIVE MATCH
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-white/5 pt-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border border-white/10 uppercase transition-all duration-300 ${
              activePlayer.color === 'red' ? 'bg-cybererror/20 text-cybererror shadow-[0_0_10px_rgba(255,77,77,0.3)]' :
              activePlayer.color === 'green' ? 'bg-cybersuccess/20 text-cybersuccess shadow-[0_0_10px_rgba(0,208,132,0.3)]' :
              activePlayer.color === 'yellow' ? 'bg-cybergold/20 text-cybergold shadow-[0_0_10px_rgba(255,213,79,0.3)]' : 'bg-cyberblue/20 text-cyberblue shadow-[0_0_10px_rgba(0,245,255,0.3)]'
            }`}>
              {activePlayer.username[0]}
            </div>
            <div>
              <div className="text-sm font-extrabold flex items-center gap-2">
                {activePlayer.username} 
                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                  activePlayer.color === 'red' ? 'text-cybererror border-cybererror/30 bg-cybererror/5' :
                  activePlayer.color === 'green' ? 'text-cybersuccess border-cybersuccess/30 bg-cybersuccess/5' :
                  activePlayer.color === 'yellow' ? 'text-cybergold border-cybergold/30 bg-cybergold/5' : 'text-cyberblue border-cyberblue/30 bg-cyberblue/5'
                }`}>
                  {activePlayer.color}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {isMyTurn ? "Your Command Matrix is active. Roll or select token." : "Observing opponent telemetry..."}
              </p>
            </div>
          </div>

          {/* Turn timer progress bar indicator */}
          <div className="w-full h-1 bg-white/10 absolute bottom-0 left-0">
            <div 
              className={`h-full transition-all duration-1000 ease-linear ${
                gameState.turnTimeLeft <= 5 ? 'bg-cybererror animate-pulse' : 'bg-cyberblue'
              }`}
              style={{ width: `${(gameState.turnTimeLeft / 15) * 100}%` }}
            />
          </div>
        </div>

        {/* Dice Roller Console */}
        <div className="glass-card rounded-2xl p-6 border-white/5 flex flex-col items-center justify-center text-center space-y-5 relative overflow-hidden">
          
          {/* Active Turn Neon Boarder Glow */}
          <div className={`absolute inset-0 pointer-events-none border transition-all duration-500 ${
            isMyTurn 
              ? activePlayer.color === 'red' ? 'border-cybererror/30 shadow-[inset_0_0_20px_rgba(255,77,77,0.1)]' :
                activePlayer.color === 'green' ? 'border-cybersuccess/30 shadow-[inset_0_0_20px_rgba(0,208,132,0.1)]' :
                activePlayer.color === 'yellow' ? 'border-cybergold/30 shadow-[inset_0_0_20px_rgba(255,213,79,0.1)]' : 'border-cyberblue/30 shadow-[inset_0_0_20px_rgba(0,245,255,0.1)]'
              : 'border-white/5'
          }`}></div>

          {/* 3D Dice Real 6-face Render */}
          <div className="dice-scene select-none">
            <div 
              className={`dice-cube ${isRolling ? 'animate-spin-slow' : ''}`}
              data-roll={rollingValue}
            >
              {/* Face 1 */}
              <div className="dice-face bg-darkbg border-white/20 text-white flex items-center justify-center shadow-inner" style={{ transform: 'rotateY(0deg) translateZ(32px)' }}>
                <span className="w-3.5 h-3.5 rounded-full bg-cyberpink shadow-neon-pink"></span>
              </div>
              {/* Face 6 */}
              <div className="dice-face bg-darkbg border-white/20 text-white shadow-inner" style={{ transform: 'rotateY(180deg) translateZ(32px)' }}>
                <div className="grid grid-cols-2 gap-2.5 p-2 w-full h-full justify-items-center items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                </div>
              </div>
              {/* Face 2 */}
              <div className="dice-face bg-darkbg border-white/20 text-white shadow-inner" style={{ transform: 'rotateY(90deg) translateZ(32px)' }}>
                <div className="flex flex-col justify-between p-2 w-full h-full">
                  <span className="w-2.5 h-2.5 rounded-full bg-white self-start"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white self-end"></span>
                </div>
              </div>
              {/* Face 5 */}
              <div className="dice-face bg-darkbg border-white/20 text-white shadow-inner" style={{ transform: 'rotateY(-90deg) translateZ(32px)' }}>
                <div className="grid grid-cols-3 gap-1.5 p-2 w-full h-full items-center justify-items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-white col-start-1 col-end-2"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white col-start-3 col-end-4"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white col-start-2 col-end-3"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white col-start-1 col-end-2"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white col-start-3 col-end-4"></span>
                </div>
              </div>
              {/* Face 3 */}
              <div className="dice-face bg-darkbg border-white/20 text-white shadow-inner" style={{ transform: 'rotateX(90deg) translateZ(32px)' }}>
                <div className="flex flex-col justify-between p-2 w-full h-full items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-white self-start"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white self-end"></span>
                </div>
              </div>
              {/* Face 4 */}
              <div className="dice-face bg-darkbg border-white/20 text-white shadow-inner" style={{ transform: 'rotateX(-90deg) translateZ(32px)' }}>
                <div className="grid grid-cols-2 gap-3.5 p-2.5 w-full h-full justify-items-center items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center pt-2">
            <button
              onClick={handleRollDice}
              disabled={!isMyTurn || gameState.hasRolled || isRolling}
              className={`px-8 py-3.5 rounded-xl font-black flex items-center gap-2 text-sm transition-all duration-300 border ${
                isMyTurn && !gameState.hasRolled && !isRolling
                  ? activePlayer.color === 'red' ? 'bg-cybererror text-white border-cybererror shadow-neon-error hover:opacity-90 active:scale-95' :
                    activePlayer.color === 'green' ? 'bg-cybersuccess text-white border-cybersuccess shadow-neon-success hover:opacity-90 active:scale-95' :
                    activePlayer.color === 'yellow' ? 'bg-cybergold text-white border-cybergold shadow-neon-gold hover:opacity-90 active:scale-95' :
                    'bg-cyberblue text-white border-cyberblue shadow-neon-blue hover:opacity-90 active:scale-95'
                  : 'bg-white/5 border-white/5 text-gray-500 opacity-40 cursor-default'
              }`}
            >
              <Play size={16} className={isMyTurn && !gameState.hasRolled && !isRolling ? 'animate-pulse' : ''} /> Roll Core
            </button>
          </div>
        </div>

        {/* Valid Tokens Selector Console */}
        {isMyTurn && validTokens.length > 0 && (
          <div className="glass-panel rounded-2xl p-5 border-white/5 space-y-3">
            <h5 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
              <Sparkles size={12} className="text-cyberblue animate-pulse" /> Command Executions
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
                  Move Token {tokenId + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

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
                {scoreboard.map((row, idx) => (
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
              onClick={() => window.location.reload()}
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
