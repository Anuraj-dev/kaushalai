import { MAX_LEVEL, MIN_LEVEL } from "./scoring";

export const FOCUSED_CHECK_QUESTIONS = 3;

/**
 * Maps a quiz score to a proficiency level in fixed 20% bands:
 * 0-19% → 1, 20-39% → 2, 40-59% → 3, 60-79% → 4, 80-100% → 5.
 * The band table is shown to learners, so keep it in step with the UI copy.
 */
export function quizDemonstratedLevel(correct: number, total: number): number {
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) {
    throw new Error("Quiz score must be a whole number of correct answers out of a positive total");
  }
  return Math.min(MAX_LEVEL, MIN_LEVEL + Math.floor((correct / total) * 5));
}
