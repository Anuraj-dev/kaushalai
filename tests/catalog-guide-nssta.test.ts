import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_SCHEMA_VERSION, createAiAssessmentService, createGeminiAdapter, createGroqAdapter, type PlatformChat, type PlatformChatRequest } from "@/ai";
import { importCatalog } from "@/data/catalog-import";
import { seedFoundation } from "@/data/seeds";
import { openDatabase, type KaushalDatabase } from "@/db/client";
import { migrate } from "@/db/migrate";
import { CatalogGuideService, type LoadNsstaProgrammes } from "@/services/catalog-guide-service";
import { NsstaUnavailableError } from "@/services/nssta";
import type { CalendarEntry } from "@/services/nssta-calendar";
import { LearningService } from "@/services/learning-service";

const CALENDAR_URL = "https://nssta.gov.in/api/trainingcalendar/download/42";

const entry = (overrides: Partial<CalendarEntry>): CalendarEntry => ({
  section: "Refresher training", serial: 1, topic: "Ethics in Public Service", participants: "Officers of State DES",
  dates: "07-11 Dec 2026", startDate: "2026-12-07", endDate: "2026-12-11", duration: "1 week", venue: "NSSTA Greater Noida",
  ...overrides,
});

const programmes = [
  entry({ serial: 1 }),
  entry({ serial: 2, topic: "Sample Survey Methodology and Estimation", startDate: "2026-12-14" }),
];
const loadLive: LoadNsstaProgrammes = async () => ({ programmes, calendarUrl: CALENDAR_URL });

function chatResult(data: Partial<PlatformChat>) {
  return { data: { schemaVersion: AI_SCHEMA_VERSION, answer: "Answer.", citations: [], gapSummary: "", courseNotes: [], unavailable: "", ...data } };
}

describe("catalog guide with NSSTA programmes", () => {
  let database: KaushalDatabase;
  beforeEach(() => {
    database = openDatabase(":memory:");
    migrate(database);
    seedFoundation(database);
    importCatalog(database);
    database.prepare("INSERT INTO assessments(id,official_id,matrix_version_id,status) VALUES ('a1','official-01','matrix-01-v1','completed')").run();
    database.prepare("INSERT INTO assessment_results(id,assessment_id,competency_id,assessed_level,required_level,gap,priority,confidence,supported) VALUES ('r1','a1','competency-basic-statistics',2,4,2,6,.8,1)").run();
    new LearningService(database).createPath("a1");
  });
  afterEach(() => {
    database.close();
    vi.restoreAllMocks();
  });

  it("sends matching programmes to the model and returns the cited ones with the calendar link", async () => {
    let sent: PlatformChatRequest | undefined;
    const chat = vi.fn(async (request: PlatformChatRequest) => {
      sent = request;
      const programmeId = request.nsstaProgrammes?.[0]?.programmeId ?? "missing";
      return chatResult({ citations: [{ courseId: programmeId, note: "Classroom sampling programme." }, { courseId: "nssta:invented-1-2026-01-01", note: "Invented." }] });
    });

    const response = await new CatalogGuideService(database, chat, { load: loadLive }).ask("a1", "Any upcoming NSSTA programmes on sampling?");

    expect(sent?.nsstaProgrammes?.map((programme) => programme.topic)).toEqual(["Sample Survey Methodology and Estimation"]);
    expect(response.citedProgrammes).toEqual([expect.objectContaining({
      programmeId: "nssta:refresher-training-2-2026-12-14",
      topic: "Sample Survey Methodology and Estimation",
      venue: "NSSTA Greater Noida",
      sourceUrl: CALENDAR_URL,
      note: "Classroom sampling programme.",
    })]);
    expect(response.citedCourses).toEqual([]);
  });

  it("still answers from iGOT data when NSSTA is down", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let sent: PlatformChatRequest | undefined;
    const chat = vi.fn(async (request: PlatformChatRequest) => {
      sent = request;
      return chatResult({ answer: "Here are iGOT courses." });
    });
    const load = vi.fn(async () => { throw new NsstaUnavailableError("NSSTA request failed"); });

    const response = await new CatalogGuideService(database, chat, { load }).ask("a1", "Any NSSTA training on sampling?");

    expect(load).toHaveBeenCalled();
    expect(sent?.nsstaProgrammes).toEqual([]);
    expect(response.answer).toBe("Here are iGOT courses.");
    expect(response.citedProgrammes).toEqual([]);
  });

  it("stops waiting for a slow NSSTA calendar", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const chat = vi.fn(async () => chatResult({ answer: "Answered without NSSTA." }));
    const load: LoadNsstaProgrammes = () => new Promise(() => undefined);

    const response = await new CatalogGuideService(database, chat, { load, timeoutMs: 20 }).ask("a1", "Any NSSTA training on sampling?");

    expect(response.answer).toBe("Answered without NSSTA.");
    expect(response.citedProgrammes).toEqual([]);
  });

  it("cites NSSTA programmes in the grounded fallback when no provider is configured", async () => {
    const ai = createAiAssessmentService({ gemini: createGeminiAdapter({}), groq: createGroqAdapter({}), sleep: async () => undefined, jitterMs: () => 0 });

    const response = await new CatalogGuideService(database, (request: PlatformChatRequest) => ai.chat(request), { load: loadLive })
      .ask("a1", "Any upcoming NSSTA programmes on sampling?");

    expect(response.answer).toContain("Sample Survey Methodology and Estimation");
    expect(response.answer).toContain("nomination");
    expect(response.citedProgrammes.map((programme) => programme.programmeId)).toEqual(["nssta:refresher-training-2-2026-12-14"]);
  });
});
