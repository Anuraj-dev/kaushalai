import { randomUUID } from "node:crypto";

import type { GeneratedQuestion } from "@/ai";
import type { KaushalDatabase } from "@/db/client";
import {
  EVIDENCE_RELIABILITY,
  scoreAssessment,
  type AssessmentResult,
  type CompetencyRequirement,
  type Evidence,
} from "@/domain/assessment";
import { round1QuestionCount, round2QuestionCount, round3QuestionCount } from "@/domain/assessment/round-limits";
import { LearningService } from "@/services/learning-service";

type Row = Record<string, unknown>;

export type StoredQuestion = {
  id: string;
  competencyId: string;
  competencyName: string;
  format: "single_choice" | "short_text";
  prompt: string;
  options: Array<{ id: string; text: string; demonstratedLevel: number }>;
  rubric: Array<{ level: number; criterion: string }>;
};

export type RoundPayload = { kind: "baseline" | "personalized" | "clarification"; questions: StoredQuestion[] };
export type PublicQuestion = Omit<StoredQuestion, "rubric" | "options"> & { options: Array<{ id: string; text: string }> };

export const PREFILL_WRITTEN_ANSWER = "I would follow an established procedure and ask for review where needed.";

const parse = <T>(value: unknown, fallback: T): T => {
  try { return value ? JSON.parse(String(value)) as T : fallback; } catch { return fallback; }
};

export function requirements(db: KaushalDatabase, versionId: string): CompetencyRequirement[] {
  return (db.prepare(`SELECT mc.competency_id,c.name,mc.required_level,mc.importance
    FROM matrix_competencies mc JOIN competencies c ON c.id=mc.competency_id
    WHERE mc.matrix_version_id=? ORDER BY mc.importance DESC,c.name`).all(versionId) as Row[]).map((row) => ({
    competencyId: String(row.competency_id), name: String(row.name),
    requiredLevel: Number(row.required_level), importance: Number(row.importance),
  }));
}

