import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Chess, Square } from 'chess.js';
import confetti from 'canvas-confetti';
import { Trophy, Maximize, Minimize, Heart, UserPlus, MessageSquare, X, RefreshCw } from 'lucide-react';
import { getApiUrl } from '../utils/api';
import { useTranslation } from '../hooks/useTranslation';

import { ChessBoard } from './chess/ChessBoard';
import { ChessPlayerPanel, CapturedPiece } from './chess/ChessPlayerPanel';
import { ChessMoveHistory } from './chess/ChessMoveHistory';
import { ChessPromotionModal } from './chess/ChessPromotionModal';

interface ChessGameProps {
  roomCode: string;
  user: { id: string; username: string; isGuest?: boolean };
  socket: Socket;
  isHost: boolean;
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
  whiteTimeLeft: number;
  blackTimeLeft: number;
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
}

export default function ChessGame({ roomCode, user, socket, isHost, matchEndedData, onReturnToLobby }: ChessGameProps) {
  const { t } = useTranslation();
  const [gameState, setGameState] = useState<ChessState | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [pendingPromotionMove, setPendingPromotionMove] = useState<{ from: string; to: string } | null>(null);

  const [matchEnded, setMatchEnded] = useState(false);
  const [scoreboard, setScoreboard] = useState<any[]>([]);

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
      // Audio context might be restricted before user gesture
    }
  };

  // Sync state on socket connection
  useEffect(() => {
    socket.emit('chess_sync_state', roomCode);

    const handleSync = (state: ChessState) => {
      setGameState(state);
      const chess = new Chess(state.fen);
      setChessInstance(chess);

      if (state.isGameOver) {
        setMatchEnded(true);
      }
    };

    const handleTimerTick = (data: { whiteTimeLeft: number; blackTimeLeft: number; activeTurn: 'w' | 'b' }) => {
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              whiteTimeLeft: data.whiteTimeLeft,
              blackTimeLeft: data.blackTimeLeft,
              turn: data.activeTurn,
            }
          : prev
      );
    };

    const handleMatchEnded = (data: any) => {
      setMatchEnded(true);
      setScoreboard(data.scoreboard || []);

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
  }, [socket, roomCode, user.id]);

  // Sync match ended data if passed from room wrapper
  useEffect(() => {
    if (matchEndedData) {
      setMatchEnded(true);
      setScoreboard(matchEndedData.scoreboard || []);
    }
  }, [matchEndedData]);

  // Load social likes when scoreboard is shown
  useEffect(() => {
    if (matchEnded && scoreboard.length > 0) {
      const fetchLikes = async () => {
        const token = localStorage.getItem('gravityx_token');
        const initialLikes: { [username: string]: number } = {};
        for (const row of scoreboard) {
          try {
            const res = await fetch(getApiUrl(`/api/social/likes/${row.username}`), {
              headers: { Authorization: `Bearer ${token}` },
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

  // Fullscreen listener
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error enabling fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUsername: username }),
      });
      if (res.ok) {
        const data = await res.json();
        setLikesMap((prev) => ({ ...prev, [username]: data.likesCount }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveReview = async (username: string) => {
    try {
      const token = localStorage.getItem('gravityx_token');
      const res = await fetch(getApiUrl('/api/social/review'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUsername: username,
          rating: reviewRating,
          comment: reviewComment,
        }),
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
      setFriendStatus((prev) => ({ ...prev, [friendUsername]: 'sending' }));
      const token = localStorage.getItem('gravityx_token');
      const res = await fetch(getApiUrl('/api/social/request'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friendUsername }),
      });
      if (res.ok) {
        setFriendStatus((prev) => ({ ...prev, [friendUsername]: 'sent' }));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send friend request');
        setFriendStatus((prev) => ({ ...prev, [friendUsername]: 'error' }));
      }
    } catch (err) {
      console.error(err);
      setFriendStatus((prev) => ({ ...prev, [friendUsername]: 'error' }));
    }
  };

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
  const isWhite = myId === gameState.whitePlayerId;
  const isBlack = myId === gameState.blackPlayerId;
  const myColor = isWhite ? 'w' : isBlack ? 'b' : 'spectator';
  const isMyTurn = gameState.turn === myColor;

  // Board flip perspective: Black plays from bottom
  const isFlipped = myColor === 'b';

  // Handle Square Selection & Moves
  const handleSquareClick = (squareName: string) => {
    if (matchEnded || gameState.isGameOver || myColor === 'spectator' || !isMyTurn) return;

    const targetSquare = chessInstance.get(squareName as Square);

    // If square contains our own piece, select it and show legal moves
    if (targetSquare && targetSquare.color === myColor) {
      setSelectedSquare(squareName);
      const moves = chessInstance.moves({ square: squareName as Square, verbose: true });
      setPossibleMoves(moves.map((m) => m.to));
    } else if (selectedSquare) {
      // If piece is selected and target is a legal destination
      if (possibleMoves.includes(squareName)) {
        const selectedPiece = chessInstance.get(selectedSquare as Square);
        const targetRank = squareName[1];

        // Check if move is a Pawn Promotion (Pawn reaching rank 8 for White, rank 1 for Black)
        const isPromotion =
          selectedPiece &&
          selectedPiece.type === 'p' &&
          ((myColor === 'w' && targetRank === '8') || (myColor === 'b' && targetRank === '1'));

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

    socket.emit('chess_move', {
      roomCode,
      from,
      to,
      promotion: promotionChoice,
    });

    // Optimistic local move execution
    try {
      const moveResult = chessInstance.move({ from, to, promotion: promotionChoice as any });
      if (moveResult) {
        setChessInstance(new Chess(chessInstance.fen()));
        if (isCapture) {
          playAudioEffect('capture');
        } else {
          playAudioEffect('move');
        }
      }
    } catch (e) {
      // Server will correct invalid state
    }

    setSelectedSquare(null);
    setPossibleMoves([]);
    setPendingPromotionMove(null);
  };

  // Top player (Opponent) and Bottom player (You)
  const topUsername = isFlipped ? gameState.whiteUsername : gameState.blackUsername;
  const topColor: 'w' | 'b' = isFlipped ? 'w' : 'b';
  const topTimeLeft = isFlipped ? gameState.whiteTimeLeft : gameState.blackTimeLeft;
  const topIsTurn = gameState.turn === topColor;
  const topIsCheck = gameState.isCheck && topIsTurn;
  const topIsSelf = false;

  const bottomUsername = isFlipped ? gameState.blackUsername : gameState.whiteUsername;
  const bottomColor: 'w' | 'b' = isFlipped ? 'b' : 'w';
  const bottomTimeLeft = isFlipped ? gameState.blackTimeLeft : gameState.whiteTimeLeft;
  const bottomIsTurn = gameState.turn === bottomColor;
  const bottomIsCheck = gameState.isCheck && bottomIsTurn;
  const bottomIsSelf = true;

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-3 sm:p-5 overflow-y-auto">
      {/* Top Header Bar */}
      <div className="w-full max-w-[560px] flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="text-cybergold" size={18} />
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
            {t('chessTacticalArena', 'Tactical Chess Arena')}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      {/* Main Centered Tactical Stack Layout */}
      <div className="w-full max-w-[560px] flex flex-col gap-3">
        {/* 1. TOP PLAYER PANEL (Opponent) & Captured Pieces */}
        <ChessPlayerPanel
          username={topUsername}
          color={topColor}
          isTurn={topIsTurn}
          timeLeft={topTimeLeft}
          isCheck={topIsCheck}
          capturedPieces={gameState.capturedPieces}
          rating={1200}
          isSelf={topIsSelf}
        />

        {/* 2. HORIZONTAL MOVE HISTORY BAR (Fixed above board) */}
        <ChessMoveHistory moveHistory={gameState.moveHistory} />

        {/* 3. CENTERED CHESS BOARD */}
        <ChessBoard
          chessInstance={chessInstance}
          isFlipped={isFlipped}
          selectedSquare={selectedSquare}
          possibleMoves={possibleMoves}
          lastMove={gameState.lastMove}
          isMyTurn={isMyTurn}
          onSquareClick={handleSquareClick}
        />

        {/* 4. BOTTOM PLAYER PANEL (White/You) & Captured Pieces */}
        <ChessPlayerPanel
          username={bottomUsername}
          color={bottomColor}
          isTurn={bottomIsTurn}
          timeLeft={bottomTimeLeft}
          isCheck={bottomIsCheck}
          capturedPieces={gameState.capturedPieces}
          rating={1200}
          isSelf={bottomIsSelf}
        />

        {/* Return to Lobby / Host controls footer */}
        <div className="mt-2 flex items-center justify-between">
          {isHost ? (
            <button
              onClick={() => onReturnToLobby && onReturnToLobby()}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-wider text-white transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} />
              <span>{t('chessReturnLobby', 'Return to Lobby')}</span>
            </button>
          ) : (
            <div className="w-full text-center py-2 text-[11px] text-gray-500 font-bold uppercase tracking-wider animate-pulse">
              {t('chessWaitingHost', 'Waiting for host to return...')}
            </div>
          )}
        </div>
      </div>

      {/* Pawn Promotion Modal Dialog */}
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

      {/* Match Results & Scoreboard Modal Overlay */}
      {matchEnded && scoreboard.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden shadow-neon-purple animate-float-slow">
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-cyberpink/10 rounded-full blur-2xl"></div>

            <div className="text-center mb-5 relative">
              <span className="text-[10px] font-black uppercase text-cyberblue tracking-widest">
                {gameState.drawReason ? `RESULT: ${gameState.drawReason.toUpperCase()}` : t('chessEnded', 'MATCH TERMINAL COMPLETED')}
              </span>
              <h3 className="text-3xl font-extrabold text-white mt-1">{t('chessStandings', 'Match Standings')}</h3>
              <p className="text-xs text-gray-400 mt-1">{t('chessPlacementsLocked', 'Placements locked. Transmitting rewards.')}</p>
            </div>

            <div className="space-y-3 mb-6 relative overflow-y-auto max-h-[45vh] pr-1">
              <div className="divide-y divide-white/5 bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                {scoreboard.map((row) => {
                  const isSelf = row.username === user.username;
                  const isFriendAdded = friendStatus[row.username] === 'sent';
                  const isFriendSending = friendStatus[row.username] === 'sending';

                  return (
                    <div key={row.userId} className="flex flex-col py-2.5 first:pt-0 last:pb-0 gap-2">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-black w-4 ${
                              row.placement === 1 ? 'text-cybergold' : 'text-gray-500'
                            }`}
                          >
                            #{row.placement}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs uppercase font-bold border border-white/10 bg-primary/20 text-white">
                              {row.username[0]}
                            </div>
                            <div>
                              <span className="font-extrabold text-gray-200">{row.username}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3 items-center shrink-0">
                          <span className="text-[10px] font-bold text-gray-400">+{row.xpEarned} XP</span>
                          <span className="text-xs font-black text-cybergold">+{row.coinsEarned} 🪙</span>
                        </div>
                      </div>

                      {/* Social Actions */}
                      <div className="flex flex-wrap gap-2 items-center pl-7 mt-1">
                        <button
                          onClick={() => handleLike(row.username)}
                          className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-cyberpink text-[10px] font-bold text-gray-300 flex items-center gap-1.5 transition-all active:scale-90"
                        >
                          <Heart size={12} className="fill-cyberpink text-cyberpink" />
                          <span>{t('like', 'Like')} ({likesMap[row.username] || 0})</span>
                        </button>

                        {!isSelf && (
                          <button
                            onClick={() => handleAddFriendClick(row.username)}
                            disabled={isFriendAdded || isFriendSending}
                            className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-cyberblue text-[10px] font-bold text-gray-300 flex items-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            <UserPlus size={12} className="text-cyberblue" />
                            <span>
                              {isFriendAdded
                                ? t('friendRequestSent', 'Request Sent')
                                : isFriendSending
                                ? 'Sending...'
                                : t('addFriendBtn', 'Add Friend')}
                            </span>
                          </button>
                        )}

                        {!user.isGuest && !isSelf && (
                          <button
                            onClick={() => setReviewModalUser(row.username)}
                            className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-cybergold text-[10px] font-bold text-gray-300 flex items-center gap-1.5 transition-all"
                          >
                            <MessageSquare size={12} className="text-cybergold" />
                            <span>{t('reviewPlayer', 'Review Player')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {isHost ? (
              <button
                onClick={() => onReturnToLobby && onReturnToLobby()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-cyberblue font-bold shadow-neon-blue hover:opacity-90 active:scale-95 transition-all text-center relative text-xs uppercase tracking-wider"
              >
                {t('chessReturnLobby', 'Return to Lobby')}
              </button>
            ) : (
              <div className="text-center py-3 text-xs text-gray-500 font-bold animate-pulse">
                {t('chessWaitingHost', 'Waiting for host to return...')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Modal popup */}
      {reviewModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm glass-panel rounded-3xl p-6 border border-white/10 relative shadow-neon-blue">
            <button onClick={() => setReviewModalUser(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X size={16} />
            </button>
            <h4 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              {t('writeReview', 'Write Review for')} {reviewModalUser}
            </h4>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  {t('selectRating', 'Select Star Rating')}
                </label>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setReviewRating(val)}
                      className={`text-xl ${val <= reviewRating ? 'text-cybergold' : 'text-gray-600'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  {t('commentFeedback', 'Comment/Feedback')}
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={t('reviewPlaceholder', 'Tell others how this user played...')}
                  className="w-full h-24 mt-1 bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-cyberblue focus:outline-none"
                />
              </div>
              <button
                onClick={() => handleSaveReview(reviewModalUser)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-cyberblue font-bold text-xs uppercase tracking-wider shadow-md hover:opacity-90 active:scale-95 transition-all"
              >
                {t('saveReview', 'Save Review')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
