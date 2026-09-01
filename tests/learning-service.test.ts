import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { session } from "@/app/api/learner/session/route";
import { openDatabase, type KaushalDatabase } from "@/db/client";
import { migrate } from "@/db/migrate";
import { importCatalog } from "@/data/catalog-import";
import { seedFoundation } from "@/data/seeds";
import { LearningService } from "@/services/learning-service";

describe("persisted learning paths", () => {
  let database: KaushalDatabase;
  beforeEach(() => { database = openDatabase(":memory:"); migrate(database); seedFoundation(database); importCatalog(database); });
  afterEach(() => database.close());

  it("persists an eligibility-filtered path and completion without changing proficiency", () => {
    database.prepare("INSERT INTO assessments(id,official_id,matrix_version_id,status) VALUES ('a1','official-01','matrix-01-v1','completed')").run();
    database.prepare("INSERT INTO assessment_results(id,assessment_id,competency_id,assessed_level,required_level,gap,priority,confidence,supported) VALUES ('r1','a1','competency-basic-statistics',2,4,2,6,.8,1)").run();
    const ids = ["rec-1", "completion-1", "history-1", "invite-1"];
    const service = new LearningService(database, () => ids.shift() ?? "extra");
    const path = service.createPath("a1");
    expect(path.items.length).toBeGreaterThan(0);
    expect(path.items.length).toBeLessThanOrEqual(2);
    expect(service.getPath("a1")).toHaveLength(path.items.length);
    const completion = service.completeCourse({ officialId: "official-01", courseId: path.items[0]!.courseId, competencyId: "competency-basic-statistics", level: 4 });
    expect(completion).toMatchObject({ reliability: 0.25, reassessmentInvited: true, proficiencyChanged: false });
    expect((database.prepare("SELECT COUNT(*) count FROM learning_history").get() as { count: number }).count).toBe(1);
    expect((database.prepare("SELECT COUNT(*) count FROM reassessment_invitations").get() as { count: number }).count).toBe(1);
    expect((database.prepare("SELECT assessed_level FROM assessment_results WHERE id='r1'").get() as { assessed_level: number }).assessed_level).toBe(2);
  });

  it("exposes completed course IDs in session history so same-title courses stay distinct", () => {
    database.prepare("INSERT INTO assessments(id,official_id,matrix_version_id,status) VALUES ('a1','official-01','matrix-01-v1','completed')").run();
    database.prepare("INSERT INTO assessment_results(id,assessment_id,competency_id,assessed_level,required_level,gap,priority,confidence,supported) VALUES ('r1','a1','competency-basic-statistics',2,4,2,6,.8,1)").run();
    const path = new LearningService(database).createPath("a1");
    const first = path.items[0]!;
    new LearningService(database).completeCourse({ officialId: "official-01", courseId: first.courseId, competencyId: first.competencyId });
    const payload = session(database, "a1") as { history: Array<{ courseId: string | null; courseTitle: string | null }>; recommendations: Array<{ courseId: string; title: string }> };
    expect(payload.history.some((row) => row.courseId === first.courseId)).toBe(true);
    const sibling = payload.recommendations.find((row) => row.courseId !== first.courseId && row.title === payload.history.find((h) => h.courseId === first.courseId)?.courseTitle);
    if (sibling) {
      expect(payload.history.some((row) => row.courseId === sibling.courseId)).toBe(false);
    }
  });
});