export function rubrics(db: KaushalDatabase, competencyIds: string[]) {
  const result = new Map<string, Array<{ level: number; criterion: string }>>();
  for (const competencyId of competencyIds) result.set(competencyId, []);
  if (competencyIds.length === 0) return result;
  const unique = [...new Set(competencyIds)];
  const placeholders = unique.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT competency_id, level, descriptor FROM competency_rubrics WHERE competency_id IN (${placeholders}) ORDER BY competency_id, level`)
    .all(...unique) as Row[];
  for (const row of rows) {
    const id = String(row.competency_id);
    const entry = { level: Number(row.level), criterion: String(row.descriptor) };
    const bucket = result.get(id);
    if (bucket) bucket.push(entry);
    else result.set(id, [entry]);
  }
  return result;
}

export function baselineQuestions(db: KaushalDatabase, matrix: CompetencyRequirement[]): StoredQuestion[] {
  return matrix.map((requirement) => {
    const row = db.prepare("SELECT id,prompt,options_json FROM questions WHERE competency_id=? AND kind IN ('baseline_single_choice','baseline') AND active=1 ORDER BY id LIMIT 1").get(requirement.competencyId) as Row | undefined;
    if (!row) throw new Error(`Baseline question missing for ${requirement.competencyId}`);
    const options = parse<Array<{ label: string; demonstratedLevel: number }>>(row.options_json, []);
    return {
      id: String(row.id), competencyId: requirement.competencyId, competencyName: requirement.name,
      format: "single_choice", prompt: String(row.prompt), rubric: [],
      options: options.map((option, index) => ({ id: `${String(row.id)}-o${index + 1}`, text: option.label, demonstratedLevel: option.demonstratedLevel })),
    };
  });
}

export function fallbackQuestions(db: KaushalDatabase, matrix: CompetencyRequirement[], count: number, round: 2 | 3): GeneratedQuestion[] {
  const rubricMap = rubrics(db, matrix.map((item) => item.competencyId));
  return Array.from({ length: count }, (_, index) => {
    const requirement = matrix[index % matrix.length]!;
    const rows = db.prepare("SELECT prompt FROM questions WHERE competency_id=? AND kind='adaptive_fallback' AND active=1 ORDER BY id").all(requirement.competencyId) as Row[];
    const prompt = String(rows[Math.floor(index / matrix.length) % Math.max(rows.length, 1)]?.prompt ?? `Describe how you apply ${requirement.name}.`);
    return {
      id: `assessment-r${round}-${index + 1}-${requirement.competencyId}`,
      competencyId: requirement.competencyId, format: "short_text", prompt,
      targetLevel: requirement.requiredLevel, selectionReason: "Clarify evidence against the pinned matrix.",
      options: [], rubric: rubricMap.get(requirement.competencyId) ?? [],
    };
  });
}

export function toStored(generated: GeneratedQuestion[], matrix: CompetencyRequirement[]): StoredQuestion[] {
  const names = new Map(matrix.map((item) => [item.competencyId, item.name]));
  return generated.map((item) => ({
    id: item.id, competencyId: item.competencyId, competencyName: names.get(item.competencyId) ?? "Competency",
    format: item.format, prompt: item.prompt, options: item.options.map((option) => ({ id: option.id, text: option.text, demonstratedLevel: option.demonstratedLevel })), rubric: item.rubric,
  }));
}

export function publicQuestions(questions: StoredQuestion[]): PublicQuestion[] {
  return questions.map((question) => ({
    id: question.id, competencyId: question.competencyId, competencyName: question.competencyName,
    format: question.format, prompt: question.prompt, options: question.options.map(({ id, text }) => ({ id, text })),
  }));
}

export function parseRoundPayload(value: unknown): RoundPayload {
  return parse<RoundPayload>(value, { kind: "baseline", questions: [] });
}

function preferredBaselineOption(question: StoredQuestion) {
  return question.options.find((option) => option.demonstratedLevel === 2) ?? question.options[0];
}

function evaluatePrefill(question: StoredQuestion): { value: string; level: number; reliability: number; reason: string } {
  if (question.format === "single_choice") {
    const option = preferredBaselineOption(question);
    if (!option) throw new Error(`Baseline question ${question.id} has no choices`);
    return {
      value: option.id,
      level: option.demonstratedLevel,
      reliability: EVIDENCE_RELIABILITY["fixed-assessment"],
      reason: `Selected: ${option.text}`,
    };
  }
  const fallbackLevel = 2;
  const match = question.rubric.find((entry) => entry.level === fallbackLevel) ?? question.rubric[0];
  return {
    value: PREFILL_WRITTEN_ANSWER,
    level: match?.level ?? fallbackLevel,
    reliability: EVIDENCE_RELIABILITY["ai-written"],
    reason: PREFILL_WRITTEN_ANSWER,
  };
}

function clearAssessmentWork(db: KaushalDatabase, assessmentId: string) {
  db.prepare("DELETE FROM responses WHERE round_id IN (SELECT id FROM assessment_rounds WHERE assessment_id=?)").run(assessmentId);
  db.prepare("DELETE FROM evidence WHERE assessment_id=?").run(assessmentId);
  db.prepare("DELETE FROM assessment_results WHERE assessment_id=?").run(assessmentId);
  db.prepare("DELETE FROM recommendations WHERE assessment_id=?").run(assessmentId);
  db.prepare("DELETE FROM assessment_rounds WHERE assessment_id=?").run(assessmentId);
}

function persistRound(
  db: KaushalDatabase,
  assessmentId: string,
  roundNumber: 1 | 2 | 3,
  payload: RoundPayload,
  evaluations: Array<{ question: StoredQuestion; value: string; level: number; reliability: number; reason: string }>,
): Evidence[] {
  const roundId = randomUUID();
  db.prepare("INSERT INTO assessment_rounds(id,assessment_id,round_number,kind,status) VALUES (?,?,?,?, 'completed')")
    .run(roundId, assessmentId, roundNumber, JSON.stringify(payload));
  const response = db.prepare("INSERT INTO responses(id,round_id,question_id,prompt_snapshot,response_json) VALUES (?,?,?,?,?)");
  const insertEvidence = db.prepare("INSERT INTO evidence(id,assessment_id,competency_id,source_type,level,reliability,rationale) VALUES (?,?,?,?,?,?,?)");
  const evidence: Evidence[] = [];
  for (const item of evaluations) {
    const evidenceId = `${randomUUID()}:r${roundNumber}:${item.question.id}`;
    response.run(randomUUID(), roundId, roundNumber === 1 ? item.question.id : null, item.question.prompt, JSON.stringify({ value: item.value }));
    insertEvidence.run(
      evidenceId,
      assessmentId,
      item.question.competencyId,
      roundNumber === 1 ? "fixed-assessment" : "ai-written",
      item.level,
      item.reliability,
      item.reason,
    );
    evidence.push({
      id: evidenceId,
      competencyId: item.question.competencyId,
      source: roundNumber === 1 ? "fixed-assessment" : "ai-written",
      demonstratedLevel: item.level,
      reliability: item.reliability,
      reason: item.reason,
      round: roundNumber,
    });
  }
  return evidence;
}

function persistResults(db: KaushalDatabase, assessmentId: string, result: AssessmentResult) {
  db.prepare("DELETE FROM assessment_results WHERE assessment_id=?").run(assessmentId);
  const insert = db.prepare(`INSERT INTO assessment_results(id,assessment_id,competency_id,assessed_level,required_level,gap,priority,confidence,supported)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const item of result.competencies) {
    insert.run(randomUUID(), assessmentId, item.competencyId, item.assessedLevel, item.requiredLevel, item.gap, item.priority, item.confidence, item.supported ? 1 : 0);
  }
}

