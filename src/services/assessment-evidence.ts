import { randomUUID } from "node:crypto";

import { createAiAssessmentService, createConfiguredProviderAdapters } from "@/ai";
import type { KaushalDatabase } from "@/db/client";
import { EVIDENCE_RELIABILITY, scoreAssessment, type AssessmentResult, type Evidence } from "@/domain/assessment";
import { requirements, type StoredQuestion } from "@/services/assessment-prefill";
import { LearningService } from "@/services/learning-service";

type Row = Record<string, unknown>;
export type EvaluatedAnswer = { level: number; reliability: number; reason: string };

export function assessmentAi() {
  const adapters = createConfiguredProviderAdapters();
  return createAiAssessmentService({ ...adapters, logger: (event) => console.warn(JSON.stringify(event)) });
}

/**
 * Current assessment evidence plus the official's learning history as a bounded
 * prior. History for competencies outside the pinned matrix is left out, since
 * a quiz or course can target any competency in the library.
 */
export function assessmentEvidence(db: KaushalDatabase, assessmentId: string): Evidence[] {
  const assessment = db.prepare("SELECT official_id,matrix_version_id FROM assessments WHERE id=?").get(assessmentId) as Row | undefined;
  const current = (db.prepare("SELECT * FROM evidence WHERE assessment_id=? ORDER BY created_at,id").all(assessmentId) as Row[]).map((row) => ({
    id: String(row.id), competencyId: String(row.competency_id), source: String(row.source_type) as Evidence["source"],
    demonstratedLevel: Number(row.level), reliability: Number(row.reliability), reason: String(row.rationale ?? "Assessment response"),
    round: Number(String(row.id).match(/:r([123]):/)?.[1] ?? 1) as 1 | 2 | 3,
  }));
  if (!assessment) return current;
  const matrixIds = new Set(requirements(db, String(assessment.matrix_version_id)).map((item) => item.competencyId));
  const history = (db.prepare("SELECT id,competency_id,source_type,level,reliability FROM learning_history WHERE official_id=? ORDER BY recorded_at,id").all(assessment.official_id) as Row[])
    .filter((row) => matrixIds.has(String(row.competency_id)))
    .map((row) => ({
      id: `history:${String(row.id)}`, competencyId: String(row.competency_id), source: String(row.source_type) as Evidence["source"],
      demonstratedLevel: Number(row.level), reliability: Number(row.reliability), reason: "Prior verified learning history", round: null,
    }));
  return [...current, ...history];
}

export function writeResults(db: KaushalDatabase, assessmentId: string, result: AssessmentResult): void {
  db.prepare("DELETE FROM assessment_results WHERE assessment_id=?").run(assessmentId);
  const insert = db.prepare(`INSERT INTO assessment_results(id,assessment_id,competency_id,assessed_level,required_level,gap,priority,confidence,supported)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const item of result.competencies) {
    insert.run(randomUUID(), assessmentId, item.competencyId, item.assessedLevel, item.requiredLevel, item.gap, item.priority, item.confidence, item.supported ? 1 : 0);
  }
}

/**
 * Re-scores a finished assessment from its stored evidence and history, then
 * rebuilds the learning path. Returns null when the assessment is still running,
 * because in-progress rounds are scored by the round flow itself.
 */
export function rescoreAssessment(db: KaushalDatabase, assessmentId: string): AssessmentResult | null {
  const assessment = db.prepare("SELECT status,matrix_version_id FROM assessments WHERE id=?").get(assessmentId) as Row | undefined;
  if (!assessment || !["completed", "provisional"].includes(String(assessment.status))) return null;
  const scored = scoreAssessment(requirements(db, String(assessment.matrix_version_id)), assessmentEvidence(db, assessmentId));
  if (!scored.ok) throw new Error(scored.error.message);
  db.transaction(() => writeResults(db, assessmentId, scored.value))();
  new LearningService(db).createPath(assessmentId);
  return scored.value;
}

/** Scores personalized-style questions: choices deterministically, written answers through the AI rubric evaluator. */
export async function evaluateAdaptiveAnswers(
  questions: StoredQuestion[],
  answers: Map<string, string>,
  context: { assessmentSessionId: string; matrixVersionId: string },
): Promise<Map<string, EvaluatedAnswer>> {
  const evaluated = new Map<string, EvaluatedAnswer>();
  const written = questions.filter((question) => question.format === "short_text");
  if (written.length > 0) {
    const result = await assessmentAi().evaluateWrittenAnswers({
      ...context,
      answers: written.map((question) => ({ questionId: question.id, competencyId: question.competencyId, answer: answers.get(question.id)!, rubric: question.rubric, fallbackDemonstratedLevel: 2 })),
    });
    for (const item of result.data.evaluations) {
      evaluated.set(item.questionId, { level: item.demonstratedLevel, reliability: Math.min(0.8, Math.max(0.1, item.confidence ?? 0.6)), reason: item.evidenceSummary });
    }
  }
  for (const question of questions) {
    if (question.format !== "single_choice") continue;
    const option = question.options.find((item) => item.id === answers.get(question.id));
    if (!option) throw new Error("Answer is not one of the stored choices");
    // AI-authored choices keep ai-written provenance (0.8), not the fixed-bank 1.0.
    evaluated.set(question.id, { level: option.demonstratedLevel, reliability: EVIDENCE_RELIABILITY["ai-written"], reason: `Selected: ${option.text}` });
  }
  return evaluated;
}
