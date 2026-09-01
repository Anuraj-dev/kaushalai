import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  AI_SCHEMA_VERSION,
  CATALOG_GUIDE_EMPTY_PATH_COPY,
  CATALOG_GUIDE_IDENTITY_COPY,
  CATALOG_GUIDE_OUTSIDE_PATH_COPY,
  type CatalogGuide,
  type CatalogGuideAiRequest,
} from "@/ai";
import { importCatalog } from "@/data/catalog-import";
import { seedFoundation } from "@/data/seeds";
import { openDatabase, type KaushalDatabase } from "@/db/client";
import { migrate } from "@/db/migrate";
import { CatalogGuideService, type ExplainCatalogGuide } from "@/services/catalog-guide-service";
import { LearningService } from "@/services/learning-service";

type Row = Record<string, unknown>;

function explainResult(data: CatalogGuide) {
  return { data, provider: "gemini" as const, model: "test", requestId: "req", attempts: 1, latencyMs: 1 };
}

function insertFinished(db: KaushalDatabase, status = "completed") {
  db.prepare("INSERT INTO assessments(id,official_id,matrix_version_id,status) VALUES ('a1','official-01','matrix-01-v1',?)").run(status);
  db.prepare(
    "INSERT INTO assessment_results(id,assessment_id,competency_id,assessed_level,required_level,gap,priority,confidence,supported) VALUES ('r1','a1','competency-basic-statistics',2,4,2,6,.8,1)",
  ).run();
  db.prepare(
    "INSERT INTO assessment_results(id,assessment_id,competency_id,assessed_level,required_level,gap,priority,confidence,supported) VALUES ('r2','a1','competency-data-quality',2,4,2,5,.6,0)",
  ).run();
}

