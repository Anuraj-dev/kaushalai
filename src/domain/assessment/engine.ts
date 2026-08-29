import { scoreAssessment } from "./scoring";
import type {
  Assessment,
  AssessmentError,
  AssessmentStore,
  PublishedMatrix,
  Result,
  RoundSubmission,
} from "./types";

const failure = (code: AssessmentError["code"], message: string, details?: Record<string, unknown>): Result<never> => ({
  ok: false,
  error: { code, message, ...(details ? { details } : {}) },
});

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryAssessmentStore implements AssessmentStore {
  private readonly assessments = new Map<string, Assessment>();

  async get(id: string): Promise<Assessment | null> {
    const value = this.assessments.get(id);
    return value ? clone(value) : null;
  }

  async save(assessment: Assessment): Promise<void> {
    this.assessments.set(assessment.id, clone(assessment));
  }
}

export class AssessmentEngine {
  constructor(
    private readonly store: AssessmentStore,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async start(officialId: string, publishedMatrix: PublishedMatrix): Promise<Result<Assessment>> {
    const matrix = clone(publishedMatrix);
    const validation = scoreAssessment(matrix.competencies, []);
    if (!validation.ok) return validation;
    const assessment: Assessment = {
      id: this.createId(),
      officialId,
      matrixId: matrix.matrixId,
      matrixVersion: matrix.version,
      matrix,
      startedAt: this.now().toISOString(),
      status: "awaiting-round-1",
      rounds: [],
      result: null,
      provisional: false,
    };
    await this.store.save(assessment);
    return { ok: true, value: clone(assessment) };
  }

  async submitRound(id: string, submission: RoundSubmission): Promise<Result<Assessment>> {
    const countError = this.validateQuestionCount(submission);
    if (countError) return countError;
    const assessment = await this.store.get(id);
    if (!assessment) return failure("ASSESSMENT_NOT_FOUND", `Assessment ${id} was not found.`);
    if (submission.round === 3 && assessment.result && !assessment.result.round3Required) {
      return failure("ROUND_NOT_ALLOWED", "Round 3 is allowed only for low coverage or an important contradiction.");
    }
    if (assessment.status === "completed") return failure("ASSESSMENT_COMPLETED", `Assessment ${id} is already complete.`);
    const expectedRound = assessment.rounds.length + 1;
    if (submission.round !== expectedRound) {
      return failure("INVALID_ROUND_ORDER", `Expected Round ${expectedRound}, received Round ${submission.round}.`);
    }
    if (submission.round === 3 && !assessment.result?.round3Required) {
      return failure("ROUND_NOT_ALLOWED", "Round 3 is allowed only for low coverage or an important contradiction.");
    }
    const competencyIds = new Set(assessment.matrix.competencies.map((item) => item.competencyId));
    const questions = new Map(submission.questions.map((question) => [question.id, question]));
    for (const question of submission.questions) {
      if (!competencyIds.has(question.competencyId)) {
        return failure("UNKNOWN_COMPETENCY", `Question ${question.id} refers to an unknown competency.`);
      }
    }
    for (const item of submission.evidence) {
      const question = item.questionId ? questions.get(item.questionId) : undefined;
      if (!question || question.competencyId !== item.competencyId || item.round !== submission.round) {
        return failure("QUESTION_OWNERSHIP_MISMATCH", `Evidence ${item.id} does not belong to its submitted question and round.`);
      }
    }
    const rounds = [...assessment.rounds, { ...clone(submission), submittedAt: this.now().toISOString() }];
    const allEvidence = rounds.flatMap((round) => round.evidence);
    const scored = scoreAssessment(assessment.matrix.competencies, allEvidence);
    if (!scored.ok) return scored;
    const completed = submission.round === 3 || (submission.round === 2 && !scored.value.round3Required);
    const updated: Assessment = {
      ...assessment,
      rounds,
      result: scored.value,
      status: completed ? "completed" : submission.round === 1 ? "awaiting-round-2" : "awaiting-round-3",
      provisional: submission.round === 3 && scored.value.round3Required,
    };
    await this.store.save(updated);
    return { ok: true, value: clone(updated) };
  }

  private validateQuestionCount(submission: RoundSubmission): Result<never> | null {
    const count = submission.questions.length;
    if (count === 0 || (submission.round === 2 && (count < 7 || count > 10)) || (submission.round === 3 && count > 5)) {
      return failure("INVALID_QUESTION_COUNT", `Round ${submission.round} contains ${count} questions.`, { round: submission.round, count });
    }
    return null;
  }
}
