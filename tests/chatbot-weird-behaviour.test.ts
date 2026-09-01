import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  AI_SCHEMA_VERSION,
  createAiAssessmentService,
  createGeminiAdapter,
  createGroqAdapter,
  type CatalogGuide,
  type PlatformChatRequest,
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

  it("keeps generic gap questions from mixing multiple competencies in fallback", async () => {
    insertFinished(db);
    new LearningService(db).createPath("a1");
    const path = db.prepare("SELECT course_id, competency_id FROM recommendations WHERE assessment_id='a1' ORDER BY rank").all() as Row[];
    // Ensure path spans at least 2 competencies (Basic Statistics vs Data Quality)
    const comps = new Set(path.map((r) => String(r.competency_id)));
    expect(comps.size).toBeGreaterThanOrEqual(2);

    const ai = createAiAssessmentService({
      gemini: createGeminiAdapter({}),
      groq: createGroqAdapter({}),
      sleep: async () => undefined,
      jitterMs: () => 0,
    });
    const service = new CatalogGuideService(db, (req: PlatformChatRequest) => ai.chat(req));

    const res = await service.ask("a1", "Which gap does this address?");
    const citedComps = new Set(res.citedCourses.map((c) => c.competencyId));
    expect(citedComps.size).toBeLessThanOrEqual(1);
  });

  it("uses platform context instead of arbitrary courses for assessment questions", async () => {
    insertFinished(db);
    new LearningService(db).createPath("a1");
    const ai = createAiAssessmentService({
      gemini: createGeminiAdapter({}),
      groq: createGroqAdapter({}),
      sleep: async () => undefined,
      jitterMs: () => 0,
    });

    const response = await new CatalogGuideService(db, (request: PlatformChatRequest) => ai.chat(request))
      .ask("a1", "How does the assessment work?");
    expect(response.citedCourses).toEqual([]);
    expect(response.answer).toContain("Kaushal");
  });

  it("describes an active assessment as pending instead of as zero gaps", async () => {
    db.prepare("INSERT INTO assessments(id,official_id,matrix_version_id,status) VALUES ('active-1','official-01','matrix-01-v1','active')").run();
    const requests: PlatformChatRequest[] = [];
    const service = new CatalogGuideService(db, async (request: PlatformChatRequest) => {
      requests.push(request);
      return {
        data: {
          schemaVersion: AI_SCHEMA_VERSION,
          answer: "The assessment is still in progress.",
          citations: [],
          gapSummary: "",
          courseNotes: [],
          unavailable: "",
        },
      };
    });
    const response = await service.ask("active-1", "Which gap does this address?");
    expect(requests[0]?.assessmentStatus).toBe("active");
    expect(response.gapSummary).toContain("still in progress");
  });

  it("sends course questions to the generalized handler", async () => {
    insertFinished(db);
    new LearningService(db).createPath("a1");
    const explain = vi.fn(async () => explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "should not run", courseNotes: [], unavailable: "" }));
    const service = new CatalogGuideService(db, explain);
    const res = await service.ask("a1", "What is this course about?");
    expect(res.gapSummary).toBe("should not run");
    expect(explain).toHaveBeenCalled();
  });

  it("retrieves off-path catalog courses instead of rejecting them as outside the path", async () => {
    insertFinished(db);
    new LearningService(db).createPath("a1");
    const pathCourses = db.prepare("SELECT course_id FROM recommendations WHERE assessment_id='a1'").all() as Row[];
    const pathSet = new Set(pathCourses.map((r) => String(r.course_id)));
    const offPath = (db.prepare("SELECT id FROM courses WHERE LOWER(title) LIKE '%python%'").all() as Row[]).find((r) => !pathSet.has(String(r.id)));
    const explain = vi.fn(async () => {
      const fakeId = offPath ? String(offPath.id) : "course-fake-off-path";
      return explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "", courseNotes: [{ courseId: fakeId, note: "Hallucinated" }], unavailable: "" });
    });
    const service = new CatalogGuideService(db, explain);
    const res = await service.ask("a1", "Recommend a Python course for my gaps");
    expect(explain).toHaveBeenCalled();
    expect(res.unavailable).toBe("");
    if (offPath) expect(res.citedCourses.some((course) => course.courseId === offPath.id)).toBe(true);
  });

  it("keeps SQL as a searchable three-letter catalog term", async () => {
    insertFinished(db);
    new LearningService(db).createPath("a1");
    const explain = vi.fn(async () => explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "Skill gaps", courseNotes: [], unavailable: "" }));
    const service = new CatalogGuideService(db, explain);
    const res = await service.ask("a1", "Tell me about SQL");
    expect(explain).toHaveBeenCalled();
    expect(res.unavailable).toBe("");
  });

  it("does not expose citations that are absent from retrieved context", async () => {
    insertFinished(db);
    new LearningService(db).createPath("a1");
    const path = db.prepare("SELECT course_id FROM recommendations WHERE assessment_id='a1' LIMIT 1").get() as Row;
    const allowed = String(path.course_id);
    const service = new CatalogGuideService(db, async () => ({
      data: {
        schemaVersion: AI_SCHEMA_VERSION,
        answer: "Grounded answer",
        citations: [
          { courseId: allowed, note: "real" },
          { courseId: "course-not-in-context", note: "hallucinated" },
        ],
        gapSummary: "",
        courseNotes: [],
        unavailable: "",
      },
    }));
    const response = await service.ask("a1", "Why is this first?");
    expect(response.citedCourses.map((course) => course.courseId)).toEqual([allowed]);
  });

  it("uses general chips when no learning path exists", async () => {
    insertFinished(db);
    // Do NOT createPath -> empty recommendations
    const service = new CatalogGuideService(db, async () => explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "should not run", courseNotes: [], unavailable: "" }));
    const res = await service.ask("a1", "Why is this first?");
    expect(res.unavailable).toBe("");
    expect(res.citedCourses).toEqual([]);
    expect(res.suggestedNext).not.toContain("Why is this first?");
    expect(res.suggestedNext.slice(0, 3)).toEqual(["How does the assessment work?", "Explain my gaps", "How is the learning plan built?"]);
  });

  it("WEIRD: gapSummary + unavailable both empty allowed by validateCatalogGuideOutput (contracts.ts:281)", async () => {
    insertFinished(db);
    new LearningService(db).createPath("a1");
    const path = db.prepare("SELECT course_id FROM recommendations WHERE assessment_id='a1' LIMIT 1").get() as Row;
    const explain: ExplainCatalogGuide = async () => explainResult({ schemaVersion: AI_SCHEMA_VERSION, gapSummary: "", courseNotes: [{ courseId: String(path.course_id), note: "ok" }], unavailable: "" });
    const service = new CatalogGuideService(db, explain);
    const res = await service.ask("a1", "Why is this first?");
    // Legacy notes still render as citations, while the main answer remains available.
    expect(res.gapSummary).toContain("Skill gaps in");
    expect(res.answer).toBe("ok");
    expect(res.citedCourses).toHaveLength(1);
    // Weird: user sees card with no gap context
  });
});
