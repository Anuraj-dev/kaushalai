export const ROUND_2_MIN = 4;
export const ROUND_2_MAX = 5;
export const ROUND_3_MAX = 3;

export function halfCount(total: number): number {
  return Math.max(1, Math.ceil(total / 2));
}

export function round1QuestionCount(matrixSize: number): number {
  return halfCount(matrixSize);
}

export function round2QuestionCount(matrixSize: number): number {
  return Math.min(ROUND_2_MAX, Math.max(ROUND_2_MIN, halfCount(matrixSize)));
}

export function round3QuestionCount(targetSize: number): number {
  return Math.min(ROUND_3_MAX, Math.max(1, targetSize));
}

export function isValidQuestionCount(round: 1 | 2 | 3, count: number): boolean {
  if (count === 0) return false;
  if (round === 2) return count >= ROUND_2_MIN && count <= ROUND_2_MAX;
  if (round === 3) return count <= ROUND_3_MAX;
  return true;
}
