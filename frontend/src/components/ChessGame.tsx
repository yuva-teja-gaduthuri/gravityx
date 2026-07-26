import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Chess } from 'chess.js';
import confetti from 'canvas-confetti';
import { Trophy, Timer, Play, ShieldAlert, Sparkles, Volume2, VolumeX, Settings, Maximize, Minimize, Heart, UserPlus, MessageSquare, X } from 'lucide-react';
import { getApiUrl } from '../utils/api';
import { useTranslation } from '../hooks/useTranslation';

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
  moveHistory: string[];
  isGameOver: boolean;
  winnerId: string | null;
  drawReason: string | null;
}

export default function ChessGame({ roomCode, user, socket, isHost, matchEndedData, onReturnToLobby }: ChessGameProps) {
  const { t } = useTranslation();
  const [gameState, setGameState] = useState<ChessState | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [matchEnded, setMatchEnded] = useState(false);
  const [scoreboard, setScoreboard] = useState<any[]>([]);

  // Social States
  const [likesMap, setLikesMap] = useState<{[username: string]: number}>({});
  const [friendStatus, setFriendStatus] = useState<{[username: string]: string}>({});
  const [reviewModalUser, setReviewModalUser] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // local instance of chess.js to compute valid moves for highlights
  const [chessInstance, setChessInstance] = useState<Chess | null>(null);

  // Sync state on connection
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

    const handleMatchEnded = (data: any) => {
      setMatchEnded(true);
      setScoreboard(data.scoreboard || []);
      
      // Determine if current user won
      const isWinner = data.scoreboard.find((row: any) => row.userId === user.id && row.placement === 1);
      if (isWinner) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
    };

    socket.on('chess_state_sync', handleSync);
    socket.on('chess_match_ended', handleMatchEnded);

    return () => {
      socket.off('chess_state_sync', handleSync);
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

  if (!gameState || !chessInstance) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 rounded-full border-4 border-cybergold/20 border-t-cybergold animate-spin mb-4" />
        <span className="text-xs uppercase font-extrabold tracking-widest text-gray-500">Initializing Tactical Board...</span>
      </div>
    );
  }

  // Determine piece color
  const myId = user.id;
  const isWhite = myId === gameState.whitePlayerId;
  const isBlack = myId === gameState.blackPlayerId;
  const myColor = isWhite ? 'w' : isBlack ? 'b' : 'spectator';
  const isMyTurn = gameState.turn === myColor;

  // Board flipping configuration: Black is bottom if player is Black
  const isFlipped = myColor === 'b';

  const board = chessInstance.board();

  // Click handler on squares
  const handleSquareClick = (squareName: string) => {
    if (matchEnded || myColor === 'spectator' || !isMyTurn) return;

    const square = chessInstance.get(squareName as any);

    // If square contains our own piece, select it and show moves
    if (square && square.color === myColor) {
      setSelectedSquare(squareName);
      const moves = chessInstance.moves({ square: squareName as any, verbose: true });
      setPossibleMoves(moves.map(m => m.to));
    } else if (selectedSquare) {
      // If we already selected a piece, attempt to move
      if (possibleMoves.includes(squareName)) {
        // Emit chess move
        socket.emit('chess_move', {
          roomCode,
          from: selectedSquare,
          to: squareName,
        });

        // Optimistic local update
        try {
          chessInstance.move({ from: selectedSquare, to: squareName });
          setChessInstance(new Chess(chessInstance.fen()));
        } catch (e) {
          // ignore optimist errors, server will correct
        }

        setSelectedSquare(null);
        setPossibleMoves([]);
      } else {
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
    }
  };

  // Convert piece type/color to unicode high fidelity symbol
  const getPieceSymbol = (type: string, color: 'w' | 'b') => {
    const pieces: { [key: string]: string } = {
      p: color === 'w' ? '♙' : '♟',
      r: color === 'w' ? '♖' : '♜',
      n: color === 'w' ? '♘' : '♞',
      b: color === 'w' ? '♗' : '♝',
      q: color === 'w' ? '♕' : '♛',
      k: color === 'w' ? '♔' : '♚',
    };
    return pieces[type] || '';
  };

  // Generate board cells
  const squares = [];
  const startRow = isFlipped ? 7 : 0;
  const endRow = isFlipped ? -1 : 8;
  const stepRow = isFlipped ? -1 : 1;

  const startCol = isFlipped ? 7 : 0;
  const endCol = isFlipped ? -1 : 8;
  const stepCol = isFlipped ? -1 : 1;

  for (let r = startRow; r !== endRow; r += stepRow) {
    for (let c = startCol; c !== endCol; c += stepCol) {
      const square = board[r][c];
      const file = String.fromCharCode(97 + c);
      const rank = 8 - r;
      const squareName = `${file}${rank}`;
      
      const isSquareDark = (r + c) % 2 === 1;
      const isSelected = selectedSquare === squareName;
      const isPossibleMove = possibleMoves.includes(squareName);

      // Warning overlay if King is in check
      const isCheckWarning = square && square.type === 'k' && square.color === chessInstance.turn() && chessInstance.inCheck();

      squares.push(
        <div
          key={squareName}
          onClick={() => handleSquareClick(squareName)}
          className={`relative aspect-square flex items-center justify-center cursor-pointer transition-all select-none ${
            isSquareDark ? 'bg-[#769656]' : 'bg-[#eeeed2]'
          } ${
            isSelected ? 'ring-4 ring-cybergold ring-inset z-10' : ''
          } ${
            isCheckWarning ? 'bg-red-600/75 animate-pulse' : ''
          }`}
        >
          {/* Coordinates Labels */}
          {c === (isFlipped ? 7 : 0) && (
            <span className={`absolute top-1 left-1.5 text-[8px] font-black uppercase ${
              isSquareDark ? 'text-[#eeeed2]' : 'text-[#769656]'
            }`}>
              {rank}
            </span>
          )}
          {r === (isFlipped ? 0 : 7) && (
            <span className={`absolute bottom-0.5 right-1.5 text-[8px] font-black uppercase ${
              isSquareDark ? 'text-[#eeeed2]' : 'text-[#769656]'
            }`}>
              {file}
            </span>
          )}

          {/* Piece representation */}
          {square && (
            <span className={`text-4xl sm:text-5xl font-black filter drop-shadow-md transition-all active:scale-95 ${
              square.color === 'w' ? 'text-white' : 'text-[#1c1c1c]'
            }`} style={{ WebkitTextStroke: square.color === 'w' ? '1px rgba(0,0,0,0.5)' : 'none' }}>
              {getPieceSymbol(square.type, square.color)}
            </span>
          )}

          {/* Possible target movement overlay dot */}
          {isPossibleMove && (
            <div className={`w-3.5 h-3.5 rounded-full ${
              square ? 'border-4 border-black/25 bg-transparent' : 'bg-black/25'
            }`} />
          )}
        </div>
      );
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      {/* Settings Row */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <Trophy className="text-cybergold" size={20} />
          <h2 className="text-sm font-black uppercase tracking-wider text-white">Tactical Arena</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chess Board Column */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          
          {/* Opponent Info card */}
          <div className="glass-card rounded-2xl p-4 border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-cyberpink/20 border border-cyberpink/30 flex items-center justify-center text-sm font-bold uppercase text-cyberpink">
                {isFlipped ? gameState.whiteUsername[0] : gameState.blackUsername[0]}
              </div>
              <div>
                <span className="font-extrabold text-xs text-gray-200">
                  {isFlipped ? gameState.whiteUsername : gameState.blackUsername}
                </span>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-black">
                  {isFlipped ? t('chessWhite', 'WHITE (1st)') : t('chessBlack', 'BLACK (2nd)')}
                </p>
              </div>
            </div>
            {/* Clock Timer */}
            {gameState.turn === (isFlipped ? 'w' : 'b') && (
              <div className="flex items-center gap-1.5 bg-cybererror/10 border border-cybererror/20 px-2.5 py-1 rounded-xl text-cybererror text-xs font-black animate-pulse">
                <Timer size={12} />
                <span>{t('chessActiveTurn', 'ACTIVE TURN')}</span>
              </div>
            )}
          </div>

          {/* Chess Board wrapper */}
          <div className="w-full max-w-md mx-auto aspect-square rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
              {squares}
            </div>
          </div>

          {/* User Info card */}
          <div className="glass-card rounded-2xl p-4 border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-cyberblue/20 border border-cyberblue/30 flex items-center justify-center text-sm font-bold uppercase text-cyberblue">
                {isFlipped ? gameState.blackUsername[0] : gameState.whiteUsername[0]}
              </div>
              <div>
                <span className="font-extrabold text-xs text-gray-200">
                  {isFlipped ? gameState.blackUsername : gameState.whiteUsername}
                </span>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-black">
                  {isFlipped ? t('chessBlack', 'BLACK (2nd)') : t('chessWhite', 'WHITE (1st)')}
                </p>
              </div>
            </div>
            {/* Clock Timer */}
            {gameState.turn === (isFlipped ? 'b' : 'w') && (
              <div className="flex items-center gap-1.5 bg-cybersuccess/10 border border-cybersuccess/20 px-2.5 py-1 rounded-xl text-cybersuccess text-xs font-black animate-pulse">
                <Timer size={12} />
                <span>{t('chessYourTurn', 'YOUR TURN')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Moves log and game console panel */}
        <div className="glass-card rounded-3xl p-6 border-white/5 flex flex-col justify-between h-[450px] lg:h-auto gap-4">
          <div className="space-y-4 flex-grow overflow-y-auto">
            <h3 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">
              {t('chessLogMoves', 'Command log moves')}
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-semibold text-gray-400">
              {gameState.moveHistory.map((move, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-slate-600">{Math.floor(idx / 2) + 1}.</span>
                  <span className="text-gray-300 font-extrabold">{move}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {isHost ? (
              <button
                onClick={() => onReturnToLobby && onReturnToLobby()}
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-wider text-white transition-all active:scale-95"
              >
                {t('chessReturnLobby', 'Return to Lobby')}
              </button>
            ) : (
              <div className="text-center py-2.5 text-xs text-gray-500 font-bold uppercase tracking-wider animate-pulse">
                {t('chessWaitingHost', 'Waiting for host to return...')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Standings scoreboard overlay modal */}
      {matchEnded && scoreboard.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden shadow-neon-purple animate-float-slow">
            
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-cyberpink/10 rounded-full blur-2xl"></div>

            <div className="text-center mb-6 relative">
              <span className="text-[10px] font-black uppercase text-cyberblue tracking-widest">{t('chessEnded', 'Match Terminal Ended')}</span>
              <h3 className="text-3xl font-extrabold text-white mt-1">{t('chessStandings', 'Standings Log')}</h3>
              <p className="text-sm text-gray-400 mt-1">{t('chessPlacementsLocked', 'Placements locked. Transmitting rewards.')}</p>
            </div>

            <div className="space-y-3 mb-6 relative overflow-y-auto max-h-[50vh] pr-1">
              <div className="divide-y divide-white/5 bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
                {scoreboard.map((row) => {
                  const isSelf = row.username === user.username;
                  const isFriendAdded = friendStatus[row.username] === 'sent';
                  const isFriendSending = friendStatus[row.username] === 'sending';

                  return (
                    <div key={row.userId} className="flex flex-col py-2.5 first:pt-0 last:pb-0 gap-2">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-3">
                          <span className={`font-black w-4 ${
                            row.placement === 1 ? 'text-cybergold' : 'text-gray-500'
                          }`}>
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
                              {isFriendAdded ? t('friendRequestSent', 'Friend Request Sent') : isFriendSending ? 'Sending...' : t('addFriendBtn', 'Add Friend')}
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
                className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-cyberblue font-bold shadow-neon-blue hover:opacity-90 active:scale-95 transition-all text-center relative"
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
            <button 
              onClick={() => setReviewModalUser(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
            <h4 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              {t('writeReviewFor', 'Write Review for')} {reviewModalUser}
            </h4>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{t('selectStarRating', 'Select Star Rating')}</label>
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
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{t('commentFeedback', 'Comment/Feedback')}</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={t('tellHowPlayed', 'Tell others how this user played...')}
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
