import type {
  AssessmentError,
  AssessmentResult,
  CompetencyRequirement,
  CompetencyResult,
  Evidence,
  EvidenceSource,
  Result,
} from "./types";

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;
export const SUPPORTED_CONFIDENCE = 0.7;
export const ROUND_3_COVERAGE_GATE = 0.8;
export const HIGH_IMPORTANCE = 3;

export const EVIDENCE_RELIABILITY: Readonly<Record<EvidenceSource, number>> = {
  "course-completion": 0.25,
  "verified-course-assessment": 0.5,
  "fixed-assessment": 1,
  "ai-written": 0.8,
};

const error = (code: AssessmentError["code"], message: string, field?: string): Result<never> => ({
  ok: false,
  error: { code, message, ...(field ? { field } : {}) },
});

const validLevel = (value: number) => Number.isFinite(value) && value >= MIN_LEVEL && value <= MAX_LEVEL;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round = (value: number) => Number(value.toFixed(10));

function validateRequirement(requirement: CompetencyRequirement): Result<CompetencyRequirement> {
  if (!validLevel(requirement.requiredLevel)) {
    return error("INVALID_LEVEL", "Required level must be a finite number from 1 to 5.", "requirement.requiredLevel");
  }
  if (!Number.isInteger(requirement.importance) || requirement.importance < 1 || requirement.importance > 3) {
    return error("INVALID_IMPORTANCE", "Importance must be an integer from 1 to 3.", "requirement.importance");
  }
  return { ok: true, value: requirement };
}

function validateEvidence(item: Evidence, index: number): Result<Evidence> {
  if (!validLevel(item.demonstratedLevel)) {
    return error("INVALID_LEVEL", "Demonstrated level must be a finite number from 1 to 5.", `evidence[${index}].demonstratedLevel`);
  }
  const approved = EVIDENCE_RELIABILITY[item.source];
  const reliabilityValid = item.source === "ai-written"
    ? Number.isFinite(item.reliability) && item.reliability > 0 && item.reliability <= approved
    : item.reliability === approved;
  if (!reliabilityValid) {
    return error("INVALID_RELIABILITY", `Reliability is invalid for ${item.source}.`, `evidence[${index}].reliability`);
  }
  return { ok: true, value: item };
}

function agreementFor(levels: number[]): number {
  if (levels.length < 2) return 1;
  const mean = levels.reduce((sum, level) => sum + level, 0) / levels.length;
  const sampleVariance = levels.reduce((sum, level) => sum + (level - mean) ** 2, 0) / (levels.length - 1);
  const maximumVariance = (MAX_LEVEL - MIN_LEVEL) ** 2 / 4;
  return clamp(1 - sampleVariance / maximumVariance);
}

