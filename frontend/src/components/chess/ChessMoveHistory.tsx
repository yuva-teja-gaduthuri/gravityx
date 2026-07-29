import React, { useEffect, useRef } from 'react';

interface ChessMoveHistoryProps {
  moveHistory: string[];
}

export const ChessMoveHistory: React.FC<ChessMoveHistoryProps> = ({ moveHistory }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest move on move update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [moveHistory.length]);

  // Support mouse wheel horizontal scrolling
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // Group moves into pairs (Turn 1: White, Black; Turn 2: White, Black...)
  const pairedMoves: { moveNumber: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    pairedMoves.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moveHistory[i],
      black: moveHistory[i + 1],
    });
  }

  return (
    <div className="w-full max-w-[560px] mx-auto bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-inner">
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth select-none text-xs font-semibold"
      >
        {pairedMoves.length === 0 ? (
          <span className="text-gray-500 italic text-[11px]">No moves played yet. Game starting...</span>
        ) : (
          pairedMoves.map((pair, idx) => {
            const isLatestPair = idx === pairedMoves.length - 1;
            const isWhiteLatest = isLatestPair && !pair.black;
            const isBlackLatest = isLatestPair && !!pair.black;

            return (
              <div
                key={pair.moveNumber}
                className="flex items-center gap-1 shrink-0 bg-white/5 border border-white/10 px-2 py-1 rounded-lg transition-all"
              >
                <span className="text-cybergold font-bold text-[10px] mr-0.5">{pair.moveNumber}.</span>
                
                {/* White Move */}
                <span
                  className={`px-1.5 py-0.5 rounded text-white font-mono font-black ${
                    isWhiteLatest
                      ? 'bg-amber-500/30 text-cybergold border border-cybergold/50 shadow-[0_0_8px_rgba(247,192,66,0.4)]'
                      : 'hover:bg-white/10'
                  }`}
                >
                  {pair.white}
                </span>

                {/* Black Move */}
                {pair.black && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-gray-300 font-mono font-black ${
                      isBlackLatest
                        ? 'bg-amber-500/30 text-cybergold border border-cybergold/50 shadow-[0_0_8px_rgba(247,192,66,0.4)]'
                        : 'hover:bg-white/10'
                    }`}
                  >
                    {pair.black}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
