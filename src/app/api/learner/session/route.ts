import { randomUUID } from "node:crypto";

import {
  createAiAssessmentService,
  createConfiguredProviderAdapters,
} from "@/ai";
import { repositories } from "@/data";
import { getDatabase, type KaushalDatabase } from "@/db/client";
import { persistAssessmentSnapshot, restoreAssessmentFromSnapshot } from "@/db/assessment-snapshot-store";
import { EVIDENCE_RELIABILITY, scoreAssessment, type AssessmentResult, type CompetencyRequirement, type Evidence } from "@/domain/assessment";
import { ROUND_2_MAX, round2QuestionCount, round3QuestionCount } from "@/domain/assessment/round-limits";
import {
  fallbackQuestions,
  parseRoundPayload,
  prefillCompletedAssessment,
  publicQuestions,
  requirements,
  rubrics,
  toStored,
  type RoundPayload,
} from "@/services/assessment-prefill";
import { LearningService } from "@/services/learning-service";
import { z } from "zod";

const ANSWER_LIMIT = 2000;
const answerSchema = z.object({ questionId: z.string().min(1), value: z.string().trim().min(1).max(2000) });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
type Answer = { questionId: string; value: string };

const database = () => getDatabase();
const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

function aiService() {
  const adapters = createConfiguredProviderAdapters();
  return createAiAssessmentService({ ...adapters, logger: (event) => console.warn(JSON.stringify(event)) });
}

// Legacy helper kept for reference — now inlined in submitRound for single-txn atomicity (C-AUD-01)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function createAdaptiveRound(db: KaushalDatabase, assessmentId: string, versionId: string, round: 2 | 3, matrix: CompetencyRequirement[]) {
  const count = round === 2 ? round2QuestionCount(matrix.length) : round3QuestionCount(matrix.length);
  const fallback = fallbackQuestions(db, matrix, count, round);
  const priorEvidence = (db.prepare("SELECT competency_id,rationale FROM evidence WHERE assessment_id=? ORDER BY created_at").all(assessmentId) as Row[])
    .map((row) => ({ competencyId: String(row.competency_id), summary: String(row.rationale ?? "Assessment response") }));
  const rubricMap = rubrics(db, matrix.map((item) => item.competencyId));
  const generated = await aiService().generateAdaptiveQuestions({
    assessmentSessionId: assessmentId, matrixVersionId: versionId, requestedCount: count,
    competencies: matrix.map((item) => ({ id: item.competencyId, targetLevel: item.requiredLevel, rubric: rubricMap.get(item.competencyId) ?? [] })),
    priorEvidence, fallbackQuestions: fallback,
  });
  const payload: RoundPayload = { kind: round === 2 ? "personalized" : "clarification", questions: toStored(generated.data.questions, matrix) };
  db.prepare("INSERT INTO assessment_rounds(id,assessment_id,round_number,kind,status) VALUES (?,?,?,?, 'pending')")
    .run(randomUUID(), assessmentId, round, JSON.stringify(payload));
}

