import React, { useState, useEffect, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import { ChessSVG } from './ChessSVG';

interface ChessBoardProps {
  chessInstance: Chess;
  isFlipped: boolean;
  selectedSquare: string | null;
  possibleMoves: string[];
  lastMove: { from: string; to: string; piece?: string; san?: string } | null;
  isMyTurn: boolean;
  onSquareClick: (square: string) => void;
}

interface VisualPiece {
  id: string; // Unique key for piece instance
  type: string; // 'p' | 'r' | 'n' | 'b' | 'q' | 'k'
  color: 'w' | 'b';
  square: string; // 'e4', 'e2', etc.
  col: number; // 0..7 (a..h)
  row: number; // 0..7 (8..1)
  scale?: number;
  opacity?: number;
}

interface AnimationTask {
  from: string;
  to: string;
  piece?: string;
  san?: string;
}

const squareToCoords = (square: string): [number, number] => {
  const file = square.charCodeAt(0) - 97; // 'a' -> 0
  const rank = 8 - parseInt(square[1], 10); // '8' -> 0, '1' -> 7
  return [file, rank];
};

export const ChessBoard: React.FC<ChessBoardProps> = ({
  chessInstance,
  isFlipped,
  selectedSquare,
  possibleMoves,
  lastMove,
  isMyTurn,
  onSquareClick,
}) => {
  const board = chessInstance.board();
  const isCheck = chessInstance.inCheck();
  const activeTurn = chessInstance.turn();

  // Helper to extract visual pieces array from FEN/board state
  const buildVisualPiecesFromBoard = (boardState: any[][]): VisualPiece[] => {
    const list: VisualPiece[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const item = boardState[r][c];
        if (item) {
          const file = String.fromCharCode(97 + c);
          const rank = 8 - r;
          const square = `${file}${rank}`;
          list.push({
            id: `${item.color}_${item.type}_${square}`,
            type: item.type,
            color: item.color,
            square,
            col: c,
            row: r,
            scale: 1.0,
            opacity: 1.0,
          });
        }
      }
    }
    return list;
  };

  const [visualPieces, setVisualPieces] = useState<VisualPiece[]>(() =>
    buildVisualPiecesFromBoard(chessInstance.board())
  );

  const visualPiecesRef = useRef<VisualPiece[]>(visualPieces);
  useEffect(() => {
    visualPiecesRef.current = visualPieces;
  }, [visualPieces]);

  // FIFO Animation Queue References
  const animationQueueRef = useRef<AnimationTask[]>([]);
  const isAnimatingRef = useRef<boolean>(false);
  const prevLastMoveRef = useRef<{ from: string; to: string } | null>(null);

  // Sync pieces when chessInstance changes without active animation
  useEffect(() => {
    if (!isAnimatingRef.current && animationQueueRef.current.length === 0) {
      const freshPieces = buildVisualPiecesFromBoard(chessInstance.board());
      setVisualPieces(freshPieces);
    }
  }, [chessInstance]);

  // Process animation queue sequentially
  const processNextInQueue = () => {
    if (animationQueueRef.current.length === 0 || isAnimatingRef.current) {
      return;
    }

    const task = animationQueueRef.current.shift()!;
    isAnimatingRef.current = true;

    const { from, to, san } = task;
    const [fromCol, fromRow] = squareToCoords(from);
    const [toCol, toRow] = squareToCoords(to);

    const currentPieces = [...visualPiecesRef.current];

    // Find moving piece
    const movingPieceIndex = currentPieces.findIndex((p) => p.square === from);
    if (movingPieceIndex === -1) {
      // If moving piece not found, sync directly
      const synced = buildVisualPiecesFromBoard(chessInstance.board());
      setVisualPieces(synced);
      isAnimatingRef.current = false;
      processNextInQueue();
      return;
    }

    const movingPiece = currentPieces[movingPieceIndex];
    const isCastling = san === 'O-O' || san === 'O-O-O' || (movingPiece.type === 'k' && Math.abs(toCol - fromCol) === 2);
    const isEnPassant = movingPiece.type === 'p' && fromCol !== toCol && !currentPieces.some((p) => p.square === to);

    // Update moving piece coordinates
    currentPieces[movingPieceIndex] = {
      ...movingPiece,
      square: to,
      col: toCol,
      row: toRow,
    };

    // Handle Castling Rook animation
    if (isCastling) {
      let rookFromSquare = '';
      let rookToSquare = '';
      if (to === 'g1') { rookFromSquare = 'h1'; rookToSquare = 'f1'; }
      else if (to === 'c1') { rookFromSquare = 'a1'; rookToSquare = 'd1'; }
      else if (to === 'g8') { rookFromSquare = 'h8'; rookToSquare = 'f8'; }
      else if (to === 'c8') { rookFromSquare = 'a8'; rookToSquare = 'd8'; }

      if (rookFromSquare && rookToSquare) {
        const rookIndex = currentPieces.findIndex((p) => p.square === rookFromSquare);
        if (rookIndex !== -1) {
          const [rToCol, rToRow] = squareToCoords(rookToSquare);
          currentPieces[rookIndex] = {
            ...currentPieces[rookIndex],
            square: rookToSquare,
            col: rToCol,
            row: rToRow,
          };
        }
      }
    }

    // Handle Capture / En-Passant fade out
    if (isEnPassant) {
      const epCapturedSquare = `${to[0]}${from[1]}`;
      const capturedIndex = currentPieces.findIndex((p) => p.square === epCapturedSquare);
      if (capturedIndex !== -1) {
        currentPieces[capturedIndex] = { ...currentPieces[capturedIndex], scale: 0, opacity: 0 };
      }
    } else {
      const targetIndex = currentPieces.findIndex((p) => p.square === to && p.id !== movingPiece.id);
      if (targetIndex !== -1) {
        currentPieces[targetIndex] = { ...currentPieces[targetIndex], scale: 0, opacity: 0 };
      }
    }

    setVisualPieces(currentPieces);

    // Complete move animation step after 230ms and process next task in queue
    setTimeout(() => {
      const finalBoard = chessInstance.board();
      const finalPieces = buildVisualPiecesFromBoard(finalBoard);
      setVisualPieces(finalPieces);

      isAnimatingRef.current = false;
      processNextInQueue();
    }, 230);
  };

  // Enqueue new incoming moves
  useEffect(() => {
    if (!lastMove) return;

    if (
      !prevLastMoveRef.current ||
      prevLastMoveRef.current.from !== lastMove.from ||
      prevLastMoveRef.current.to !== lastMove.to
    ) {
      prevLastMoveRef.current = lastMove;
      animationQueueRef.current.push({
        from: lastMove.from,
        to: lastMove.to,
        piece: lastMove.piece,
        san: lastMove.san,
      });

      processNextInQueue();
    }
  }, [lastMove]);

  // Generate 8x8 static board square tiles
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
      const squareName = `${file}${rank}` as Square;

      const isDark = (r + c) % 2 === 1;
      const isSelected = selectedSquare === squareName;
      const isPossible = possibleMoves.includes(squareName);
      const isLastMoveOrigin = lastMove?.from === squareName;
      const isLastMoveTarget = lastMove?.to === squareName;
      const isKingInCheck = square && square.type === 'k' && square.color === activeTurn && isCheck;

      // Base square theme styling
      let bgStyle = isDark ? 'bg-[#a67c52]' : 'bg-[#ebd7b2]';
      
      // Last move soft yellow highlight
      if (isLastMoveOrigin || isLastMoveTarget) {
        bgStyle = isDark ? 'bg-[#baca2b]' : 'bg-[#f7ec59]';
      }

      squares.push(
        <div
          key={squareName}
          onClick={() => onSquareClick(squareName)}
          className={`relative aspect-square flex items-center justify-center select-none transition-colors ${bgStyle} ${
            isMyTurn ? 'cursor-pointer hover:brightness-105' : 'cursor-default'
          } ${
            isSelected ? 'ring-4 ring-cybergold ring-inset z-20 shadow-[0_0_15px_rgba(247,192,66,0.8)]' : ''
          } ${
            isKingInCheck ? 'bg-gradient-to-r from-red-600 to-rose-700 animate-pulse z-10 shadow-[0_0_20px_rgba(225,29,72,0.9)]' : ''
          }`}
        >
          {/* Coordinates - Rank number (leftmost column) */}
          {c === (isFlipped ? 7 : 0) && (
            <span
              className={`absolute top-0.5 left-1 text-[9px] sm:text-[10px] font-black pointer-events-none ${
                isDark ? 'text-[#ebd7b2]' : 'text-[#a67c52]'
              }`}
            >
              {rank}
            </span>
          )}

          {/* Coordinates - File letter (bottom rank) */}
          {r === (isFlipped ? 0 : 7) && (
            <span
              className={`absolute bottom-0.5 right-1 text-[9px] sm:text-[10px] font-black pointer-events-none ${
                isDark ? 'text-[#ebd7b2]' : 'text-[#a67c52]'
              }`}
            >
              {file}
            </span>
          )}

          {/* Target move indicator overlays */}
          {isPossible && (
            <div
              className={`absolute z-30 rounded-full pointer-events-none transition-transform ${
                square
                  ? 'inset-1 border-4 border-black/30 bg-red-500/20 animate-pulse'
                  : 'w-3.5 h-3.5 bg-black/25 shadow-inner'
              }`}
            />
          )}
        </div>
      );
    }
  }

  return (
    <div className="w-full max-w-[560px] mx-auto aspect-square rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-slate-950 relative select-none">
      {/* 8x8 Board Square Grid */}
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {squares}
      </div>

      {/* Smoothly Animated Piece Overlay Layer */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {visualPieces.map((piece) => {
          const displayCol = isFlipped ? 7 - piece.col : piece.col;
          const displayRow = isFlipped ? 7 - piece.row : piece.row;

          return (
            <div
              key={piece.id}
              className="absolute flex items-center justify-center p-1"
              style={{
                left: `${displayCol * 12.5}%`,
                top: `${displayRow * 12.5}%`,
                width: '12.5%',
                height: '12.5%',
                transform: `scale(${piece.scale ?? 1.0})`,
                opacity: piece.opacity ?? 1.0,
                transition: 'left 230ms cubic-bezier(0.25, 1, 0.5, 1), top 230ms cubic-bezier(0.25, 1, 0.5, 1), transform 230ms ease-out, opacity 230ms ease-out',
                willChange: 'left, top, transform, opacity',
              }}
            >
              <div className="w-[85%] h-[85%] transition-transform duration-150 active:scale-95 hover:scale-105 pointer-events-auto cursor-pointer">
                <ChessSVG type={piece.type} color={piece.color} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
