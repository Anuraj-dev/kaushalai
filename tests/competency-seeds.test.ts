import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type KaushalDatabase } from "@/db/client";
import { migrate } from "@/db/migrate";
import { COMPETENCY_LIBRARY, ROLE_MATRICES, validateCompetencySeeds } from "@/data/competency-library";
import { seedFoundation } from "@/data/seeds";

describe("competency and role matrix seeds", () => {
  let database: KaushalDatabase;
  beforeEach(() => { database = openDatabase(":memory:"); migrate(database); seedFoundation(database); });
  afterEach(() => database.close());

  it("validates ten matrices with six to eight unique competencies", () => {
    expect(() => validateCompetencySeeds()).not.toThrow();
    expect(ROLE_MATRICES).toHaveLength(10);
    for (const matrix of ROLE_MATRICES) {
      expect(matrix.competencies.length).toBeGreaterThanOrEqual(6);
      expect(matrix.competencies.length).toBeLessThanOrEqual(8);
      expect(new Set(matrix.competencies.map(({ competency }) => competency)).size).toBe(matrix.competencies.length);
    }
    expect(ROLE_MATRICES[0].competencies.map(({ competency }) => competency)).toEqual(["Basic Statistics", "Survey Design", "Sampling", "Data Quality", "R Programming", "Python", "Data Visualization", "Ethics"]);
  });

  it("rejects duplicate competency definitions", () => {
    expect(() => validateCompetencySeeds([...COMPETENCY_LIBRARY, { ...COMPETENCY_LIBRARY[0], id: "duplicate" }], ROLE_MATRICES)).toThrow(/Duplicate competency/);
  });

  it("gives every competency a complete rubric, normalized tags, baseline, and fallback bank", () => {
    for (const definition of COMPETENCY_LIBRARY) {
      expect(definition.rubric.map(({ level }) => level)).toEqual([1, 2, 3, 4, 5]);
      expect(definition.courseTags.every((tag) => tag === tag.trim().toLowerCase())).toBe(true);
      expect(definition.baseline.choices.map(({ demonstratedLevel }) => demonstratedLevel)).toEqual([1, 2, 3, 4, 5]);
      expect(definition.fallbackQuestions.length).toBeGreaterThanOrEqual(3);
      const counts = database.prepare("SELECT kind,COUNT(*) count FROM questions WHERE competency_id=? GROUP BY kind").all(definition.id) as Array<{ kind: string; count: number }>;
      expect(Object.fromEntries(counts.map(({ kind, count }) => [kind, count]))).toEqual({ adaptive_fallback: 3, baseline_single_choice: 1 });
    }
  });

  it("resolves every official to exactly one published matrix v1", () => {
    const rows = database.prepare(`SELECT o.id,COUNT(v.id) matrix_count FROM officials o JOIN competency_matrices m ON m.job_role_id=o.job_role_id JOIN matrix_versions v ON v.matrix_id=m.id AND v.status='published' GROUP BY o.id`).all() as Array<{ id: string; matrix_count: number }>;
    expect(rows).toHaveLength(10);
    expect(rows.every(({ matrix_count }) => matrix_count === 1)).toBe(true);
    const sizes = database.prepare("SELECT matrix_version_id,COUNT(*) count FROM matrix_competencies GROUP BY matrix_version_id").all() as Array<{ matrix_version_id: string; count: number }>;
    expect(sizes).toHaveLength(10);
    expect(sizes.every(({ count }) => count >= 6 && count <= 8)).toBe(true);
  });
});
