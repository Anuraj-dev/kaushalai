import { describe, expect, it } from "vitest";

import { AssessmentEngine, InMemoryAssessmentStore } from "./engine";
import type { Assessment, PublishedMatrix, RoundSubmission } from "./types";

function matrix(version = 1): PublishedMatrix {
  return {
    matrixId: "matrix-statistics",
    jobRoleId: "role-jsso",
    version,
    publishedAt: `2026-08-${20 + version}T00:00:00.000Z`,
    competencies: [
      { competencyId: "statistics", name: "Statistics", requiredLevel: 4, importance: 1 },
    ],
  };
}

function submission(round: 1 | 2 | 3, levels: number[]): RoundSubmission {
  return {
    round,
    questions: levels.map((_, index) => ({
      id: `r${round}-q${index}`,
      competencyId: "statistics",
      kind: round === 1 ? "fixed-choice" : "written",
    })),
    evidence: levels.map((level, index) => ({
      id: `r${round}-e${index}`,
      questionId: `r${round}-q${index}`,
      competencyId: "statistics",
      source: round === 1 ? "fixed-assessment" : "ai-written",
      demonstratedLevel: level,
      reliability: round === 1 ? 1 : 0.8,
      reason: "Observed answer",
      round,
    })),
  };
}

describe("AssessmentEngine", () => {
  it("pins an assessment to the published matrix snapshot it starts with", async () => {
    const store = new InMemoryAssessmentStore();
    const engine = new AssessmentEngine(store, () => "assessment-1");
    const started = await engine.start("official-1", matrix(1));
    expect(started.ok).toBe(true);

    const newer = matrix(2);
    newer.competencies[0]!.requiredLevel = 5;
    const saved = await store.get("assessment-1");
    expect(saved?.matrixVersion).toBe(1);
    expect(saved?.matrix.competencies[0]?.requiredLevel).toBe(4);
  });

  it("validates question ownership and returns a structured error", async () => {
    const store = new InMemoryAssessmentStore();
    const engine = new AssessmentEngine(store, () => "assessment-1");
    await engine.start("official-1", matrix());
    const invalid = submission(1, [3]);
    invalid.evidence[0]!.questionId = "unknown";
    const result = await engine.submitRound("assessment-1", invalid);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "QUESTION_OWNERSHIP_MISMATCH" }),
    });
  });

  it("enforces 7-10 personalized questions and at most five clarification questions", async () => {
    const engine = new AssessmentEngine(new InMemoryAssessmentStore(), () => "assessment-1");
    await engine.start("official-1", matrix());
    await engine.submitRound("assessment-1", submission(1, [2]));
    const shortRound2 = await engine.submitRound("assessment-1", submission(2, [2, 2, 2, 2, 2, 2]));
    expect(shortRound2).toEqual({ ok: false, error: expect.objectContaining({ code: "INVALID_QUESTION_COUNT" }) });

    const acceptedRound2 = await engine.submitRound("assessment-1", submission(2, [2, 2, 2, 2, 2, 2, 2]));
    expect(acceptedRound2.ok).toBe(true);
    const longRound3 = await engine.submitRound("assessment-1", submission(3, [2, 2, 2, 2, 2, 2]));
    expect(longRound3).toEqual({ ok: false, error: expect.objectContaining({ code: "INVALID_QUESTION_COUNT" }) });
  });

  it("rejects Round 3 when coverage exceeds 80% and no important contradiction remains", async () => {
    const engine = new AssessmentEngine(new InMemoryAssessmentStore(), () => "assessment-1");
    await engine.start("official-1", matrix());
    await engine.submitRound("assessment-1", submission(1, [4, 4, 4]));
    await engine.submitRound("assessment-1", submission(2, [4, 4, 4, 4, 4, 4, 4]));
    const result = await engine.submitRound("assessment-1", submission(3, [4]));
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "ROUND_NOT_ALLOWED" }) });
  });

  it("completes after Round 3 with provisional results when uncertainty remains", async () => {
    const store = new InMemoryAssessmentStore();
    const engine = new AssessmentEngine(store, () => "assessment-1");
    await engine.start("official-1", matrix());
    await engine.submitRound("assessment-1", submission(1, [1]));
    await engine.submitRound("assessment-1", submission(2, [1, 5, 1, 5, 1, 5, 1]));
    const result = await engine.submitRound("assessment-1", submission(3, [1, 5, 1, 5, 1]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("completed");
    expect(result.value.provisional).toBe(true);
    expect(result.value.result?.coverage).toBeLessThanOrEqual(0.8);
    expect((await store.get("assessment-1"))?.provisional).toBe(true);
  });

  it("does not persist a rejected submission", async () => {
    const store = new InMemoryAssessmentStore();
    const engine = new AssessmentEngine(store, () => "assessment-1");
    await engine.start("official-1", matrix());
    await engine.submitRound("assessment-1", submission(1, [2]));
    await engine.submitRound("assessment-1", submission(2, [2]));
    const saved = (await store.get("assessment-1")) as Assessment;
    expect(saved.rounds).toHaveLength(1);
  });
});
