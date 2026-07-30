import React from 'react';
import { Chess, Square } from 'chess.js';
import { ChessSVG } from './ChessSVG';

interface ChessBoardProps {
  chessInstance: Chess;
  isFlipped: boolean;
  selectedSquare: string | null;
  possibleMoves: string[];
  lastMove: { from: string; to: string } | null;
  isMyTurn: boolean;
  onSquareClick: (square: string) => void;
}

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

  // Generate board squares based on flip perspective
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
      
      // Last move soft yellow tint
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

          {/* Render Vector Piece */}
          {square && (
            <div className="w-[82%] h-[82%] z-10 transition-transform duration-150 active:scale-95 filter drop-shadow-md hover:scale-105">
              <ChessSVG type={square.type} color={square.color} />
            </div>
          )}

          {/* Target move indicator overlays */}
          {isPossible && (
            <div
              className={`absolute z-20 rounded-full pointer-events-none transition-transform ${
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
    <div className="w-full max-w-[560px] mx-auto aspect-square rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-slate-950">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {squares}
      </div>
    </div>
  );
};