function buildEvaluations(questions: StoredQuestion[]) {
  return questions.map((question) => ({ question, ...evaluatePrefill(question) }));
}

function unresolvedMatrix(matrix: CompetencyRequirement[], result: AssessmentResult): CompetencyRequirement[] {
  const unresolved = result.competencies
    .filter((item) => !item.supported || item.contradictory)
    .sort((a, b) => b.priority - a.priority)
    .map((item) => item.competencyId);
  const unresolvedRank = new Map(unresolved.map((competencyId, index) => [competencyId, index]));
  const filtered = matrix
    .filter((item) => unresolvedRank.has(item.competencyId))
    .sort((a, b) => unresolvedRank.get(a.competencyId)! - unresolvedRank.get(b.competencyId)!);
  return filtered.length > 0 ? filtered : matrix;
}

export function prefillCompletedAssessment(db: KaushalDatabase, assessmentId: string): void {
  const assessment = db.prepare("SELECT * FROM assessments WHERE id=?").get(assessmentId) as Row | undefined;
  if (!assessment) throw new Error("Active assessment not found");
  const status = String(assessment.status);
  if (status === "completed" || status === "provisional") return;

  const matrix = requirements(db, String(assessment.matrix_version_id));
  if (matrix.length === 0) throw new Error("Pinned matrix has no competencies");

  const round1Questions = baselineQuestions(db, matrix).slice(0, round1QuestionCount(matrix.length));
  const round1Payload: RoundPayload = { kind: "baseline", questions: round1Questions };
  const round1 = buildEvaluations(round1Questions);

  const round2Count = round2QuestionCount(matrix.length);
  const round2Questions = toStored(fallbackQuestions(db, matrix, round2Count, 2), matrix);
  const round2Payload: RoundPayload = { kind: "personalized", questions: round2Questions };
  const round2 = buildEvaluations(round2Questions);

  const afterRound2 = scoreAssessment(matrix, [
    ...round1.map((item, index) => ({
      id: `prefill-r1-${index}`,
      competencyId: item.question.competencyId,
      source: "fixed-assessment" as const,
      demonstratedLevel: item.level,
      reliability: item.reliability,
      reason: item.reason,
      round: 1 as const,
    })),
    ...round2.map((item, index) => ({
      id: `prefill-r2-${index}`,
      competencyId: item.question.competencyId,
      source: "ai-written" as const,
      demonstratedLevel: item.level,
      reliability: item.reliability,
      reason: item.reason,
      round: 2 as const,
    })),
  ]);
  if (!afterRound2.ok) throw new Error(afterRound2.error.message);

  const round3Matrix = unresolvedMatrix(matrix, afterRound2.value);
  const round3Count = round3QuestionCount(round3Matrix.length);
  const round3Questions = toStored(fallbackQuestions(db, round3Matrix, round3Count, 3), round3Matrix);
  const round3Payload: RoundPayload = { kind: "clarification", questions: round3Questions };
  const round3 = buildEvaluations(round3Questions);

  db.transaction(() => {
    clearAssessmentWork(db, assessmentId);
    const evidence = [
      ...persistRound(db, assessmentId, 1, round1Payload, round1),
      ...persistRound(db, assessmentId, 2, round2Payload, round2),
      ...persistRound(db, assessmentId, 3, round3Payload, round3),
    ];
    const scored = scoreAssessment(matrix, evidence);
    if (!scored.ok) throw new Error(scored.error.message);
    persistResults(db, assessmentId, scored.value);
    db.prepare("UPDATE assessments SET status=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(scored.value.round3Required ? "provisional" : "completed", assessmentId);
  })();

  try {
    new LearningService(db).createPath(assessmentId);
  } catch {}
}