describe("chatbot weird-behaviour regression", () => {
  let db: KaushalDatabase;
  beforeEach(() => {
    db = openDatabase(":memory:");
    migrate(db);
    seedFoundation(db);
    importCatalog(db);
  });
  afterEach(() => db.close());

  it("WEIRD: generic 'Which gap does this address?' returns Basic Statistics + Data Quality mixed (screenshots 2-gap hallucination)", async () => {
    insertFinished(db);
    new LearningService(db).createPath("a1");
    const path = db.prepare("SELECT course_id, competency_id FROM recommendations WHERE assessment_id='a1' ORDER BY rank").all() as Row[];
    // Ensure path spans at least 2 competencies (Basic Statistics vs Data Quality)
    const comps = new Set(path.map((r) => String(r.competency_id)));
    expect(comps.size).toBeGreaterThanOrEqual(2);

    // Seeded fallback for generic gap question currently returns slice(0,3) = mixed competencies -> weird
    const service = new CatalogGuideService(db, async (req: CatalogGuideAiRequest) => {
      // Mimic seeded fallback: no distinctive tokens, returns first 3
      const notes = req.pathCourses.slice(0, 3).map((c) => ({ courseId: c.courseId, note: `Closes ${c.competencyName} gap` }));
      return explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "Mixed gaps", courseNotes: notes, unavailable: "" });
    });

    const res = await service.ask("a1", "Which gap does this address?");
    const citedComps = new Set(res.citedCourses.map((c) => c.competencyId));
    // WEIRD: currently 2 competencies, expected 1 or 0 for generic question
    // This test documents the weird behaviour — it SHOULD be 1 competency or gapSummary only
    expect(citedComps.size).toBe(2); // <-- weird: mixed gaps
    // Ideal assertion (currently failing, uncomment to fix):
    // expect(citedComps.size).toBeLessThanOrEqual(1);
  });

  it("WEIRD: 'Assessment is not finished' red error when guide visible mid-assessment (active status)", async () => {
    db.prepare("INSERT INTO assessments(id,official_id,matrix_version_id,status) VALUES ('active-1','official-01','matrix-01-v1','active')").run();
    const service = new CatalogGuideService(db, async () => explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "", courseNotes: [], unavailable: "" }));
    await expect(service.ask("active-1", "Which gap does this address?")).rejects.toMatchObject({ status: 400, message: "Assessment is not finished" });
    // Weird: frontend shows this 400 as red alert inside chat (screenshot red box) instead of friendly unavailable
    // Ideal: should return 200 with unavailable copy, not throw
  });

  it("WEIRD: 'What is this course about?' is hijacked as identity (what is this regex)", async () => {
    insertFinished(db);
    new LearningService(db).createPath("a1");
    const explain = vi.fn(async () => explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "should not run", courseNotes: [], unavailable: "" }));
    const service = new CatalogGuideService(db, explain);
    const res = await service.ask("a1", "What is this course about?");
    // Currently treated as identity because isCatalogGuideIdentityQuestion matches /\bwhat is this\b/
    expect(res.gapSummary).toBe(CATALOG_GUIDE_IDENTITY_COPY);
    expect(explain).not.toHaveBeenCalled();
    // Weird: user expects course explanation, gets identity copy
  });

  it("WEIRD: off-path 'Recommend a Python course' correctly outside but still calls AI (waste)", async () => {
    insertFinished(db);
    new LearningService(db).createPath("a1");
    const pathCourses = db.prepare("SELECT course_id FROM recommendations WHERE assessment_id='a1'").all() as Row[];
    const pathSet = new Set(pathCourses.map((r) => String(r.course_id)));
    const offPath = (db.prepare("SELECT id FROM courses WHERE LOWER(title) LIKE '%python%'").all() as Row[]).find((r) => !pathSet.has(String(r.id)));
    const explain = vi.fn(async (req: CatalogGuideAiRequest) => {
      const fakeId = offPath ? String(offPath.id) : "course-fake-off-path";
      return explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "", courseNotes: [{ courseId: fakeId, note: "Hallucinated" }], unavailable: "" });
    });
    const service = new CatalogGuideService(db, explain);
    const res = await service.ask("a1", "Recommend a Python course for my gaps");
    // Currently: distinctive [python] not in corpus -> outsidePath true, but AI was still called, then discarded
    expect(explain).toHaveBeenCalled(); // weird: wastes provider call for outside query
    expect(res.unavailable).toBe(CATALOG_GUIDE_OUTSIDE_PATH_COPY);
    expect(res.citedCourses).toEqual([]);
  });

  it("WEIRD: 'Tell me about SQL' (3-letter) filtered out, but still correctly outside via 'tell' token", async () => {
    insertFinished(db);
    new LearningService(db).createPath("a1");
    const explain = vi.fn(async () => explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "Skill gaps", courseNotes: [], unavailable: "" }));
    const service = new CatalogGuideService(db, explain);
    // SQL length 3 -> dropped by tokens(), but 'tell' remains distinctive and not in corpus -> outside
    const res = await service.ask("a1", "Tell me about SQL");
    expect(explain).toHaveBeenCalled(); // still calls AI before checking outside (weird)
    expect(res.unavailable).toBe(CATALOG_GUIDE_OUTSIDE_PATH_COPY);
  });

  it("WEIRD: client allowed filter hides hallucination silently (components/catalog-guide-panel.tsx:217)", async () => {
    insertFinished(db);
    new LearningService(db).createPath("a1");
    const path = db.prepare("SELECT course_id FROM recommendations WHERE assessment_id='a1' LIMIT 1").get() as Row;
    const allowed = String(path.course_id);
    // Simulate server returning a hallucinated extra course that client will filter
    const hallucinated = [
      { courseId: allowed, title: "Real", provider: "p", duration: "1h", level: "l", sourceUrl: "u", evidence: "title" as const, competencyId: "c", competencyName: "n", rank: 1, note: "real" },
      { courseId: "course-not-on-path", title: "Fake", provider: "x", duration: "1h", level: "l", sourceUrl: "u", evidence: "title" as const, competencyId: "c", competencyName: "n", rank: 99, note: "hallucinated" },
    ];
    const filtered = hallucinated.filter((c) => new Set([allowed]).has(c.courseId));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].courseId).toBe(allowed);
    // Weird: UI will show only 1 card, silently dropping hallucination, user never sees error, masking bug
  });

  it("WEIRD: empty path chip 'Why is this first?' calls AI with empty path but frontend still shows chip as clickable", async () => {
    insertFinished(db);
    // Do NOT createPath -> empty recommendations
    const service = new CatalogGuideService(db, async () => explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "should not run", courseNotes: [], unavailable: "" }));
    const res = await service.ask("a1", "Why is this first?");
    expect(res.unavailable).toBe(CATALOG_GUIDE_EMPTY_PATH_COPY);
    expect(res.citedCourses).toEqual([]);
    // Weird: chips suggestedNext includes Why is this first? even though empty, clickable chip will just re-ask same and get same empty copy loop
    expect(res.suggestedNext).toContain("Why is this first?");
  });

  it("WEIRD: gapSummary + unavailable both empty allowed by validateCatalogGuideOutput (contracts.ts:281)", async () => {
    insertFinished(db);
    new LearningService(db).createPath("a1");
    const path = db.prepare("SELECT course_id FROM recommendations WHERE assessment_id='a1' LIMIT 1").get() as Row;
    const explain: ExplainCatalogGuide = async () => explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "", courseNotes: [{ courseId: String(path.course_id), note: "ok" }], unavailable: "" });
    const service = new CatalogGuideService(db, explain);
    const res = await service.ask("a1", "Why is this first?");
    // Both empty but with cite -> currently allowed, shows card with no summary
    expect(res.gapSummary).toBe("");
    expect(res.citedCourses).toHaveLength(1);
    // Weird: user sees card with no gap context
  });
});
