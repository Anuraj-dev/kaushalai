import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_SCHEMA_VERSION,
  CATALOG_GUIDE_EMPTY_PATH_COPY,
  CATALOG_GUIDE_IDENTITY_COPY,
  CATALOG_GUIDE_OUTSIDE_PATH_COPY,
  createAiAssessmentService,
  createGeminiAdapter,
  createGroqAdapter,
  validateCatalogGuideOutput,
  type CatalogGuide,
  type CatalogGuideAiRequest,
} from "@/ai";
import { importCatalog } from "@/data/catalog-import";
import { seedFoundation } from "@/data/seeds";
import { captureAssessmentSnapshot, restoreAssessmentSnapshot } from "@/db/assessment-snapshot";
import { openDatabase, type KaushalDatabase } from "@/db/client";
import { migrate } from "@/db/migrate";
import { CatalogGuideService, type ExplainCatalogGuide } from "@/services/catalog-guide-service";
import { LearningService } from "@/services/learning-service";

type Row = Record<string, unknown>;

function dumpTable(database: KaushalDatabase, sql: string, ...args: unknown[]) {
  return JSON.stringify(database.prepare(sql).all(...args));
}

function persistState(database: KaushalDatabase, assessmentId: string, officialId: string) {
  return {
    results: dumpTable(database, "SELECT * FROM assessment_results WHERE assessment_id=? ORDER BY id", assessmentId),
    recommendations: dumpTable(database, "SELECT * FROM recommendations WHERE assessment_id=? ORDER BY id", assessmentId),
    completions: dumpTable(database, "SELECT * FROM course_completions WHERE official_id=? ORDER BY id", officialId),
    history: dumpTable(database, "SELECT * FROM learning_history WHERE official_id=? ORDER BY id", officialId),
  };
}

function insertFinished(database: KaushalDatabase, status = "completed") {
  database.prepare("INSERT INTO assessments(id,official_id,matrix_version_id,status) VALUES ('a1','official-01','matrix-01-v1',?)").run(status);
  database.prepare("INSERT INTO assessment_results(id,assessment_id,competency_id,assessed_level,required_level,gap,priority,confidence,supported) VALUES ('r1','a1','competency-basic-statistics',2,4,2,6,.8,1)").run();
}

function firstPathCourse(database: KaushalDatabase) {
  return database.prepare(`SELECT r.course_id,c.title,c.provider,c.duration,c.level,c.source_url,c.detail_available
    FROM recommendations r JOIN courses c ON c.id=r.course_id WHERE r.assessment_id='a1' ORDER BY r.rank LIMIT 1`).get() as {
    course_id: string; title: string; provider: string | null; duration: string | null; level: string | null; source_url: string; detail_available: number;
  };
}

function explainResult(data: CatalogGuide) {
  return { data, provider: "gemini" as const, model: "test", requestId: "req", attempts: 1, latencyMs: 1 };
}

