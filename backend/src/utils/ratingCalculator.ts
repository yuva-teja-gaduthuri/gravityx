/**
 * Elo Rating Calculation Utility
 */

export interface RatingResult {
  newRatingA: number;
  newRatingB: number;
  changeA: number;
  changeB: number;
}

export function calculateElo(
  ratingA: number,
  ratingB: number,
  scoreA: number, // 1 for win, 0 for loss, 0.5 for draw
  kFactor: number = 32
): RatingResult {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

  const scoreB = 1 - scoreA;

  const changeA = Math.round(kFactor * (scoreA - expectedA));
  const changeB = Math.round(kFactor * (scoreB - expectedB));

  return {
    newRatingA: Math.max(100, ratingA + changeA),
    newRatingB: Math.max(100, ratingB + changeB),
    changeA,
    changeB,
  };
}
