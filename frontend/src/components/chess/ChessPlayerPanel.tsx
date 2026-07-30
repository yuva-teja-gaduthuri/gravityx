import React from 'react';
import { Timer, ShieldAlert } from 'lucide-react';
import { ChessSVG } from './ChessSVG';

export interface CapturedPiece {
  piece: string;
  color: 'w' | 'b';
  capturedBy: string;
  sequence: number;
}

interface ChessPlayerPanelProps {
  username: string;
  color: 'w' | 'b';
  isTurn: boolean;
  timeLeft: number; // in seconds
  isCheck: boolean;
  capturedPieces: CapturedPiece[];
  rating?: number;
  isSelf: boolean;
}

export const ChessPlayerPanel: React.FC<ChessPlayerPanelProps> = ({
  username,
  color,
  isTurn,
  timeLeft,
  isCheck,
  capturedPieces,
  rating = 1200,
  isSelf,
}) => {
  const isWhite = color === 'w';

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Clock visual state styling based on time left
  let timerBg = 'bg-slate-800/90 text-gray-200 border-white/10';
  if (isTurn) {
    if (timeLeft <= 30) {
      timerBg = 'bg-red-600/90 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.7)] animate-pulse';
    } else if (timeLeft <= 120) {
      timerBg = 'bg-amber-500/90 text-slate-950 border-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
    } else {
      timerBg = 'bg-emerald-600/90 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]';
    }
  }

  // Filter captured pieces taken by THIS player (i.e. opponent pieces captured by this player)
  const myCapturedPieces = capturedPieces.filter((cp) => cp.color !== color);

  return (
    <div
      className={`w-full max-w-[560px] mx-auto rounded-2xl p-3 sm:p-4 transition-all border backdrop-blur-xl ${
        isTurn
          ? 'bg-slate-900/90 border-cybergold/60 shadow-[0_0_20px_rgba(247,192,66,0.25)] ring-1 ring-cybergold/40'
          : 'bg-slate-950/70 border-white/10 opacity-90'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Avatar & Name */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center text-sm font-black uppercase shrink-0 shadow-md ${
              isWhite
                ? 'bg-gradient-to-br from-gray-100 to-gray-300 text-slate-950 border-white'
                : 'bg-gradient-to-br from-slate-800 to-slate-950 text-white border-slate-700'
            }`}
          >
            {username ? username[0] : isWhite ? 'W' : 'B'}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs sm:text-sm text-white truncate max-w-[130px] sm:max-w-[180px]">
                {username} {isSelf && <span className="text-[10px] text-cyberblue font-bold">(You)</span>}
              </span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-white/10 text-cybergold border border-cybergold/30">
                {rating}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest font-black text-gray-400">
                <span className={`w-2 h-2 rounded-full ${isWhite ? 'bg-white border border-black/40' : 'bg-black border border-white/40'}`} />
                {isWhite ? 'WHITE' : 'BLACK'}
              </span>

              {/* Connection online dot */}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
          </div>
        </div>

        {/* Right: Check warning & Clock Timer */}
        <div className="flex items-center gap-2 shrink-0">
          {isCheck && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-red-600/30 border border-red-500 text-red-400 text-[10px] font-black animate-bounce shadow-lg">
              <ShieldAlert size={14} />
              <span>CHECK</span>
            </div>
          )}

          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-mono font-black transition-all ${timerBg}`}>
            <Timer size={14} className={isTurn ? 'animate-spin-slow' : ''} />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Captured Pieces Tray (Below player's info, chronological sequence) */}
      <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-xs min-h-[26px]">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <span className="text-[9px] font-bold uppercase text-gray-500 mr-1 shrink-0">Captured:</span>
          {myCapturedPieces.length > 0 ? (
            myCapturedPieces.map((cp, idx) => (
              <div
                key={idx}
                className="w-5 h-5 shrink-0 flex items-center justify-center p-0.5 rounded bg-white/5 border border-white/10 hover:scale-125 transition-transform"
                title={`Captured ${cp.piece.toUpperCase()} (Move #${cp.sequence})`}
              >
                <ChessSVG type={cp.piece} color={cp.color} />
              </div>
            ))
          ) : (
            <span className="text-[10px] text-gray-600 italic">None yet</span>
          )}
        </div>
      </div>
    </div>
  );
};
