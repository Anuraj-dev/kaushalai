import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { importCatalog } from "@/data/catalog-import";
import { repositories } from "@/data/repositories";
import { seedFoundation } from "@/data/seeds";
import { openDatabase, type KaushalDatabase } from "@/db/client";
import { migrate } from "@/db/migrate";
import { round1QuestionCount, round2QuestionCount, round3QuestionCount } from "@/domain/assessment/round-limits";
import { parseRoundPayload, prefillCompletedAssessment } from "@/services/assessment-prefill";
import { LearningService } from "@/services/learning-service";

describe("prefilled completed assessments", () => {
  let database: KaushalDatabase;
  beforeEach(() => {
    database = openDatabase(":memory:");
    migrate(database);
    seedFoundation(database);
    importCatalog(database);
  });
  afterEach(() => database.close());

  it("persists halved rounds 1-3 with answers and a learning path", async () => {
    const started = await repositories(database).assessments.start("official-01");
    prefillCompletedAssessment(database, started.id);

    const assessment = database.prepare("SELECT status FROM assessments WHERE id=?").get(started.id) as { status: string };
    expect(["completed", "provisional"]).toContain(assessment.status);

    const rounds = database.prepare("SELECT round_number,kind,status FROM assessment_rounds WHERE assessment_id=? ORDER BY round_number").all(started.id) as Array<{ round_number: number; kind: string; status: string }>;
    expect(rounds).toHaveLength(3);
    expect(rounds.map((row) => row.status)).toEqual(["completed", "completed", "completed"]);

    const counts = rounds.map((row) => parseRoundPayload(row.kind).questions.length);
    expect(counts[0]).toBe(round1QuestionCount(8));
    expect(counts[1]).toBe(round2QuestionCount(8));
    expect(counts[2]).toBeGreaterThan(0);
    expect(counts[2]).toBeLessThanOrEqual(round3QuestionCount(8));

    const responses = Number((database.prepare("SELECT COUNT(*) count FROM responses r JOIN assessment_rounds ar ON ar.id=r.round_id WHERE ar.assessment_id=?").get(started.id) as { count: number }).count);
    expect(responses).toBe(counts.reduce((sum, count) => sum + count, 0));
    expect(Number((database.prepare("SELECT COUNT(*) count FROM evidence WHERE assessment_id=?").get(started.id) as { count: number }).count)).toBe(responses);
    expect(Number((database.prepare("SELECT COUNT(*) count FROM assessment_results WHERE assessment_id=?").get(started.id) as { count: number }).count)).toBeGreaterThan(0);
    expect(new LearningService(database).getPath(started.id).length).toBeGreaterThan(0);
  });

  it("does not rewrite an already completed assessment", async () => {
    const started = await repositories(database).assessments.start("official-01");
    prefillCompletedAssessment(database, started.id);
    const first = database.prepare("SELECT id FROM assessment_rounds WHERE assessment_id=? AND round_number=1").get(started.id) as { id: string };
    prefillCompletedAssessment(database, started.id);
    const second = database.prepare("SELECT id FROM assessment_rounds WHERE assessment_id=? AND round_number=1").get(started.id) as { id: string };
    expect(second.id).toBe(first.id);
  });
});