function assessmentEvidence(db: KaushalDatabase, assessmentId: string): Evidence[] {
  const assessment = db.prepare("SELECT official_id FROM assessments WHERE id=?").get(assessmentId) as Row | undefined;
  const current = (db.prepare("SELECT * FROM evidence WHERE assessment_id=? ORDER BY created_at,id").all(assessmentId) as Row[]).map((row) => ({
    id: String(row.id), competencyId: String(row.competency_id), source: String(row.source_type) as Evidence["source"],
    demonstratedLevel: Number(row.level), reliability: Number(row.reliability), reason: String(row.rationale ?? "Assessment response"),
    round: Number(String(row.id).match(/:r([123]):/)?.[1] ?? 1) as 1 | 2 | 3,
  }));
  if (!assessment) return current;
  const history = (db.prepare("SELECT id,competency_id,source_type,level,reliability FROM learning_history WHERE official_id=? ORDER BY recorded_at,id").all(assessment.official_id) as Row[]).map((row) => ({
    id: `history:${String(row.id)}`, competencyId: String(row.competency_id), source: String(row.source_type) as Evidence["source"],
    demonstratedLevel: Number(row.level), reliability: Number(row.reliability), reason: "Prior verified learning history", round: null,
  }));
  return [...current, ...history];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function persistResults(db: KaushalDatabase, assessmentId: string, result: AssessmentResult) {
  db.prepare("DELETE FROM assessment_results WHERE assessment_id=?").run(assessmentId);
  const insert = db.prepare(`INSERT INTO assessment_results(id,assessment_id,competency_id,assessed_level,required_level,gap,priority,confidence,supported)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const item of result.competencies) insert.run(randomUUID(), assessmentId, item.competencyId, item.assessedLevel, item.requiredLevel, item.gap, item.priority, item.confidence, item.supported ? 1 : 0);
}

export function session(db: KaushalDatabase, assessmentId: string) {
  const assessment = db.prepare(`SELECT a.*,v.version,m.job_role_id FROM assessments a JOIN matrix_versions v ON v.id=a.matrix_version_id
    JOIN competency_matrices m ON m.id=v.matrix_id WHERE a.id=?`).get(assessmentId) as Row | undefined;
  if (!assessment) return null;
  const official = db.prepare("SELECT o.*,r.name job_role_name FROM officials o JOIN job_roles r ON r.id=o.job_role_id WHERE o.id=?").get(assessment.official_id) as Row;
  const matrix = requirements(db, String(assessment.matrix_version_id));
  const pending = db.prepare("SELECT * FROM assessment_rounds WHERE assessment_id=? AND status='pending' ORDER BY round_number LIMIT 1").get(assessmentId) as Row | undefined;
  const payload = pending ? parseRoundPayload(pending.kind) : null;
  const results = (db.prepare(`SELECT r.*,c.name FROM assessment_results r JOIN competencies c ON c.id=r.competency_id
    WHERE r.assessment_id=? ORDER BY r.priority DESC,c.name`).all(assessmentId) as Row[]).map((row) => ({
    competencyId: String(row.competency_id), competencyName: String(row.name), assessedLevel: Number(row.assessed_level),
    requiredLevel: Number(row.required_level), gap: Number(row.gap), priority: Number(row.priority), confidence: Number(row.confidence), supported: row.supported === 1,
    evidence: (db.prepare("SELECT rationale,source_type,reliability FROM evidence WHERE assessment_id=? AND competency_id=? ORDER BY created_at").all(assessmentId, row.competency_id) as Row[])
      .map((entry) => ({ reason: String(entry.rationale ?? "Assessment response"), source: String(entry.source_type), reliability: Number(entry.reliability) })),
  }));
  const history = (db.prepare(`SELECT h.*,c.name competency_name,co.title course_title,cc.course_id course_id FROM learning_history h JOIN competencies c ON c.id=h.competency_id
    LEFT JOIN course_completions cc ON cc.id=h.source_id LEFT JOIN courses co ON co.id=cc.course_id WHERE h.official_id=? ORDER BY h.recorded_at DESC`).all(assessment.official_id) as Row[]).map((row) => ({
    id: String(row.id), competencyName: String(row.competency_name), source: String(row.source_type), level: Number(row.level), reliability: Number(row.reliability), recordedAt: String(row.recorded_at), courseTitle: row.course_title ? String(row.course_title) : null, courseId: row.course_id ? String(row.course_id) : null,
  }));
  const learning = new LearningService(db);
  let recommendations = learning.getPath(assessmentId) as Row[];
  if (["completed", "provisional"].includes(String(assessment.status)) && recommendations.length === 0) {
    learning.createPath(assessmentId);
    recommendations = learning.getPath(assessmentId) as Row[];
  }
  const invitations = db.prepare("SELECT * FROM reassessment_invitations WHERE official_id=? AND accepted_at IS NULL ORDER BY created_at DESC").all(assessment.official_id) as Row[];
  const matrixReassessment = (db.prepare(`SELECT EXISTS(
    SELECT 1 FROM matrix_versions newer JOIN competency_matrices cm ON cm.id=newer.matrix_id
    JOIN officials o ON o.job_role_id=cm.job_role_id
    WHERE o.id=? AND newer.status='published' AND newer.version>?
  ) eligible`).get(assessment.official_id, Number(assessment.version)) as { eligible: number }).eligible === 1;
  const completedCourses = Number((db.prepare("SELECT COUNT(*) count FROM course_completions WHERE official_id=?").get(assessment.official_id) as Row).count);
  return {
    official: { id: String(official.id), name: String(official.name), employeeCode: String(official.employee_code), email: String(official.email), jobRoleId: String(official.job_role_id), jobRoleName: String(official.job_role_name) },
    matrix: { versionId: String(assessment.matrix_version_id), version: Number(assessment.version), competencies: matrix },
    history,
    assessment: { id: assessmentId, status: String(assessment.status), startedAt: String(assessment.started_at), currentRound: pending ? Number(pending.round_number) : null, roundKind: payload?.kind ?? null, questions: publicQuestions(payload?.questions ?? []), provisional: String(assessment.status) === "provisional" },
    results,
    recommendations: recommendations.map((row) => ({ id: String(row.id), courseId: String(row.course_id), competencyId: String(row.competency_id), title: String(row.title), provider: row.provider ? String(row.provider) : null, duration: row.duration ? String(row.duration) : null, level: row.level ? String(row.level) : null, rank: Number(row.rank), rationale: String(row.rationale) })),
    reassessmentInvited: invitations.length > 0 || matrixReassessment,
    dashboard: { supportedCompetencies: results.filter((item) => item.supported).length, totalCompetencies: matrix.length, openGaps: results.filter((item) => item.gap > 0).length, completedCourses },
  };
}

async function submitRound(db: KaushalDatabase, assessmentId: string, answers: Answer[]) {
  const assessment = db.prepare("SELECT * FROM assessments WHERE id=? AND status='active'").get(assessmentId) as Row | undefined;
  if (!assessment) throw new Error("Active assessment not found");
  const round = db.prepare("SELECT * FROM assessment_rounds WHERE assessment_id=? AND status='pending' ORDER BY round_number LIMIT 1").get(assessmentId) as Row | undefined;
  if (!round) throw new Error("No assessment round is awaiting answers");
  const payload = parseRoundPayload(round.kind);
  if (answers.length !== payload.questions.length || new Set(answers.map((item) => item.questionId)).size !== answers.length) throw new Error("Answer every question once before submitting");
  const answerMap = new Map(answers.map((item) => [item.questionId, item.value.trim()]));
  if (payload.questions.some((question) => !answerMap.has(question.id) || !answerMap.get(question.id))) throw new Error("Answer every question once before submitting");
  for (const value of answerMap.values()) {
    if (value.length > ANSWER_LIMIT) throw new Error("Answer too long (max 2000 characters)");
  }
  const roundNumber = Number(round.round_number) as 1 | 2 | 3;
  let evaluated = new Map<string, { level: number; reliability: number; reason: string }>();
  if (roundNumber === 1) {
    evaluated = new Map(payload.questions.map((question) => {
      const option = question.options.find((item) => item.id === answerMap.get(question.id));
      if (!option) throw new Error("A baseline answer is not one of the stored choices");
      return [question.id, { level: option.demonstratedLevel, reliability: EVIDENCE_RELIABILITY["fixed-assessment"], reason: `Selected: ${option.text}` }];
    }));
  } else {
    const deterministic = new Map<string, { level: number; reliability: number; reason: string }>();
    for (const question of payload.questions) {
      if (question.format === "single_choice") {
        const option = question.options.find((item) => item.id === answerMap.get(question.id));
        if (!option) throw new Error("Answer is not one of the stored choices");
        // Codex P1: AI-authored choice retains ai-written provenance (0.8), not fixed 1
        deterministic.set(question.id, { level: option.demonstratedLevel, reliability: EVIDENCE_RELIABILITY["ai-written"], reason: `Selected: ${option.text}` });
      }
    }
    const written = payload.questions.filter((question) => question.format === "short_text");
    if (written.length > 0) {
      const result = await aiService().evaluateWrittenAnswers({
        assessmentSessionId: assessmentId, matrixVersionId: String(assessment.matrix_version_id),
        answers: written.map((question) => ({ questionId: question.id, competencyId: question.competencyId, answer: answerMap.get(question.id)!, rubric: question.rubric, fallbackDemonstratedLevel: 2 })),
      });
      evaluated = new Map(result.data.evaluations.map((item) => [item.questionId, { level: item.demonstratedLevel, reliability: Math.min(0.8, Math.max(0.1, item.confidence ?? 0.6)), reason: item.evidenceSummary }]));
    } else {
      evaluated = new Map();
    }
    for (const [key, value] of deterministic) evaluated.set(key, value);
  }
  const matrix = requirements(db, String(assessment.matrix_version_id));
  // Build new evidence for in-memory scoring before DB write (atomicity C-AUD-01)
  const newEvidenceForScoring: Evidence[] = payload.questions.map((question) => {
    const item = evaluated.get(question.id)!;
    return {
      id: `${randomUUID()}:r${roundNumber}:${question.id}`,
      competencyId: question.competencyId,
      source: (roundNumber === 1 ? "fixed-assessment" : "ai-written") as Evidence["source"],
      demonstratedLevel: item.level,
      reliability: item.reliability,
      reason: item.reason,
      round: roundNumber,
    };
  });
  const existingEvidence = assessmentEvidence(db, assessmentId);
  const fullEvidence = [...existingEvidence, ...newEvidenceForScoring];
  const scored = scoreAssessment(matrix, fullEvidence);
  if (!scored.ok) throw new Error(scored.error.message);
  // Pre-generate next round payload outside transaction (AI is async)
  let nextRoundPayload: RoundPayload | null = null;
  let nextRoundNumber: number | null = null;
  if (roundNumber === 1) {
    const count = round2QuestionCount(matrix.length);
    const fallback = fallbackQuestions(db, matrix, count, 2);
    const rubricMap = rubrics(db, matrix.map((item) => item.competencyId));
    const priorEvidence = fullEvidence.filter((e) => e.round !== null).map((e) => ({ competencyId: e.competencyId, summary: e.reason }));
    const generated = await aiService().generateAdaptiveQuestions({
      assessmentSessionId: assessmentId, matrixVersionId: String(assessment.matrix_version_id), requestedCount: count,
      competencies: matrix.map((item) => ({ id: item.competencyId, targetLevel: item.requiredLevel, rubric: rubricMap.get(item.competencyId) ?? [] })),
      priorEvidence, fallbackQuestions: fallback,
    });
    nextRoundPayload = { kind: "personalized", questions: toStored(generated.data.questions, matrix) };
    nextRoundNumber = 2;
  } else if (roundNumber === 2 && scored.value.round3Required) {
    const unresolved = scored.value.competencies
      .filter((item) => !item.supported || item.contradictory)
      .sort((a, b) => b.priority - a.priority)
      .map((item) => item.competencyId);
    const unresolvedRank = new Map(unresolved.map((competencyId, index) => [competencyId, index]));
    const round3Matrix = matrix
      .filter((item) => unresolvedRank.has(item.competencyId))
      .sort((a, b) => unresolvedRank.get(a.competencyId)! - unresolvedRank.get(b.competencyId)!);
    const finalMatrix = round3Matrix.length > 0 ? round3Matrix : matrix;
    const count = round3QuestionCount(finalMatrix.length);
    const fallback = fallbackQuestions(db, finalMatrix, count, 3);
    const rubricMap = rubrics(db, finalMatrix.map((item) => item.competencyId));
    const priorEvidence = fullEvidence.filter((e) => e.round !== null).map((e) => ({ competencyId: e.competencyId, summary: e.reason }));
    const generated = await aiService().generateAdaptiveQuestions({
      assessmentSessionId: assessmentId, matrixVersionId: String(assessment.matrix_version_id), requestedCount: count,
      competencies: finalMatrix.map((item) => ({ id: item.competencyId, targetLevel: item.requiredLevel, rubric: rubricMap.get(item.competencyId) ?? [] })),
      priorEvidence, fallbackQuestions: fallback,
    });
    nextRoundPayload = { kind: "clarification", questions: toStored(generated.data.questions, finalMatrix) };
    nextRoundNumber = 3;
  }
  // Single atomic transaction for all writes (C-AUD-01 fixed)
  db.transaction(() => {
    const response = db.prepare("INSERT INTO responses(id,round_id,question_id,prompt_snapshot,response_json) VALUES (?,?,?,?,?)");
    const insertEvidence = db.prepare("INSERT INTO evidence(id,assessment_id,competency_id,source_type,level,reliability,rationale) VALUES (?,?,?,?,?,?,?)");
    for (let i = 0; i < payload.questions.length; i++) {
      const question = payload.questions[i]!;
      const newEv = newEvidenceForScoring[i]!;
      response.run(randomUUID(), round.id, roundNumber === 1 ? question.id : null, question.prompt, JSON.stringify({ value: answerMap.get(question.id) }));
      insertEvidence.run(newEv.id, assessmentId, newEv.competencyId, newEv.source, newEv.demonstratedLevel, newEv.reliability, newEv.reason);
    }
    db.prepare("UPDATE assessment_rounds SET status='completed',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(round.id);
    db.prepare("DELETE FROM assessment_results WHERE assessment_id=?").run(assessmentId);
    const insertResult = db.prepare(`INSERT INTO assessment_results(id,assessment_id,competency_id,assessed_level,required_level,gap,priority,confidence,supported) VALUES (?,?,?,?,?,?,?,?,?)`);
    for (const item of scored.value.competencies) {
      insertResult.run(randomUUID(), assessmentId, item.competencyId, item.assessedLevel, item.requiredLevel, item.gap, item.priority, item.confidence, item.supported ? 1 : 0);
    }
    if (nextRoundPayload && nextRoundNumber) {
      db.prepare("INSERT INTO assessment_rounds(id,assessment_id,round_number,kind,status) VALUES (?,?,?,?, 'pending')").run(randomUUID(), assessmentId, nextRoundNumber, JSON.stringify(nextRoundPayload));
    } else {
      db.prepare("UPDATE assessments SET status=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(scored.value.round3Required && roundNumber === 3 ? "provisional" : "completed", assessmentId);
    }
  })();
  if (!nextRoundPayload) {
    try {
      new LearningService(db).createPath(assessmentId);
    } catch {}
  }
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const db = database();
  let assessmentId = query.get("assessmentId");
  if (!assessmentId && query.get("officialId")) assessmentId = (await repositories(db).assessments.latestForOfficial(query.get("officialId")!))?.id ?? null;
  if (!assessmentId) return fail("No assessment found", 404);
  await restoreAssessmentFromSnapshot(db, assessmentId);
  const current = db.prepare("SELECT status FROM assessments WHERE id=?").get(assessmentId) as { status: string } | undefined;
  if (current?.status === "active") {
    prefillCompletedAssessment(db, assessmentId);
    await persistAssessmentSnapshot(db, assessmentId);
  }
  const value = session(db, assessmentId);
  return value ? Response.json(value) : fail("Assessment not found", 404);
}

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json();
    const bodySchema = z
      .object({
        action: z.string().optional(),
        officialId: z.string().trim().min(1).max(64).optional(),
        assessmentId: z.string().trim().min(1).max(64).optional(),
        answers: z.array(answerSchema).max(ROUND_2_MAX).optional(),
        courseId: z.string().trim().min(1).optional(),
        competencyId: z.string().trim().min(1).optional(),
      })
      .passthrough();
    const parsedBody = bodySchema.safeParse(rawBody);
    if (!parsedBody.success) return fail("Invalid request", 400);
    const body = parsedBody.data as { action?: string; officialId?: string; assessmentId?: string; answers?: Answer[]; courseId?: string; competencyId?: string };
    const db = database();
    if (body.action === "start" || body.action === "reassess") {
      if (!body.officialId) return fail("officialId is required");
      if (body.action === "reassess") {
        db.prepare("UPDATE reassessment_invitations SET accepted_at=CURRENT_TIMESTAMP WHERE official_id=? AND accepted_at IS NULL").run(body.officialId);
      }
      const started = await repositories(db).assessments.start(body.officialId);
      prefillCompletedAssessment(db, started.id);
      await persistAssessmentSnapshot(db, started.id);
      return Response.json(session(db, started.id), { status: 201 });
    }
    if (body.action === "submit-round") {
      if (!body.assessmentId) return fail("assessmentId is required");
      const parsedAnswers = z.array(answerSchema).max(ROUND_2_MAX).safeParse(body.answers);
      if (!parsedAnswers.success) return fail("Invalid answers", 400);
      await restoreAssessmentFromSnapshot(db, body.assessmentId);
      await submitRound(db, body.assessmentId, parsedAnswers.data);
      await persistAssessmentSnapshot(db, body.assessmentId);
      return Response.json(session(db, body.assessmentId));
    }
    if (body.action === "complete-course") {
      if (!body.officialId || !body.courseId || !body.competencyId || !body.assessmentId) return fail("Completion identifiers are required");
      await restoreAssessmentFromSnapshot(db, body.assessmentId);
      new LearningService(db).completeCourse({ officialId: body.officialId, courseId: body.courseId, competencyId: body.competencyId });
      await persistAssessmentSnapshot(db, body.assessmentId);
      return Response.json(session(db, body.assessmentId), { status: 201 });
    }
    return fail("Unknown learner action");
  } catch (error) {
    console.error("[learner/session] error", error);
    const message = error instanceof Error ? error.message : "Unable to update learner session";
    // Codex P2: return 4xx for safe client errors, 500 for internal
    const safe =
      message.startsWith("Answer ") ||
      message.startsWith("Active assessment") ||
      message.startsWith("No assessment") ||
      message === "Invalid request" ||
      message === "Invalid answers" ||
      message.startsWith("Baseline question") ||
      message.startsWith("A baseline") ||
      message.startsWith("Answer is not");
    return fail(safe ? message : "Unable to update learner session", safe ? 400 : 500);
  }
}
