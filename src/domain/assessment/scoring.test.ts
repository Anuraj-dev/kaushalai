import { describe, expect, it } from "vitest";

import {
  EVIDENCE_RELIABILITY,
  scoreAssessment,
  scoreCompetency,
} from "./scoring";
import type { CompetencyRequirement, Evidence } from "./types";

const requirement: CompetencyRequirement = {
  competencyId: "statistics",
  name: "Official statistics",
  requiredLevel: 4,
  importance: 1,
};

function evidence(
  id: string,
  demonstratedLevel: number,
  source: Evidence["source"] = "fixed-assessment",
): Evidence {
  return {
    id,
    competencyId: requirement.competencyId,
    source,
    demonstratedLevel,
    reliability: EVIDENCE_RELIABILITY[source],
    reason: "Observed answer",
    round: source === "course-completion" ? null : 1,
  };
}

describe("scoreCompetency", () => {
  it("publishes the approved reliability values", () => {
    expect(EVIDENCE_RELIABILITY).toEqual({
      "course-completion": 0.25,
      "verified-course-assessment": 0.5,
      "fixed-assessment": 1,
      "ai-written": 0.8,
    });
  });

  it("supports a result backed by three consistent fixed answers", () => {
    const result = scoreCompetency(requirement, [
      evidence("e1", 3),
      evidence("e2", 3),
      evidence("e3", 3),
    ]);

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        assessedLevel: 3,
        gap: 1,
        priority: 1,
        confidence: 1,
        agreement: 1,
        supported: true,
        contradictory: false,
      }),
    });
  });

  it("reduces confidence and marks evidence contradictory when levels conflict", () => {
    const result = scoreCompetency(requirement, [
      evidence("e1", 1),
      evidence("e2", 3),
      evidence("e3", 5),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assessedLevel).toBe(3);
    expect(result.value.agreement).toBe(0);
    expect(result.value.confidence).toBe(0.5);
    expect(result.value.supported).toBe(false);
    expect(result.value.contradictory).toBe(true);
  });

  it("keeps sparse evidence unsupported", () => {
    const result = scoreCompetency(requirement, [evidence("e1", 4)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.confidence).toBeCloseTo(1 / 3, 5);
    expect(result.value.supported).toBe(false);
  });

  it("treats confidence exactly at 0.70 as supported", () => {
    const aiEvidence = [1, 2, 3].map((n) => ({
      ...evidence(`e${n}`, 4, "ai-written"),
      reliability: 0.7,
    }));
    const result = scoreCompetency(requirement, aiEvidence);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.confidence).toBeCloseTo(0.7, 10);
    expect(result.value.supported).toBe(true);
  });

  it("caps combined learning-history influence at the current assessment weight", () => {
    const history = Array.from({ length: 20 }, (_, index) =>
      evidence(`history-${index}`, 5, "course-completion"),
    );
    const result = scoreCompetency(requirement, [evidence("current", 1), ...history]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assessedLevel).toBeCloseTo(2.3333333333, 8);
    expect(result.value.assessmentWeight).toBe(1);
    expect(result.value.historyWeight).toBe(0.5);
    expect(result.value.assessedLevel).toBeLessThan(3);
  });

  it("returns structured errors for invalid evidence instead of NaN or invalid levels", () => {
    const invalid = { ...evidence("bad", 2), demonstratedLevel: Number.NaN };
    expect(scoreCompetency(requirement, [invalid])).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_LEVEL", field: "evidence[0].demonstratedLevel" }),
    });

    expect(scoreCompetency({ ...requirement, requiredLevel: 6 }, [])).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_LEVEL", field: "requirement.requiredLevel" }),
    });

    expect(scoreCompetency(requirement, [{ ...evidence("zero", 1), demonstratedLevel: 0 }])).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_LEVEL", field: "evidence[0].demonstratedLevel" }),
    });

    expect(scoreCompetency({ ...requirement, requiredLevel: 0 }, [])).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_LEVEL", field: "requirement.requiredLevel" }),
    });

    expect(scoreCompetency({ ...requirement, importance: 0 }, [])).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_IMPORTANCE", field: "requirement.importance" }),
    });

    expect(scoreCompetency(requirement, [{ ...evidence("too-reliable", 2, "ai-written"), reliability: 0.81 }])).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_RELIABILITY", field: "evidence[0].reliability" }),
    });
  });
});

describe("scoreAssessment", () => {
  it("returns finite zero values for an empty matrix", () => {
    expect(scoreAssessment([], [])).toEqual({
      ok: true,
      value: {
        competencies: [],
        coverage: 0,
        readiness: 0,
        supportedCompetencyCount: 0,
        highImportanceContradictions: [],
        round3Required: true,
      },
    });
  });

  it("uses supported competency count for coverage and gates at exactly 80%", () => {
    const requirements = Array.from({ length: 5 }, (_, index) => ({
      ...requirement,
      competencyId: `c${index}`,
      importance: 2,
    }));
    const allEvidence = requirements.flatMap((item, index) =>
      index < 4
        ? [1, 2, 3].map((n) => ({ ...evidence(`${item.competencyId}-${n}`, 3), competencyId: item.competencyId }))
        : [],
    );
    const result = scoreAssessment(requirements, allEvidence);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.coverage).toBe(0.8);
    expect(result.value.round3Required).toBe(true);
  });

  it("gates Round 3 for contradictory evidence on a high-importance competency", () => {
    const requirements = [
      { ...requirement, competencyId: "high", importance: 3 },
      { ...requirement, competencyId: "low", importance: 2 },
    ];
    const allEvidence = requirements.flatMap((item) =>
      [1, 3, 5].map((level, index) => ({
        ...evidence(`${item.competencyId}-${index}`, level),
        competencyId: item.competencyId,
      })),
    );
    const result = scoreAssessment(requirements, allEvidence);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.highImportanceContradictions).toEqual(["high"]);
    expect(result.value.round3Required).toBe(true);
  });
});
