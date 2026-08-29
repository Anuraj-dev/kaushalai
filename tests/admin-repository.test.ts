import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type KaushalDatabase } from "@/db/client";
import { migrate } from "@/db/migrate";
import { importCatalog } from "@/data/catalog-import";
import { seedFoundation } from "@/data/seeds";
import { AdminRepository } from "@/data/admin-repository";
import { SqliteAssessmentRepository } from "@/data/repositories";

describe("administrator matrix workspace", () => {
  let database: KaushalDatabase;
  let admin: AdminRepository;
  beforeEach(() => { database = openDatabase(":memory:"); migrate(database); seedFoundation(database); importCatalog(database); admin = new AdminRepository(database); });
  afterEach(() => database.close());

  it("lists all ten published matrices with complete question coverage", () => {
    const roles = admin.listRoles();
    expect(roles).toHaveLength(10);
    expect(roles.every((role) => role.status === "published" && role.competencyCount >= 6 && role.competencyCount <= 8 && role.coveredCompetencies === role.competencyCount)).toBe(true);
  });

  it("rejects invalid draft publication and creates an immutable next version", async () => {
    const draft = admin.createDraft("role-01");
    expect(() => admin.saveDraft(draft.versionId, draft.competencies.slice(0, 5).map((item) => ({ competencyId: item.id, requiredLevel: item.requiredLevel, importance: item.importance })))).toThrow(/6 to 8/);
    const saved = admin.saveDraft(draft.versionId, draft.competencies.map((item) => ({ competencyId: item.id, requiredLevel: item.requiredLevel, importance: item.importance })));
    const published = await admin.publish(saved.versionId);
    expect(published.version).toBe(2);
    expect(admin.getMatrix("role-01")?.version).toBe(2);
    expect(() => admin.saveDraft(published.versionId, published.competencies.map((item) => ({ competencyId: item.id, requiredLevel: item.requiredLevel, importance: item.importance })))).toThrow(/draft/);
  });

  it("keeps an active assessment pinned when an administrator publishes a newer version", async () => {
    const assessments = new SqliteAssessmentRepository(database);
    const active = await assessments.start("official-01");
    const draft = admin.createDraft("role-01");
    await admin.publish(draft.versionId);
    expect((await assessments.get(active.id))?.matrixVersionId).toBe("matrix-01-v1");
    expect(await admin.listOfficials().then((items) => items.find((item) => item.id === "official-01")?.reassessmentEligible)).toBe(false);
    database.prepare("UPDATE assessments SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=?").run(active.id);
    expect(await admin.listOfficials().then((items) => items.find((item) => item.id === "official-01")?.reassessmentEligible)).toBe(true);
  });

  it("computes analytics from persisted records", () => {
    expect(admin.analytics()).toMatchObject({ officials: 10, completedAssessments: 0, courseAssignments: 0, courseCompletions: 0 });
  });
});
