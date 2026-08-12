import { Chess } from 'chess.js';

export type MoveClassification =
  | 'Brilliant'
  | 'Great Move'
  | 'Best Move'
  | 'Excellent'
  | 'Good'
  | 'Book Move'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Blunder'
  | 'Missed Win'
  | 'Forced Move';

export interface EvaluatedMove {
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  fen: string;
  evalCentipawns: number;
  classification: MoveClassification;
}

export interface ReviewSummary {
  whiteAccuracy: number;
  blackAccuracy: number;
  classificationsCount: {
    white: Record<MoveClassification, number>;
    black: Record<MoveClassification, number>;
  };
  evaluationGraph: { moveNumber: number; eval: number; san: string }[];
  criticalMoments: {
    biggestBlunder?: { moveNumber: number; color: string; san: string };
    bestMove?: { moveNumber: number; color: string; san: string };
    turningPoint?: { moveNumber: number; color: string; san: string; swing: number };
  };
}

function evaluateBoard(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -10000 : 10000;
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return 0;
  }

  const board = chess.board();
  const pieceValues: Record<string, number> = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000,
  };

  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const val = pieceValues[piece.type] || 0;
      let posBonus = 0;
      if ((r === 3 || r === 4) && (c === 3 || c === 4)) {
        posBonus = 20;
      }

      if (piece.color === 'w') {
        score += val + posBonus;
      } else {
        score -= val + posBonus;
      }
    }
  }

  return score;
}

export class ChessReviewAgent {
  public static reviewGame(moveHistory: string[]): {
    evaluatedMoves: EvaluatedMove[];
    summary: ReviewSummary;
  } {
    const chess = new Chess();
    const evaluatedMoves: EvaluatedMove[] = [];
    const evalGraph: { moveNumber: number; eval: number; san: string }[] = [];

    const createDefaultCounts = (): Record<MoveClassification, number> => ({
      Brilliant: 0,
      'Great Move': 0,
      'Best Move': 0,
      Excellent: 0,
      Good: 0,
      'Book Move': 0,
      Inaccuracy: 0,
      Mistake: 0,
      Blunder: 0,
      'Missed Win': 0,
      'Forced Move': 0,
    });

    const whiteCounts = createDefaultCounts();
    const blackCounts = createDefaultCounts();

    let prevEval = 0;
    let whiteTotalCPL = 0;
    let blackTotalCPL = 0;
    let whiteMoveCount = 0;
    let blackMoveCount = 0;

    let biggestBlunder: { moveNumber: number; color: string; san: string; cpl: number } | undefined;
    let bestMove: { moveNumber: number; color: string; san: string; gain: number } | undefined;
    let maxSwing = 0;
    let turningPoint: { moveNumber: number; color: string; san: string; swing: number } | undefined;

    evalGraph.push({ moveNumber: 0, eval: 0, san: 'Start' });

    for (let i = 0; i < moveHistory.length; i++) {
      const san = moveHistory[i];
      const color = i % 2 === 0 ? 'w' : 'b';
      const moveNumber = Math.floor(i / 2) + 1;

      const legalMoves = chess.moves();
      const isForced = legalMoves.length === 1;

      try {
        chess.move(san);
      } catch (e) {
        continue;
      }

      const currentEval = evaluateBoard(chess);
      const currentFen = chess.fen();

      let cpl = color === 'w' ? prevEval - currentEval : currentEval - prevEval;
      if (cpl < 0) cpl = 0;

      let classification: MoveClassification = 'Good';

      if (i < 4) {
        classification = 'Book Move';
      } else if (isForced) {
        classification = 'Forced Move';
      } else if (cpl > 350 && ((color === 'w' && prevEval > 300) || (color === 'b' && prevEval < -300))) {
        classification = 'Missed Win';
      } else if (cpl > 300) {
        classification = 'Blunder';
      } else if (cpl > 150) {
        classification = 'Mistake';
      } else if (cpl > 80) {
        classification = 'Inaccuracy';
      } else if (cpl <= 15) {
        const isCapture = san.includes('x');
        if (isCapture && ((color === 'w' && currentEval > prevEval + 200) || (color === 'b' && currentEval < prevEval - 200))) {
          classification = 'Brilliant';
        } else if ((color === 'w' && currentEval > prevEval + 100) || (color === 'b' && currentEval < prevEval - 100)) {
          classification = 'Great Move';
        } else {
          classification = 'Best Move';
        }
      } else if (cpl <= 40) {
        classification = 'Excellent';
      } else {
        classification = 'Good';
      }

      if (color === 'w') {
        whiteCounts[classification]++;
        whiteTotalCPL += cpl;
        whiteMoveCount++;
      } else {
        blackCounts[classification]++;
        blackTotalCPL += cpl;
        blackMoveCount++;
      }

      if (classification === 'Blunder' || cpl > (biggestBlunder?.cpl || 0)) {
        if (cpl > 150) {
          biggestBlunder = { moveNumber, color, san, cpl };
        }
      }

      const gain = color === 'w' ? currentEval - prevEval : prevEval - currentEval;
      if (gain > (bestMove?.gain || 0)) {
        bestMove = { moveNumber, color, san, gain };
      }

      const swing = Math.abs(currentEval - prevEval);
      if (swing > maxSwing && i > 3) {
        maxSwing = swing;
        turningPoint = { moveNumber, color, san, swing };
      }

      evaluatedMoves.push({
        moveNumber,
        color,
        san,
        fen: currentFen,
        evalCentipawns: Math.round(currentEval / 10) / 10,
        classification,
      });

      evalGraph.push({
        moveNumber,
        eval: Math.max(-10, Math.min(10, Math.round((currentEval / 100) * 10) / 10)),
        san,
      });

      prevEval = currentEval;
    }

    const avgWhiteCPL = whiteMoveCount > 0 ? whiteTotalCPL / whiteMoveCount : 0;
    const avgBlackCPL = blackMoveCount > 0 ? blackTotalCPL / blackMoveCount : 0;

    const whiteAccuracy = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-0.003 * avgWhiteCPL))));
    const blackAccuracy = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-0.003 * avgBlackCPL))));

    return {
      evaluatedMoves,
      summary: {
        whiteAccuracy,
        blackAccuracy,
        classificationsCount: {
          white: whiteCounts,
          black: blackCounts,
        },
        evaluationGraph: evalGraph,
        criticalMoments: {
          biggestBlunder,
          bestMove,
          turningPoint,
        },
      },
    };
  }
}
