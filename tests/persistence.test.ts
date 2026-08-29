import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type KaushalDatabase } from "@/db/client";
import { migrate } from "@/db/migrate";
import { importCatalog, stableCourseId } from "@/data/catalog-import";
import { SqliteAssessmentRepository, SqliteOfficialProfileProvider, SqliteRoleMatrixRepository } from "@/data/repositories";
import { seedFoundation, SEEDED_ROLES } from "@/data/seeds";

describe("persistence foundation", () => {
  let database: KaushalDatabase;
  beforeEach(() => { database = openDatabase(":memory:"); migrate(database); seedFoundation(database); });
  afterEach(() => database.close());

  it("seeds one official per approved role and three selectable personas", async () => {
    const profiles = await new SqliteOfficialProfileProvider(database).list();
    expect(profiles).toHaveLength(10);
    expect(new Set(profiles.map((profile) => profile.jobRoleName))).toEqual(new Set(SEEDED_ROLES));
    expect(profiles.filter((profile) => profile.isDemoSelectable)).toHaveLength(3);
    expect((database.prepare("SELECT COUNT(*) count FROM administrators").get() as { count: number }).count).toBe(1);
  });

  it("imports all courses with stable IDs and source coverage metadata", () => {
    expect(importCatalog(database)).toEqual({ imported: 222, detailed: 25 });
    const first = database.prepare("SELECT * FROM courses ORDER BY title LIMIT 1").get() as Record<string, unknown>;
    expect(stableCourseId({ title: "Course", provider: "Provider", source_url: "https://example.test/course" })).toBe(stableCourseId({ title: "Changed", provider: "Changed", source_url: "https://example.test/course" }));
    expect(first.incomplete_source).toBe(1);
    expect((database.prepare("SELECT COUNT(*) count FROM courses").get() as { count: number }).count).toBe(222);
    expect((database.prepare("SELECT COUNT(*) count FROM courses WHERE detail_available=1").get() as { count: number }).count).toBe(25);
    const originalId = first.id;
    importCatalog(database);
    expect((database.prepare("SELECT COUNT(*) count FROM courses").get() as { count: number }).count).toBe(222);
    expect((database.prepare("SELECT id FROM courses WHERE title=?").get(first.title) as { id: string }).id).toBe(originalId);
  });

  it("pins an assessment to its starting version and detects a later published version", async () => {
    const matrices = new SqliteRoleMatrixRepository(database);
    const assessments = new SqliteAssessmentRepository(database, matrices);
    const started = await assessments.start("official-01");
    expect(started.matrixVersionId).toBe("matrix-01-v1");
    database.prepare("UPDATE assessments SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=?").run(started.id);
    const draft = await matrices.createDraft("role-01");
    await matrices.publish(draft.id);
    expect((await assessments.get(started.id))?.matrixVersionId).toBe("matrix-01-v1");
    expect(await matrices.isReassessmentEligible("official-01")).toBe(true);
  });

  it("makes published matrix versions and their rows immutable", async () => {
    const draft = await new SqliteRoleMatrixRepository(database).createDraft("role-01");
    database.prepare("INSERT INTO matrix_competencies(id,matrix_version_id,competency_id,required_level,importance) VALUES ('mc-1',?,'competency-basic-statistics',3,1)").run(draft.id);
    await new SqliteRoleMatrixRepository(database).publish(draft.id);
    expect(() => database.prepare("UPDATE matrix_versions SET version=7 WHERE id=?").run(draft.id)).toThrow(/immutable/);
    expect(() => database.prepare("UPDATE matrix_competencies SET required_level=4 WHERE id='mc-1'").run()).toThrow(/immutable/);
    expect(() => database.prepare("INSERT INTO matrix_competencies(id,matrix_version_id,competency_id,required_level,importance) VALUES ('mc-2',?,'competency-basic-statistics',4,1)").run(draft.id)).toThrow(/immutable/);
  });
});
