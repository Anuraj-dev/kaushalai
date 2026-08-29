export type ProficiencyLevel = number;
export type AssessmentRound = 1 | 2 | 3;

export type EvidenceSource =
  | "course-completion"
  | "verified-course-assessment"
  | "fixed-assessment"
  | "ai-written";

export interface Evidence {
  id: string;
  competencyId: string;
  questionId?: string;
  source: EvidenceSource;
  demonstratedLevel: ProficiencyLevel;
  reliability: number;
  reason: string;
  round: AssessmentRound | null;
}

export interface CompetencyRequirement {
  competencyId: string;
  name: string;
  requiredLevel: ProficiencyLevel;
  importance: number;
}

export interface CompetencyResult extends CompetencyRequirement {
  assessedLevel: ProficiencyLevel;
  gap: number;
  priority: number;
  confidence: number;
  agreement: number;
  supported: boolean;
  contradictory: boolean;
  evidenceCount: number;
  assessmentWeight: number;
  historyWeight: number;
}

export interface AssessmentResult {
  competencies: CompetencyResult[];
  coverage: number;
  readiness: number;
  supportedCompetencyCount: number;
  highImportanceContradictions: string[];
  round3Required: boolean;
}

export type AssessmentErrorCode =
  | "ASSESSMENT_NOT_FOUND"
  | "ASSESSMENT_COMPLETED"
  | "DUPLICATE_COMPETENCY"
  | "DUPLICATE_EVIDENCE"
  | "INVALID_IMPORTANCE"
  | "INVALID_LEVEL"
  | "INVALID_RELIABILITY"
  | "INVALID_QUESTION_COUNT"
  | "INVALID_ROUND_ORDER"
  | "UNKNOWN_COMPETENCY"
  | "QUESTION_OWNERSHIP_MISMATCH"
  | "ROUND_NOT_ALLOWED";

export interface AssessmentError {
  code: AssessmentErrorCode;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: AssessmentError };

export interface PublishedMatrix {
  matrixId: string;
  jobRoleId: string;
  version: number;
  publishedAt: string;
  competencies: CompetencyRequirement[];
}

export interface AssessmentQuestion {
  id: string;
  competencyId: string;
  kind: "fixed-choice" | "written";
}

export interface RoundSubmission {
  round: AssessmentRound;
  questions: AssessmentQuestion[];
  evidence: Evidence[];
}

export interface SubmittedRound extends RoundSubmission {
  submittedAt: string;
}

export type AssessmentStatus = "awaiting-round-1" | "awaiting-round-2" | "awaiting-round-3" | "completed";

export interface Assessment {
  id: string;
  officialId: string;
  matrixId: string;
  matrixVersion: number;
  matrix: PublishedMatrix;
  startedAt: string;
  status: AssessmentStatus;
  rounds: SubmittedRound[];
  result: AssessmentResult | null;
  provisional: boolean;
}

export interface AssessmentStore {
  get(id: string): Promise<Assessment | null>;
  save(assessment: Assessment): Promise<void>;
}
