import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Chess, Square } from 'chess.js';
import confetti from 'canvas-confetti';
import { Trophy, Maximize, Minimize, Heart, UserPlus, MessageSquare, X, RefreshCw, LogOut, Flag, Play, Sparkles, Zap, Award, AlertTriangle } from 'lucide-react';
import { getApiUrl } from '../utils/api';
import { useTranslation } from '../hooks/useTranslation';

import { ChessBoard } from './chess/ChessBoard';
import { ChessPlayerPanel, CapturedPiece } from './chess/ChessPlayerPanel';
import { ChessMoveHistory } from './chess/ChessMoveHistory';
import { ChessPromotionModal } from './chess/ChessPromotionModal';
import { ChessReviewModal } from './chess/ChessReviewModal';
import { ChessReviewAgent } from '../utils/chessReviewAgent';

interface ChessGameProps {
  roomCode?: string;
  user: { id: string; username: string; isGuest?: boolean; boardTheme?: string; profileFrame?: string };
  socket?: Socket;
  isHost?: boolean;
  isPassAndPlay?: boolean;
  matchEndedData?: any;
  onReturnToLobby?: () => void;
}

interface ChessState {
  fen: string;
  turn: 'w' | 'b';
  whitePlayerId: string;
  blackPlayerId: string;
  whiteUsername: string;
  blackUsername: string;
  timeControl?: number | 'UNLIMITED';
  whiteTimeLeft: number | null;
  blackTimeLeft: number | null;
  timerStarted?: boolean;
  lastMoveTimestamp: number;
  capturedPieces: CapturedPiece[];
  lastMove: { from: string; to: string; piece?: string; san?: string } | null;
  moveHistory: string[];
  isGameOver: boolean;
  winnerId: string | null;
  drawReason: string | null;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  resultType?: string;
}

