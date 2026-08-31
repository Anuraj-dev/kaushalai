import { describe, expect, it } from "vitest";
import { captureAssessmentSnapshot, restoreAssessmentSnapshot } from "@/db/assessment-snapshot";
import { initializeDatabase, openDatabase } from "@/db/client";
import { repositories } from "@/data";

describe("assessment snapshots", () => {
  it("restores an assessment created by another runtime instance", async () => {
    const source = openDatabase(":memory:");
    const target = openDatabase(":memory:");
    try {
      initializeDatabase(source);
      initializeDatabase(target);
      const assessment = await repositories(source).assessments.start("official-01");
      source.prepare("INSERT INTO assessment_rounds(id,assessment_id,round_number,kind,status) VALUES (?,?,1,?,'pending')")
        .run("round-1", assessment.id, JSON.stringify({ kind: "baseline", questions: [] }));

      const snapshot = captureAssessmentSnapshot(source, assessment.id);
      expect(snapshot).not.toBeNull();
      restoreAssessmentSnapshot(target, snapshot!);

      expect(target.prepare("SELECT status FROM assessments WHERE id=?").get(assessment.id)).toEqual({ status: "active" });
      expect(target.prepare("SELECT id FROM assessment_rounds WHERE assessment_id=?").get(assessment.id)).toEqual({ id: "round-1" });
    } finally {
      source.close();
      target.close();
    }
  });
});
