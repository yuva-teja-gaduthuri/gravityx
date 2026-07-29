import React from 'react';
import { ChessSVG } from './ChessSVG';

interface ChessPromotionModalProps {
  color: 'w' | 'b';
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

export const ChessPromotionModal: React.FC<ChessPromotionModalProps> = ({ color, onSelect, onCancel }) => {
  const pieces: { type: 'q' | 'r' | 'b' | 'n'; label: string }[] = [
    { type: 'q', label: 'Queen' },
    { type: 'r', label: 'Rook' },
    { type: 'b', label: 'Bishop' },
    { type: 'n', label: 'Knight' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-xs bg-slate-900 border-2 border-cybergold/60 rounded-3xl p-5 shadow-[0_12px_40px_rgba(247,192,66,0.3)] text-center relative">
        <h3 className="text-sm font-black uppercase tracking-wider text-white mb-1">Pawn Promotion</h3>
        <p className="text-[11px] text-gray-400 mb-4">Choose a piece to promote your pawn:</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {pieces.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-cybergold hover:bg-cybergold/10 transition-all duration-200 group active:scale-95"
            >
              <div className="w-10 h-10 group-hover:scale-110 transition-transform mb-1">
                <ChessSVG type={type} color={color} />
              </div>
              <span className="text-xs font-bold text-gray-200 group-hover:text-cybergold">{label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="text-xs font-bold text-gray-500 hover:text-white uppercase tracking-wider transition-colors"
        >
          Cancel Move
        </button>
      </div>
    </div>
  );
};