describe("catalog guide service", () => {
  let database: KaushalDatabase;
  beforeEach(() => {
    database = openDatabase(":memory:");
    migrate(database);
    seedFoundation(database);
    importCatalog(database);
  });
  afterEach(() => database.close());

  it("never injects an unrelated catalog course that matches the question", async () => {
    insertFinished(database);
    new LearningService(database).createPath("a1");
    const pathIds = new Set((database.prepare("SELECT course_id FROM recommendations WHERE assessment_id='a1'").all() as Row[]).map((row) => String(row.course_id)));
    const unrelated = (database.prepare("SELECT id,title FROM courses").all() as Array<{ id: string; title: string }>)
      .find((course) => !pathIds.has(course.id) && (course.title.toLowerCase().match(/[a-z0-9]+/g) ?? []).some((word) => word.length >= 4));
    expect(unrelated).toBeTruthy();

    const captured: CatalogGuideAiRequest[] = [];
    const explain = vi.fn(async (request: CatalogGuideAiRequest) => {
      captured.push(request);
      return explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "Skill gaps in Basic Statistics.", courseNotes: [], unavailable: "" });
    });
    const response = await new CatalogGuideService(database, explain).ask("a1", unrelated!.title);

    expect(explain).toHaveBeenCalled();
    expect(captured[0]?.pathCourses.map((course) => course.courseId).every((id) => pathIds.has(id))).toBe(true);
    expect(captured[0]?.pathCourses.some((course) => course.courseId === unrelated!.id)).toBe(false);
    expect(response.citedCourses.some((course) => course.courseId === unrelated!.id)).toBe(false);
  });

  it("rejects unknown, duplicate, and off-path course IDs from a mocked model payload", async () => {
    insertFinished(database);
    new LearningService(database).createPath("a1");
    const path = firstPathCourse(database);
    const question = `Why was ${path.title} recommended?`;

    const throwing = vi.fn(async (request: CatalogGuideAiRequest) => {
      const allowed = request.pathCourses.map((course) => course.courseId);
      validateCatalogGuideOutput({
        schemaVersion: AI_SCHEMA_VERSION,
        gapSummary: "Skill gaps in Basic Statistics.",
        courseNotes: [{ courseId: "not-on-path", note: "Invented course." }],
        unavailable: "",
      }, allowed);
      return explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "", courseNotes: [], unavailable: "" });
    });
    await expect(new CatalogGuideService(database, throwing).ask("a1", question)).rejects.toThrow(/outside the learning path/);

    const duplicate = vi.fn(async (request: CatalogGuideAiRequest) => {
      const allowed = request.pathCourses.map((course) => course.courseId);
      const note = { courseId: path.course_id, note: "Repeated." };
      return explainResult(validateCatalogGuideOutput({
        schemaVersion: AI_SCHEMA_VERSION,
        gapSummary: "Skill gaps in Basic Statistics.",
        courseNotes: [note, note],
        unavailable: "",
      }, allowed));
    });
    await expect(new CatalogGuideService(database, duplicate).ask("a1", question)).rejects.toThrow(/duplicated/);

    const succeeding: ExplainCatalogGuide = async (request) => {
      const allowed = request.pathCourses.map((course) => course.courseId);
      return explainResult(validateCatalogGuideOutput({
        schemaVersion: AI_SCHEMA_VERSION,
        gapSummary: "Skill gaps in Basic Statistics.",
        courseNotes: [{ courseId: path.course_id, note: "Closes the statistics gap." }],
        unavailable: "",
      }, allowed));
    };
    const ok = await new CatalogGuideService(database, succeeding).ask("a1", question);
    expect(ok.citedCourses.map((course) => course.courseId)).toEqual([path.course_id]);
    expect(ok.citedCourses.some((course) => course.courseId === "not-on-path")).toBe(false);
  });

  it("supplies titles, providers, evidence, and URLs from SQLite, ignoring model extras", async () => {
    insertFinished(database);
    new LearningService(database).createPath("a1");
    const path = firstPathCourse(database);
    const explain = vi.fn(async () => explainResult({
      schemaVersion: AI_SCHEMA_VERSION,
      gapSummary: "Skill gaps in Basic Statistics.",
      courseNotes: [{
        courseId: path.course_id,
        note: "Grounded in the persisted recommendation.",
        title: "WRONG TITLE FROM MODEL",
        provider: "WRONG PROVIDER",
        sourceUrl: "https://example.test/wrong",
      } as CatalogGuide["courseNotes"][number] & { title: string; provider: string; sourceUrl: string }],
      unavailable: "",
    }));

    const response = await new CatalogGuideService(database, explain).ask("a1", `Why was ${path.title} recommended?`);
    expect(response.citedCourses).toHaveLength(1);
    expect(response.citedCourses[0]).toMatchObject({
      courseId: path.course_id,
      title: path.title,
      provider: path.provider ?? "",
      duration: path.duration ?? "",
      level: path.level ?? "",
      sourceUrl: path.source_url,
      evidence: path.detail_available === 1 ? "detailed" : "title",
      note: "Grounded in the persisted recommendation.",
    });
    expect(response.citedCourses[0]?.title).not.toBe("WRONG TITLE FROM MODEL");
  });

  it("treats a session chip as on-path and does not use the outside-path copy", async () => {
    insertFinished(database);
    new LearningService(database).createPath("a1");
    const path = firstPathCourse(database);
    const ai = createAiAssessmentService({
      gemini: createGeminiAdapter({}),
      groq: createGroqAdapter({}),
      sleep: async () => undefined,
      jitterMs: () => 0,
    });
    const response = await new CatalogGuideService(database, (request) => ai.explainCatalogGuide(request)).ask("a1", "Why is this first?");
    expect(response.unavailable).toBe("");
    expect(response.citedCourses.length).toBeGreaterThan(0);
    expect(response.citedCourses[0]?.courseId).toBe(path.course_id);
    expect(response.citedCourses[0]?.title).toBe(path.title);
  });

  it("answers identity questions without calling providers", async () => {
    insertFinished(database);
    new LearningService(database).createPath("a1");
    const explain = vi.fn(async () => explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "should not run", courseNotes: [], unavailable: "" }));
    const response = await new CatalogGuideService(database, explain).ask("a1", "Who are you?");
    expect(explain).not.toHaveBeenCalled();
    expect(response.gapSummary).toBe(CATALOG_GUIDE_IDENTITY_COPY);
    expect(response.citedCourses).toEqual([]);
    expect(response.unavailable).toBe("");
  });

  it("does not call explain on an empty path and uses the empty-path copy", async () => {
    insertFinished(database);
    const explain = vi.fn(async () => explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "should not run", courseNotes: [], unavailable: "" }));
    const response = await new CatalogGuideService(database, explain).ask("a1", "Why is this first?");
    expect(explain).not.toHaveBeenCalled();
    expect(response.unavailable).toBe(CATALOG_GUIDE_EMPTY_PATH_COPY);
    expect(response.citedCourses).toEqual([]);
    expect(response.suggestedNext).toEqual(["Why is this first?", "Which gap does this address?"]);
    expect(response.gapSummary === CATALOG_GUIDE_EMPTY_PATH_COPY || response.gapSummary.includes("Basic Statistics")).toBe(true);
  });

  it("falls back to grounded seeded notes when provider credentials are missing", async () => {
    insertFinished(database);
    new LearningService(database).createPath("a1");
    const path = firstPathCourse(database);
    const ai = createAiAssessmentService({
      gemini: createGeminiAdapter({}),
      groq: createGroqAdapter({}),
      sleep: async () => undefined,
      jitterMs: () => 0,
    });
    const response = await new CatalogGuideService(database, (request) => ai.explainCatalogGuide(request))
      .ask("a1", `Why was ${path.title} recommended for statistics?`);
    expect(response.citedCourses.length).toBeGreaterThan(0);
    expect(response.citedCourses.some((course) => course.note.includes(path.title))).toBe(true);
    expect(response.unavailable).not.toBe(CATALOG_GUIDE_OUTSIDE_PATH_COPY);
  });

  it("rejects active and unknown assessments and does not persist guide output", async () => {
    database.prepare("INSERT INTO assessments(id,official_id,matrix_version_id,status) VALUES ('active-1','official-01','matrix-01-v1','active')").run();
    const explain = vi.fn(async () => explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "", courseNotes: [], unavailable: "" }));
    const service = new CatalogGuideService(database, explain);

    await expect(service.ask("missing", "Why is this first?")).rejects.toMatchObject({ status: 404, message: "Assessment not found" });
    await expect(service.ask("active-1", "Why is this first?")).rejects.toMatchObject({ status: 400, message: "Assessment is not finished" });
    expect(explain).not.toHaveBeenCalled();

    insertFinished(database, "provisional");
    new LearningService(database).createPath("a1");
    const path = firstPathCourse(database);
    new LearningService(database).completeCourse({ officialId: "official-01", courseId: path.course_id, competencyId: "competency-basic-statistics" });
    const before = persistState(database, "a1", "official-01");
    await service.ask("a1", `Why was ${path.title} recommended?`);
    expect(persistState(database, "a1", "official-01")).toEqual(before);
  });

  it("restores the same allowed course IDs from an assessment snapshot", async () => {
    insertFinished(database);
    new LearningService(database).createPath("a1");
    const snapshot = captureAssessmentSnapshot(database, "a1");
    expect(snapshot).not.toBeNull();

    const other = openDatabase(":memory:");
    try {
      migrate(other);
      seedFoundation(other);
      importCatalog(other);
      restoreAssessmentSnapshot(other, snapshot!);

      async function allowedIds(db: KaushalDatabase) {
        let ids: string[] = [];
        const explain = vi.fn(async (request: CatalogGuideAiRequest) => {
          ids = request.pathCourses.map((course) => course.courseId);
          return explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "Skill gaps in Basic Statistics.", courseNotes: [], unavailable: "" });
        });
        await new CatalogGuideService(db, explain).ask("a1", "Why is this first for statistics?");
        return ids;
      }

      expect(await allowedIds(other)).toEqual(await allowedIds(database));
    } finally {
      other.close();
    }
  });
});
