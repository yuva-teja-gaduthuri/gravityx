import React from 'react';
import { Target, Zap, Shield, Sparkles, X } from 'lucide-react';

interface PuzzleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PuzzleModal: React.FC<PuzzleModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg">
      <div className="relative w-full max-w-lg bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl p-6 sm:p-8 text-center overflow-hidden">
        {/* Glow backdrop effect */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-indigo-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5" /> Launching Soon
        </div>

        {/* Header Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/30 mb-5 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Target className="w-10 h-10 text-indigo-400" />
          </div>
        </div>

        <h3 className="text-2xl font-black text-white tracking-tight">PUZZLE MODE</h3>
        <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">
          Master tactical checkmates, forks, pins, and endgames like a grandmaster.
        </p>

        {/* Features Preview List */}
        <div className="mt-6 space-y-3 text-left">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300">
            <Zap className="w-5 h-5 text-amber-400 shrink-0" />
            <span><strong>Tactical Challenges:</strong> Solve Mate in 1, Mate in 2, Discovered Attacks & Pins.</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300">
            <Shield className="w-5 h-5 text-indigo-400 shrink-0" />
            <span><strong>Adaptive Rating:</strong> Level up your tactics rating based on speed and accuracy.</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300">
            <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
            <span><strong>Daily Puzzles:</strong> Fresh grandmaster challenges updated every 24 hours.</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full mt-6 py-3.5 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95"
        >
          Got It! Stay Tuned
        </button>
      </div>
    </div>
  );
};