export default function ChessGame({ roomCode, user, socket, isHost, isPassAndPlay, matchEndedData, onReturnToLobby }: ChessGameProps) {
  const { t } = useTranslation();
  const [gameState, setGameState] = useState<ChessState | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [pendingPromotionMove, setPendingPromotionMove] = useState<{ from: string; to: string } | null>(null);

  const [matchEnded, setMatchEnded] = useState(false);
  const [scoreboard, setScoreboard] = useState<any[]>([]);

  // Pass & Play States
  const [isPassMode] = useState<boolean>(!!isPassAndPlay || !socket);
  const [passSetupOpen, setPassSetupOpen] = useState<boolean>(!!isPassAndPlay || !socket);
  const [p1Name, setP1Name] = useState<string>('Player 1');
  const [p2Name, setP2Name] = useState<string>('Player 2');
  const [colorSelection, setColorSelection] = useState<'WHITE' | 'BLACK' | 'RANDOM'>('RANDOM');
  const [timerSelection, setTimerSelection] = useState<number | 'UNLIMITED'>('UNLIMITED');

  // Resignation Confirm Modal
  const [showResignConfirmModal, setShowResignConfirmModal] = useState(false);

  // AI Game Review Modal State
  const [showAiReviewModal, setShowAiReviewModal] = useState(false);
  const [reviewResultData, setReviewResultData] = useState<any>(null);

  // Social States
  const [likesMap, setLikesMap] = useState<{ [username: string]: number }>({});
  const [friendStatus, setFriendStatus] = useState<{ [username: string]: string }>({});
  const [reviewModalUser, setReviewModalUser] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chessInstance, setChessInstance] = useState<Chess | null>(null);

  // Audio synthesis triggers for move sounds
  const playAudioEffect = (type: 'move' | 'capture' | 'check' | 'gameover') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'move') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      } else if (type === 'capture') {
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } else if (type === 'check') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(261.63, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {
      // Audio context error fallback
    }
  };

  // Automatically compute move review as soon as game ends if not provided by server
  useEffect(() => {
    if (matchEnded && gameState && gameState.moveHistory && gameState.moveHistory.length > 0 && !reviewResultData) {
      const result = ChessReviewAgent.reviewGame(gameState.moveHistory);
      setReviewResultData(result);
    }
  }, [matchEnded, gameState, reviewResultData]);

  // Sync state on socket connection for online multiplayer
  useEffect(() => {
    if (isPassMode || !socket || !roomCode) return;

    socket.emit('chess_sync_state', roomCode);

    const handleSync = (state: ChessState) => {
      setGameState(state);
      const chess = new Chess(state.fen);
      setChessInstance(chess);

      if (state.isGameOver) {
        setMatchEnded(true);
      }
    };

    const handleTimerTick = (data: { whiteTimeLeft: number | null; blackTimeLeft: number | null; activeTurn: 'w' | 'b' }) => {
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              whiteTimeLeft: data.whiteTimeLeft,
              blackTimeLeft: data.blackTimeLeft,
              turn: data.activeTurn,
              timerStarted: true,
            }
          : prev
      );
    };

    const handleMatchEnded = (data: any) => {
      setMatchEnded(true);
      setScoreboard(data.scoreboard || []);
      if (data.reviewResult) {
        setReviewResultData(data.reviewResult);
      }

      playAudioEffect('gameover');

      const isWinner = data.scoreboard.find((row: any) => row.userId === user.id && row.placement === 1);
      if (isWinner) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    };

    socket.on('chess_state_sync', handleSync);
    socket.on('chess_timer_tick', handleTimerTick);
    socket.on('chess_match_ended', handleMatchEnded);

    return () => {
      socket.off('chess_state_sync', handleSync);
      socket.off('chess_timer_tick', handleTimerTick);
      socket.off('chess_match_ended', handleMatchEnded);
    };
  }, [socket, roomCode, user.id, isPassMode]);

  // Local turn timer for Pass & Play Mode
  useEffect(() => {
    if (!isPassMode || !gameState || gameState.isGameOver || gameState.timeControl === 'UNLIMITED') return;

    const timerInterval = setInterval(() => {
      setGameState((prev) => {
        if (!prev || prev.isGameOver) return prev;
        const isWhiteTurn = prev.turn === 'w';

        let newWhiteTime = prev.whiteTimeLeft;
        let newBlackTime = prev.blackTimeLeft;

        if (isWhiteTurn && typeof newWhiteTime === 'number') {
          newWhiteTime = Math.max(0, newWhiteTime - 1);
        } else if (!isWhiteTurn && typeof newBlackTime === 'number') {
          newBlackTime = Math.max(0, newBlackTime - 1);
        }

        const isTimeOut = (newWhiteTime !== null && newWhiteTime <= 0) || (newBlackTime !== null && newBlackTime <= 0);

        if (isTimeOut) {
          const winnerId = newWhiteTime === 0 ? prev.blackPlayerId : prev.whitePlayerId;
          const winnerName = newWhiteTime === 0 ? prev.blackUsername : prev.whiteUsername;

          setMatchEnded(true);
          setScoreboard([
            { userId: winnerId, username: winnerName, placement: 1, xpEarned: 50, coinsEarned: 100 },
            {
              userId: winnerId === prev.whitePlayerId ? prev.blackPlayerId : prev.whitePlayerId,
              username: winnerId === prev.whitePlayerId ? prev.blackUsername : prev.whiteUsername,
              placement: 2,
              xpEarned: 15,
              coinsEarned: 20,
            },
          ]);

          return {
            ...prev,
            whiteTimeLeft: newWhiteTime,
            blackTimeLeft: newBlackTime,
            isGameOver: true,
            winnerId,
            resultType: 'TIMEOUT',
            drawReason: `Timeout - ${winnerName} Wins`,
          };
        }

        return {
          ...prev,
          whiteTimeLeft: newWhiteTime,
          blackTimeLeft: newBlackTime,
        };
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [isPassMode, gameState]);

  // Handle Pass & Play Game Start Initialization
  const handleStartPassAndPlay = () => {
    let wName = p1Name || 'Player 1';
    let bName = p2Name || 'Player 2';

    if (colorSelection === 'BLACK') {
      [wName, bName] = [bName, wName];
    } else if (colorSelection === 'RANDOM') {
      if (Math.random() > 0.5) {
        [wName, bName] = [bName, wName];
      }
    }

    const initialSecs = typeof timerSelection === 'number' ? timerSelection * 60 : null;

    const chess = new Chess();
    const initialState: ChessState = {
      fen: chess.fen(),
      turn: 'w',
      whitePlayerId: 'p1_local',
      blackPlayerId: 'p2_local',
      whiteUsername: wName,
      blackUsername: bName,
      timeControl: timerSelection,
      whiteTimeLeft: initialSecs,
      blackTimeLeft: initialSecs,
      timerStarted: false,
      lastMoveTimestamp: Date.now(),
      capturedPieces: [],
      lastMove: null,
      moveHistory: [],
      isGameOver: false,
      winnerId: null,
      drawReason: null,
      isCheck: false,
      isCheckmate: false,
      isStalemate: false,
    };

    setChessInstance(chess);
    setGameState(initialState);
    setPassSetupOpen(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  // Trigger Resignation
  const handleConfirmResign = () => {
    setShowResignConfirmModal(false);
    if (!gameState) return;

    if (isPassMode) {
      const currentActiveId = gameState.turn === 'w' ? gameState.whitePlayerId : gameState.blackPlayerId;
      const winnerId = currentActiveId === gameState.whitePlayerId ? gameState.blackPlayerId : gameState.whitePlayerId;
      const winnerName = winnerId === gameState.whitePlayerId ? gameState.whiteUsername : gameState.blackUsername;
      const loserName = currentActiveId === gameState.whitePlayerId ? gameState.whiteUsername : gameState.blackUsername;

      setGameState({
        ...gameState,
        isGameOver: true,
        winnerId,
        resultType: 'RESIGNATION',
        drawReason: `${loserName} Resigned`,
      });

      setMatchEnded(true);
      setScoreboard([
        { userId: winnerId, username: winnerName, placement: 1, xpEarned: 50, coinsEarned: 100 },
        { userId: currentActiveId, username: loserName, placement: 2, xpEarned: 15, coinsEarned: 20 },
      ]);
    } else if (socket && roomCode) {
      socket.emit('chess_resign', roomCode);
    }
  };

  // Pass & Play Setup Dialog Overlay
  if (isPassMode && passSetupOpen) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-slate-950">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider">
              Pass & Play Setup
            </span>
            <h2 className="text-2xl font-black text-white">Local 2-Player Chess</h2>
            <p className="text-xs text-slate-400">Configure players and timer to play on a single device</p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Player 1 Name</label>
              <input
                type="text"
                value={p1Name}
                onChange={(e) => setP1Name(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Player 2 Name</label>
              <input
                type="text"
                value={p2Name}
                onChange={(e) => setP2Name(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Color Assignment</label>
              <div className="grid grid-cols-3 gap-2">
                {(['WHITE', 'BLACK', 'RANDOM'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setColorSelection(mode)}
                    className={`py-2 rounded-xl border font-bold transition-all ${
                      colorSelection === mode
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Timer Selection</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Unlimited', val: 'UNLIMITED' },
                  { label: '1m', val: 60 },
                  { label: '3m', val: 180 },
                  { label: '5m', val: 300 },
                  { label: '10m', val: 600 },
                  { label: '15m', val: 900 },
                  { label: '30m', val: 1800 },
                ].map((tc) => (
                  <button
                    key={tc.label}
                    onClick={() => setTimerSelection(tc.val as any)}
                    className={`py-2 rounded-xl border text-[11px] font-bold transition-all ${
                      timerSelection === tc.val
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleStartPassAndPlay}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 font-bold text-white shadow-lg shadow-indigo-500/25 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-white" /> Start Game
          </button>
        </div>
      </div>
    );
  }

  if (!gameState || !chessInstance) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-cybergold/20 border-t-cybergold animate-spin mb-4" />
        <span className="text-xs uppercase font-extrabold tracking-widest text-gray-400">
          {t('chessInit', 'Initializing Tactical Chess Board...')}
        </span>
      </div>
    );
  }

  // Determine player colors & turn
  const myId = user.id;
  const isWhite = isPassMode ? gameState.turn === 'w' : myId === gameState.whitePlayerId;
  const isBlack = isPassMode ? gameState.turn === 'b' : myId === gameState.blackPlayerId;
  const myColor = isWhite ? 'w' : isBlack ? 'b' : 'spectator';
  const isMyTurn = isPassMode ? true : gameState.turn === myColor;

  // Board flip perspective
  const isFlipped = isPassMode ? gameState.turn === 'b' : myColor === 'b';

  // Find King Square of Resigned Player for the ABANDONED overlay badge on board
  const getKingSquare = (color: 'w' | 'b'): string | null => {
    if (!chessInstance) return null;
    const board = chessInstance.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === color) {
          const file = String.fromCharCode(97 + c);
          const rank = 8 - r;
          return `${file}${rank}`;
        }
      }
    }
    return null;
  };

  let abandonedSquare: string | null = null;
  if (gameState.resultType === 'RESIGNATION' || gameState.drawReason?.toLowerCase().includes('resigned')) {
    const resignedColor = gameState.winnerId === gameState.whitePlayerId ? 'b' : 'w';
    abandonedSquare = getKingSquare(resignedColor);
  }

  let checkmateSquare: string | null = null;
  if (gameState.resultType === 'CHECKMATE' || gameState.isCheckmate) {
    const checkmatedColor = gameState.winnerId === gameState.whitePlayerId ? 'b' : 'w';
    checkmateSquare = getKingSquare(checkmatedColor);
  }

  // Handle Square Selection & Moves
  const handleSquareClick = (squareName: string) => {
    if (matchEnded || gameState.isGameOver) return;

    const currentActiveColor = gameState.turn;
    const targetSquare = chessInstance.get(squareName as Square);

    if (targetSquare && targetSquare.color === currentActiveColor) {
      setSelectedSquare(squareName);
      const moves = chessInstance.moves({ square: squareName as Square, verbose: true });
      setPossibleMoves(moves.map((m) => m.to));
    } else if (selectedSquare) {
      if (possibleMoves.includes(squareName)) {
        const selectedPiece = chessInstance.get(selectedSquare as Square);
        const targetRank = squareName[1];

        const isPromotion =
          selectedPiece &&
          selectedPiece.type === 'p' &&
          ((currentActiveColor === 'w' && targetRank === '8') || (currentActiveColor === 'b' && targetRank === '1'));

        if (isPromotion) {
          setPendingPromotionMove({ from: selectedSquare, to: squareName });
        } else {
          executeMove(selectedSquare, squareName);
        }
      } else {
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
    }
  };

  const executeMove = (from: string, to: string, promotionChoice: string = 'q') => {
    const isCapture = !!chessInstance.get(to as Square);

    if (!isPassMode && socket && roomCode) {
      socket.emit('chess_move', { roomCode, from, to, promotion: promotionChoice });
    }

    try {
      const moveResult = chessInstance.move({ from, to, promotion: promotionChoice as any });
      if (moveResult) {
        const newFen = chessInstance.fen();
        const nextTurn = chessInstance.turn();

        setChessInstance(new Chess(newFen));

        if (isCapture) playAudioEffect('capture');
        else playAudioEffect('move');

        const capturedList = [...gameState.capturedPieces];
        if (moveResult.captured) {
          capturedList.push({
            piece: moveResult.captured,
            color: moveResult.color === 'w' ? 'b' : 'w',
            capturedBy: gameState.turn === 'w' ? gameState.whitePlayerId : gameState.blackPlayerId,
            sequence: capturedList.length + 1,
          });
        }

        const newHistory = [...gameState.moveHistory, moveResult.san];
        const isCheck = chessInstance.inCheck();
        const isGameOver = chessInstance.isGameOver();

        let isCheckmate = false;
        let isStalemate = false;
        let winnerId: string | null = null;
        let drawReason: string | null = null;
        let resultType: string | undefined = undefined;

        if (isGameOver) {
          if (chessInstance.isCheckmate()) {
            isCheckmate = true;
            winnerId = nextTurn === 'w' ? gameState.blackPlayerId : gameState.whitePlayerId;
            resultType = 'CHECKMATE';
          } else {
            if (chessInstance.isStalemate()) {
              isStalemate = true;
              drawReason = 'Stalemate';
              resultType = 'STALEMATE';
            } else if (chessInstance.isThreefoldRepetition()) {
              drawReason = 'Threefold Repetition';
              resultType = 'DRAW_THREEFOLD';
            } else if (chessInstance.isInsufficientMaterial()) {
              drawReason = 'Insufficient Material';
              resultType = 'DRAW_INSUFFICIENT';
            } else {
              drawReason = 'Draw';
              resultType = 'DRAW_MUTUAL';
            }
          }

          setMatchEnded(true);
          const winnerName = winnerId === gameState.whitePlayerId ? gameState.whiteUsername : gameState.blackUsername;
          const loserName = winnerId === gameState.whitePlayerId ? gameState.blackUsername : gameState.whiteUsername;

          setScoreboard([
            { userId: winnerId || 'draw', username: winnerId ? winnerName : gameState.whiteUsername, placement: 1, xpEarned: 50, coinsEarned: 100 },
            { userId: winnerId ? (winnerId === gameState.whitePlayerId ? gameState.blackPlayerId : gameState.whitePlayerId) : 'draw2', username: winnerId ? loserName : gameState.blackUsername, placement: winnerId ? 2 : 1, xpEarned: 25, coinsEarned: 40 },
          ]);
        }

        setGameState({
          ...gameState,
          fen: newFen,
          turn: nextTurn,
          capturedPieces: capturedList,
          lastMove: { from: moveResult.from, to: moveResult.to, piece: moveResult.piece, san: moveResult.san },
          moveHistory: newHistory,
          isCheck,
          isGameOver,
          isCheckmate,
          isStalemate,
          winnerId,
          drawReason,
          resultType,
        });
      }
    } catch (e) {
      console.error(e);
    }

    setSelectedSquare(null);
    setPossibleMoves([]);
    setPendingPromotionMove(null);
  };

  const topUsername = isFlipped ? gameState.whiteUsername : gameState.blackUsername;
  const topColor: 'w' | 'b' = isFlipped ? 'w' : 'b';
  const topTimeLeft = isFlipped ? gameState.whiteTimeLeft : gameState.blackTimeLeft;
  const topIsTurn = gameState.turn === topColor;
  const topIsCheck = gameState.isCheck && topIsTurn;

  const bottomUsername = isFlipped ? gameState.blackUsername : gameState.whiteUsername;
  const bottomColor: 'w' | 'b' = isFlipped ? 'b' : 'w';
  const bottomTimeLeft = isFlipped ? gameState.blackTimeLeft : gameState.whiteTimeLeft;
  const bottomIsTurn = gameState.turn === bottomColor;
  const bottomIsCheck = gameState.isCheck && bottomIsTurn;

  // Format Result Header Text
  const getResultHeaderLabels = () => {
    const resType = gameState.resultType;
    const winnerName = gameState.winnerId === gameState.whitePlayerId ? gameState.whiteUsername : gameState.blackUsername;

    if (resType === 'CHECKMATE' || gameState.isCheckmate) {
      return { main: 'CHECKMATE', sub: `${winnerName} Wins` };
    }
    if (resType === 'STALEMATE' || gameState.isStalemate) {
      return { main: 'STALEMATE', sub: 'Draw' };
    }
    if (resType === 'RESIGNATION') {
      return { main: 'ABANDONED', sub: `${gameState.drawReason || 'Player Resigned'}` };
    }
    if (resType === 'TIMEOUT') {
      return { main: 'TIMEOUT', sub: `${winnerName} Wins` };
    }
    if (resType === 'DRAW_INSUFFICIENT') {
      return { main: 'DRAW', sub: 'Insufficient Material' };
    }
    if (resType === 'DRAW_THREEFOLD') {
      return { main: 'DRAW', sub: 'Threefold Repetition' };
    }
    if (resType === 'DRAW_MUTUAL') {
      return { main: 'DRAW', sub: 'Mutual Agreement' };
    }
    return { main: 'MATCH COMPLETED', sub: gameState.drawReason || 'Game Over' };
  };

  const resultLabels = getResultHeaderLabels();

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-3 sm:p-5 overflow-y-auto bg-slate-950 text-white min-h-screen">
      {/* Header Bar */}
      <div className="w-full max-w-[560px] flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="text-amber-400" size={18} />
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider">
            {isPassMode ? 'Pass & Play Chess' : t('chessTacticalArena', 'Tactical Chess Arena')}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResignConfirmModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-600 hover:text-white text-red-400 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
          >
            <Flag size={14} />
            <span>Resign</span>
          </button>

          <button
            onClick={() => onReturnToLobby && onReturnToLobby()}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95"
          >
            <LogOut size={14} />
            <span>Exit</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      {/* Main Board Stack */}
      <div className="w-full max-w-[560px] flex flex-col gap-3 relative">
        {/* 1. TOP PLAYER PANEL */}
        <ChessPlayerPanel
          username={topUsername}
          color={topColor}
          isTurn={topIsTurn}
          timeLeft={topTimeLeft}
          isCheck={topIsCheck}
          capturedPieces={gameState.capturedPieces}
          rating={1200}
          isSelf={false}
        />

        {/* 2. MOVE HISTORY BAR */}
        <ChessMoveHistory moveHistory={gameState.moveHistory} />

        {/* 3. CHESS BOARD */}
        <ChessBoard
          chessInstance={chessInstance}
          isFlipped={isFlipped}
          selectedSquare={selectedSquare}
          possibleMoves={possibleMoves}
          lastMove={gameState.lastMove}
          isMyTurn={isMyTurn}
          onSquareClick={handleSquareClick}
          boardTheme={user?.boardTheme}
          abandonedSquare={abandonedSquare}
          checkmateSquare={checkmateSquare}
        />

        {/* 4. BOTTOM PLAYER PANEL */}
        <ChessPlayerPanel
          username={bottomUsername}
          color={bottomColor}
          isTurn={bottomIsTurn}
          timeLeft={bottomTimeLeft}
          isCheck={bottomIsCheck}
          capturedPieces={gameState.capturedPieces}
          rating={1200}
          isSelf={true}
          profileFrame={user?.profileFrame}
        />
      </div>

      {/* Pawn Promotion Modal */}
      {pendingPromotionMove && (
        <ChessPromotionModal
          color={myColor as 'w' | 'b'}
          onSelect={(piece) => executeMove(pendingPromotionMove.from, pendingPromotionMove.to, piece)}
          onCancel={() => {
            setPendingPromotionMove(null);
            setSelectedSquare(null);
            setPossibleMoves([]);
          }}
        />
      )}

      {/* Resignation Confirmation Modal */}
      {showResignConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl space-y-4">
            <h4 className="text-xl font-black text-white">Are you sure you want to resign?</h4>
            <p className="text-xs text-slate-400">Resigning will immediately declare your opponent the winner.</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowResignConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResign}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-600/30"
              >
                Resign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Match Results Overlay */}
      {matchEnded && scoreboard.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl space-y-5">
            <div className="text-center relative">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-black uppercase tracking-widest inline-block mb-1">
                {resultLabels.main}
              </span>
              <h3 className="text-2xl font-extrabold text-white">{resultLabels.sub}</h3>
            </div>

            {/* Automatic Move Quality & Accuracy Summary Card */}
            {reviewResultData && (
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-300 flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-400" /> Automatic Move Telemetry</span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Engine Analysis</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* White Telemetry */}
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                    <div className="font-bold text-slate-200 flex items-center justify-between">
                      <span className="truncate">{gameState.whiteUsername} (W)</span>
                      <span className="text-emerald-400 font-extrabold">{reviewResultData.summary.whiteAccuracy}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-center pt-1">
                      <div className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded p-1">
                        <div className="font-bold">{reviewResultData.summary.classificationsCount.white.Brilliant || 0}</div>
                        <div className="text-[8px] uppercase">Brilliant</div>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded p-1">
                        <div className="font-bold">{reviewResultData.summary.classificationsCount.white['Best Move'] || 0}</div>
                        <div className="text-[8px] uppercase">Best</div>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded p-1">
                        <div className="font-bold">
                          {isPassMode || myColor === 'w' ? (reviewResultData.summary.classificationsCount.white.Blunder || 0) : '🔒 Private'}
                        </div>
                        <div className="text-[8px] uppercase">Blunder</div>
                      </div>
                    </div>
                  </div>

                  {/* Black Telemetry */}
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                    <div className="font-bold text-slate-200 flex items-center justify-between">
                      <span className="truncate">{gameState.blackUsername} (B)</span>
                      <span className="text-indigo-400 font-extrabold">{reviewResultData.summary.blackAccuracy}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-center pt-1">
                      <div className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded p-1">
                        <div className="font-bold">{reviewResultData.summary.classificationsCount.black.Brilliant || 0}</div>
                        <div className="text-[8px] uppercase">Brilliant</div>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded p-1">
                        <div className="font-bold">{reviewResultData.summary.classificationsCount.black['Best Move'] || 0}</div>
                        <div className="text-[8px] uppercase">Best</div>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded p-1">
                        <div className="font-bold">
                          {isPassMode || myColor === 'b' ? (reviewResultData.summary.classificationsCount.black.Blunder || 0) : '🔒 Private'}
                        </div>
                        <div className="text-[8px] uppercase">Blunder</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Standings List */}
            <div className="space-y-3 relative overflow-y-auto max-h-[30vh]">
              <div className="divide-y divide-slate-800 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                {scoreboard.map((row) => (
                  <div key={row.userId} className="flex justify-between items-center text-sm py-2">
                    <div className="flex items-center gap-3">
                      <span className={`font-black w-4 ${row.placement === 1 ? 'text-amber-400' : 'text-slate-500'}`}>
                        #{row.placement}
                      </span>
                      <div>
                        <span className="font-extrabold text-slate-200">{row.username}</span>
                        {row.ratingAfter && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <span>Rating: {row.ratingAfter}</span>
                            <span className={row.ratingChange >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                              ({row.ratingChange >= 0 ? `+${row.ratingChange}` : row.ratingChange})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] font-bold text-slate-400">+{row.xpEarned} XP</span>
                      <span className="text-xs font-black text-amber-400">+{row.coinsEarned} 🪙</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Review Agent Button */}
            <button
              onClick={() => setShowAiReviewModal(true)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-bold text-white text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/25 hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-emerald-300" /> Analyze Deeply with AI Review
            </button>

            <button
              onClick={() => onReturnToLobby && onReturnToLobby()}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-xs uppercase tracking-wider shadow-lg transition-all"
            >
              Return to Menu / Lobby
            </button>
          </div>
        </div>
      )}

      {/* AI Review Modal */}
      <ChessReviewModal
        isOpen={showAiReviewModal}
        onClose={() => setShowAiReviewModal(false)}
        reviewData={reviewResultData}
        whiteUsername={gameState.whiteUsername}
        blackUsername={gameState.blackUsername}
      />
    </div>
  );
}
