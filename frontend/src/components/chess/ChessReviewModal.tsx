import React, { useState } from 'react';
import { Trophy, TrendingUp, AlertTriangle, Zap, CheckCircle2, XCircle, ChevronRight, HelpCircle, X } from 'lucide-react';

export interface EvaluatedMove {
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  fen: string;
  evalCentipawns: number;
  classification: string;
}

export interface ReviewSummary {
  whiteAccuracy: number;
  blackAccuracy: number;
  classificationsCount: {
    white: Record<string, number>;
    black: Record<string, number>;
  };
  evaluationGraph: { moveNumber: number; eval: number; san: string }[];
  criticalMoments: {
    biggestBlunder?: { moveNumber: number; color: string; san: string };
    bestMove?: { moveNumber: number; color: string; san: string };
    turningPoint?: { moveNumber: number; color: string; san: string; swing: number };
  };
}

interface ChessReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewData: {
    evaluatedMoves: EvaluatedMove[];
    summary: ReviewSummary;
  } | null;
  whiteUsername: string;
  blackUsername: string;
  userColor?: 'w' | 'b' | 'spectator';
}

export const ChessReviewModal: React.FC<ChessReviewModalProps> = ({
  isOpen,
  onClose,
  reviewData,
  whiteUsername,
  blackUsername,
  userColor,
}) => {
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null);

  if (!isOpen || !reviewData) return null;

  const { summary, evaluatedMoves } = reviewData;

  const getBadgeColor = (classification: string) => {
    switch (classification) {
      case 'Brilliant':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'Great Move':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'Best Move':
        return 'bg-green-500/20 text-green-400 border-green-500/40';
      case 'Excellent':
        return 'bg-lime-500/20 text-lime-400 border-lime-500/40';
      case 'Good':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'Book Move':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Inaccuracy':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'Mistake':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'Blunder':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'Missed Win':
        return 'bg-pink-500/20 text-pink-400 border-pink-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  // SVG Evaluation Graph computation
  const graphPoints = summary.evaluationGraph || [];
  const maxEval = 10;
  const minEval = -10;
  const svgWidth = 400;
  const svgHeight = 120;

  const getSvgY = (val: number) => {
    const clamped = Math.max(minEval, Math.min(maxEval, val));
    // inverted: top is +10 (white advantage), bottom is -10 (black advantage)
    return svgHeight - ((clamped - minEval) / (maxEval - minEval)) * svgHeight;
  };

  const polylinePoints = graphPoints
    .map((pt, idx) => {
      const x = (idx / Math.max(1, graphPoints.length - 1)) * svgWidth;
      const y = getSvgY(pt.eval);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI Game Review</h2>
              <p className="text-xs text-slate-400">Post-Match Performance & Engine Evaluation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Accuracy Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* White Accuracy */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-white border border-slate-400" />
                  <span className="text-sm font-semibold text-slate-200">{whiteUsername} (White)</span>
                </div>
                <div className="mt-2 text-3xl font-extrabold text-white">
                  {summary.whiteAccuracy}% <span className="text-xs text-slate-400 font-normal">Accuracy</span>
                </div>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex items-center justify-center text-emerald-400 font-bold text-lg">
                {summary.whiteAccuracy}%
              </div>
            </div>

            {/* Black Accuracy */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-900 border border-slate-600" />
                  <span className="text-sm font-semibold text-slate-200">{blackUsername} (Black)</span>
                </div>
                <div className="mt-2 text-3xl font-extrabold text-white">
                  {summary.blackAccuracy}% <span className="text-xs text-slate-400 font-normal">Accuracy</span>
                </div>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-indigo-500 flex items-center justify-center text-indigo-400 font-bold text-lg">
                {summary.blackAccuracy}%
              </div>
            </div>
          </div>

          {/* Evaluation Advantage Chart */}
          <div className="p-5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" /> Game Advantage Evaluation
              </span>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> White Advantage</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400" /> Black Advantage</span>
              </div>
            </div>

            <div className="relative w-full h-32 bg-slate-950/80 rounded-lg p-2 overflow-hidden border border-slate-800">
              {/* Zero line */}
              <div className="absolute left-0 right-0 top-1/2 border-b border-slate-700/50 border-dashed" />

              <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#6366f1" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.4" />
                  </linearGradient>
                </defs>
                <polyline fill="none" stroke="#6366f1" strokeWidth="2.5" points={polylinePoints} />
              </svg>
            </div>
          </div>

          {/* Critical Moments */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {summary.criticalMoments.biggestBlunder && (!userColor || userColor === 'spectator' || summary.criticalMoments.biggestBlunder.color === userColor) && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-red-400 uppercase tracking-wider">Biggest Blunder</div>
                  <div className="text-sm font-bold text-white mt-1">
                    Move {summary.criticalMoments.biggestBlunder.moveNumber} ({summary.criticalMoments.biggestBlunder.san})
                  </div>
                  <div className="text-xs text-slate-400">
                    Played by {summary.criticalMoments.biggestBlunder.color === 'w' ? 'White' : 'Black'}
                  </div>
                </div>
              </div>
            )}

            {summary.criticalMoments.bestMove && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Best Tactical Move</div>
                  <div className="text-sm font-bold text-white mt-1">
                    Move {summary.criticalMoments.bestMove.moveNumber} ({summary.criticalMoments.bestMove.san})
                  </div>
                  <div className="text-xs text-slate-400">
                    Played by {summary.criticalMoments.bestMove.color === 'w' ? 'White' : 'Black'}
                  </div>
                </div>
              </div>
            )}

            {summary.criticalMoments.turningPoint && (
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3">
                <Zap className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Turning Point</div>
                  <div className="text-sm font-bold text-white mt-1">
                    Move {summary.criticalMoments.turningPoint.moveNumber} ({summary.criticalMoments.turningPoint.san})
                  </div>
                  <div className="text-xs text-slate-400">Significant shift in evaluation</div>
                </div>
              </div>
            )}
          </div>

          {/* Move-by-Move Analysis Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="p-4 border-b border-slate-800 font-bold text-sm text-slate-200">
              Move Analysis & Engine Classifications
            </div>
            <div className="divide-y divide-slate-800 max-h-60 overflow-y-auto">
              {evaluatedMoves.map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedMoveIndex(idx)}
                  className={`flex items-center justify-between p-3 text-xs transition-colors cursor-pointer hover:bg-slate-800/60 ${
                    selectedMoveIndex === idx ? 'bg-indigo-500/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-slate-400 font-mono">{m.moveNumber}.{m.color === 'w' ? 'W' : 'B'}</span>
                    <span className="font-bold text-white text-sm w-16">{m.san}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${getBadgeColor(m.classification)}`}>
                      {m.classification}
                    </span>
                  </div>
                  <div className="text-slate-400 font-mono">
                    Eval: {m.evalCentipawns > 0 ? `+${m.evalCentipawns}` : m.evalCentipawns}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