export function scoreCompetency(
  requirement: CompetencyRequirement,
  evidence: Evidence[],
): Result<CompetencyResult> {
  const requirementValidation = validateRequirement(requirement);
  if (!requirementValidation.ok) return requirementValidation;
  const seen = new Set<string>();
  for (const [index, item] of evidence.entries()) {
    if (seen.has(item.id)) return error("DUPLICATE_EVIDENCE", `Evidence ${item.id} appears more than once.`, `evidence[${index}].id`);
    seen.add(item.id);
    if (item.competencyId !== requirement.competencyId) {
      return error("UNKNOWN_COMPETENCY", `Evidence ${item.id} does not belong to ${requirement.competencyId}.`, `evidence[${index}].competencyId`);
    }
    const validation = validateEvidence(item, index);
    if (!validation.ok) return validation;
  }

  const current = evidence.filter((item) => item.round !== null);
  const history = evidence.filter((item) => item.round === null);
  const assessmentWeight = current.reduce((sum, item) => sum + item.reliability, 0);
  const rawHistoryWeight = history.reduce((sum, item) => sum + item.reliability, 0);
  // Collapse any amount of prior learning into a bounded prior. Current answers
  // retain at least twice the influence whenever current evidence exists.
  const historyWeight = assessmentWeight > 0 ? Math.min(rawHistoryWeight, assessmentWeight * 0.5) : rawHistoryWeight;
  const currentTotal = current.reduce((sum, item) => sum + item.demonstratedLevel * item.reliability, 0);
  const historyMean = rawHistoryWeight === 0
    ? 0
    : history.reduce((sum, item) => sum + item.demonstratedLevel * item.reliability, 0) / rawHistoryWeight;
  const totalWeight = assessmentWeight + historyWeight;
  const assessedLevel = totalWeight === 0 ? 0 : clamp((currentTotal + historyMean * historyWeight) / totalWeight, MIN_LEVEL, MAX_LEVEL);
  const agreement = agreementFor(evidence.map((item) => item.demonstratedLevel));
  const averageReliability = evidence.length === 0
    ? 0
    : evidence.reduce((sum, item) => sum + item.reliability, 0) / evidence.length;
  const confidence = clamp(Math.min(1, evidence.length / 3) * averageReliability * (0.5 + 0.5 * agreement));
  const gap = Math.max(0, requirement.requiredLevel - assessedLevel);
  const currentLevels = current.map((item) => item.demonstratedLevel);
  const contradictory = currentLevels.length >= 2 && Math.max(...currentLevels) - Math.min(...currentLevels) >= 2;

  return {
    ok: true,
    value: {
      ...requirement,
      assessedLevel: round(assessedLevel),
      gap: round(gap),
      priority: round(gap * requirement.importance),
      confidence: round(confidence),
      agreement: round(agreement),
      supported: round(confidence) >= SUPPORTED_CONFIDENCE,
      contradictory,
      evidenceCount: evidence.length,
      assessmentWeight: round(assessmentWeight),
      historyWeight: round(historyWeight),
    },
  };
}

export function scoreAssessment(
  requirements: CompetencyRequirement[],
  evidence: Evidence[],
): Result<AssessmentResult> {
  const ids = new Set<string>();
  for (const requirement of requirements) {
    if (ids.has(requirement.competencyId)) {
      return error("DUPLICATE_COMPETENCY", `Competency ${requirement.competencyId} appears more than once.`);
    }
    ids.add(requirement.competencyId);
  }
  const unknownIndex = evidence.findIndex((item) => !ids.has(item.competencyId));
  if (unknownIndex >= 0) {
    return error("UNKNOWN_COMPETENCY", `Evidence refers to an unknown competency.`, `evidence[${unknownIndex}].competencyId`);
  }
  const competencies: CompetencyResult[] = [];
  for (const requirement of requirements) {
    const result = scoreCompetency(requirement, evidence.filter((item) => item.competencyId === requirement.competencyId));
    if (!result.ok) return result;
    competencies.push(result.value);
  }
  const supportedCompetencyCount = competencies.filter((item) => item.supported).length;
  const coverage = requirements.length === 0 ? 0 : supportedCompetencyCount / requirements.length;
  const importanceTotal = competencies.reduce((sum, item) => sum + item.importance, 0);
  const readiness = importanceTotal === 0
    ? 0
    : competencies.reduce((sum, item) => {
      const attainment = item.requiredLevel === 0 ? 1 : clamp(item.assessedLevel / item.requiredLevel);
      return sum + attainment * item.importance;
    }, 0) / importanceTotal;
  const highImportanceContradictions = competencies
    .filter((item) => item.importance >= HIGH_IMPORTANCE && item.contradictory)
    .map((item) => item.competencyId);
  return {
    ok: true,
    value: {
      competencies,
      coverage: round(coverage),
      readiness: round(readiness),
      supportedCompetencyCount,
      highImportanceContradictions,
      round3Required: coverage <= ROUND_3_COVERAGE_GATE || highImportanceContradictions.length > 0,
    },
  };
}
