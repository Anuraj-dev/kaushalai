import {
  AI_SCHEMA_VERSION,
  type CatalogGuide,
  type CatalogGuideAiRequest,
  type CatalogGuideNsstaProgramme,
  type CatalogGuidePathCourse,
  type PlatformChat,
  type PlatformChatRequest,
  createAiAssessmentService,
  createConfiguredProviderAdapters,
} from "@/ai";
import type { KaushalDatabase } from "@/db/client";
import { NSSTA_SITE_URL, cadreForRole, type NsstaProgramme } from "./nssta";
import { retrieveNsstaProgrammes } from "./nssta-retriever";
import { retrieveRagContext } from "./rag-retriever";

type Row = Record<string, unknown>;

export type CatalogGuideCitedCourse = {
  courseId: string;
  title: string;
  provider: string;
  duration: string;
  level: string;
  sourceUrl: string;
  evidence: "title" | "detailed";
  competencyId: string;
  competencyName: string;
  rank: number;
  note: string;
};

/** An NSSTA programme the answer cites; `sourceUrl` is the published calendar, since seats are by nomination. */
export type CatalogGuideCitedProgramme = CatalogGuideNsstaProgramme & { sourceUrl: string; note: string };

export type CatalogGuideResponse = {
  schemaVersion: typeof AI_SCHEMA_VERSION;
  answer: string;
  gapSummary: string;
  unavailable: string;
  citedCourses: CatalogGuideCitedCourse[];
  citedProgrammes: CatalogGuideCitedProgramme[];
  suggestedNext: string[];
};

/** Upcoming NSSTA programmes and the calendar they come from. May be slow or fail. */
export type LoadNsstaProgrammes = () => Promise<{ programmes: NsstaProgramme[]; calendarUrl: string }>;
export type CatalogGuideNsstaSource = { load: LoadNsstaProgrammes; timeoutMs?: number };

// A cold calendar fetch downloads and parses a PDF; the chat answers from iGOT data rather than wait longer.
const NSSTA_TIMEOUT_MS = 4000;

export type ExplainCatalogGuide = (request: CatalogGuideAiRequest) => Promise<{ data: CatalogGuide }>;
export type ChatWithRag = (request: PlatformChatRequest) => Promise<{ data: PlatformChat }>;

const parse = <T>(value: unknown, fallback: T): T => {
  try {
    return value ? (JSON.parse(String(value)) as T) : fallback;
  } catch {
    return fallback;
  }
};

function httpError(message: string, status: number): never {
  throw Object.assign(new Error(message), { status });
}

function defaultChat(): ChatWithRag {
  const ai = createAiAssessmentService({
    ...createConfiguredProviderAdapters(),
    logger: (event) => console.warn(JSON.stringify(event)),
  });
  return (request) => ai.chat(request);
}

function text(value: unknown): string {
  return value == null || value === "" ? "" : String(value);
}

function gapSummaryFromResults(results: CatalogGuideAiRequest["results"], assessmentStatus?: string): string {
  if (results.length === 0 && assessmentStatus !== undefined && !["completed", "provisional"].includes(assessmentStatus)) {
    return "Your assessment is still in progress. Skill-gap results will be available after scoring.";
  }
  const names = results.filter((result) => result.gap > 0).map((result) => result.competencyName);
  if (names.length === 0) return "No current skill gaps on the assessed competencies.";
  return `Skill gaps in ${names.join(", ")}.`;
}

function suggestedNext(pathCourses: CatalogGuidePathCourse[], ragCourses: CatalogGuidePathCourse[]): string[] {
  const chips = ["How does the assessment work?", "Explain my gaps", "How is the learning plan built?"];
  // Keep one path-specific chip if path exists, but never empty-path loop
  const first = pathCourses[0] ?? ragCourses[0];
  if (first) chips.push(`Why was ${first.title} recommended?`);
  return chips.slice(0, 4);
}

function parseDetailedFields(detailJson: unknown): Pick<CatalogGuidePathCourse, "description" | "learningOutcomes" | "tags"> {
  const detail = parse<Record<string, unknown>>(detailJson, {});
  const fields: Pick<CatalogGuidePathCourse, "description" | "learningOutcomes" | "tags"> = {};
  if (typeof detail.description === "string") fields.description = detail.description;
  if (Array.isArray(detail.learning_outcomes)) fields.learningOutcomes = detail.learning_outcomes.map(String);
  if (Array.isArray(detail.tags)) fields.tags = detail.tags.map(String);
  return fields;
}

function loadResults(database: KaushalDatabase, assessmentId: string): CatalogGuideAiRequest["results"] {
  return (
    database
      .prepare(
        `SELECT r.*,c.name FROM assessment_results r JOIN competencies c ON c.id=r.competency_id
    WHERE r.assessment_id=? ORDER BY r.priority DESC,c.name`,
      )
      .all(assessmentId) as Row[]
  ).map((row) => ({
    competencyId: String(row.competency_id),
    competencyName: String(row.name),
    assessedLevel: Number(row.assessed_level),
    requiredLevel: Number(row.required_level),
    gap: Number(row.gap),
    priority: Number(row.priority),
    confidence: Number(row.confidence),
    supported: row.supported === 1,
  }));
}

function loadPathCourses(database: KaushalDatabase, assessmentId: string): CatalogGuidePathCourse[] {
  const rows = database
    .prepare(
      `SELECT r.course_id,r.competency_id,r.rank,r.rationale,c.title,c.provider,c.duration,c.level,c.source_url,c.detail_available,c.detail_json,comp.name competency_name
    FROM recommendations r JOIN courses c ON c.id=r.course_id JOIN competencies comp ON comp.id=r.competency_id
    WHERE r.assessment_id=? ORDER BY r.rank LIMIT 8`,
    )
    .all(assessmentId) as Row[];
  return rows.map((row) => {
    const evidence = row.detail_available === 1 ? ("detailed" as const) : ("title" as const);
    const course: CatalogGuidePathCourse = {
      courseId: String(row.course_id),
      title: String(row.title),
      provider: text(row.provider),
      duration: text(row.duration),
      level: text(row.level),
      sourceUrl: String(row.source_url),
      evidence,
      competencyId: String(row.competency_id),
      competencyName: String(row.competency_name),
      rank: Number(row.rank),
      rationale: String(row.rationale),
    };
    if (evidence === "detailed") Object.assign(course, parseDetailedFields(row.detail_json));
    return course;
  });
}

function cardFromContext(course: CatalogGuidePathCourse, note: string): CatalogGuideCitedCourse {
  return {
    courseId: course.courseId,
    title: course.title,
    provider: course.provider,
    duration: course.duration,
    level: course.level,
    sourceUrl: course.sourceUrl,
    evidence: course.evidence,
    competencyId: course.competencyId,
    competencyName: course.competencyName,
    rank: course.rank,
    note,
  };
}

function mapCitedCourses(
  allCourses: CatalogGuidePathCourse[],
  citations: Array<{ courseId: string; note: string }>,
): CatalogGuideCitedCourse[] {
  const byId = new Map(allCourses.map((course) => [course.courseId, course]));
  const cited: CatalogGuideCitedCourse[] = [];
  for (const item of citations) {
    const course = byId.get(item.courseId);
    if (!course) {
      // Do not throw - RAG citations may be filtered, just skip unknown
      continue;
    }
    cited.push(cardFromContext(course, item.note));
  }
  return cited;
}

function mapCitedProgrammes(
  programmes: CatalogGuideNsstaProgramme[],
  citations: Array<{ courseId: string; note: string }>,
  sourceUrl: string,
): CatalogGuideCitedProgramme[] {
  const byId = new Map(programmes.map((programme) => [programme.programmeId, programme]));
  return citations.flatMap((item) => {
    const programme = byId.get(item.courseId);
    return programme ? [{ ...programme, sourceUrl, note: item.note }] : [];
  });
}

async function withinTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`NSSTA did not respond within ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export class CatalogGuideService {
  /** Without an NSSTA source the guide answers from iGOT data and platform docs only. */
  constructor(
    private readonly database: KaushalDatabase,
    private readonly handler: ChatWithRag | ExplainCatalogGuide = defaultChat(),
    private readonly nssta?: CatalogGuideNsstaSource,
  ) {}

  /** NSSTA programmes for the question; empty when NSSTA is unconfigured, slow, or down. */
  private async nsstaContext(assessmentId: string, question: string, results: CatalogGuideAiRequest["results"]) {
    const none = { programmes: [] as CatalogGuideNsstaProgramme[], sourceUrl: NSSTA_SITE_URL };
    if (!this.nssta) return none;
    try {
      const { programmes, calendarUrl } = await withinTimeout(this.nssta.load(), this.nssta.timeoutMs ?? NSSTA_TIMEOUT_MS);
      const role = this.database
        .prepare("SELECT jr.name FROM assessments a JOIN officials o ON o.id=a.official_id JOIN job_roles jr ON jr.id=o.job_role_id WHERE a.id=?")
        .get(assessmentId) as Row | undefined;
      const gapCompetencies = results
        .filter((result) => result.gap > 0)
        .sort((a, b) => b.priority - a.priority || b.gap - a.gap)
        .map((result) => result.competencyName);
      return {
        programmes: retrieveNsstaProgrammes(programmes, question, { gapCompetencies, cadre: cadreForRole(text(role?.name)) }),
        sourceUrl: calendarUrl,
      };
    } catch (cause) {
      console.warn(`[learner/guide] answering without NSSTA: ${cause instanceof Error ? cause.message : String(cause)}`);
      return none;
    }
  }

  async ask(assessmentId: string, question: string): Promise<CatalogGuideResponse> {
    const trimmed = question.trim();
    if (!trimmed) httpError("Question is required", 400);
    if (trimmed.length > 2000) httpError("Question is too long", 400);

    const assessment = this.database
      .prepare(
        `SELECT a.*,v.version,m.job_role_id FROM assessments a JOIN matrix_versions v ON v.id=a.matrix_version_id
      JOIN competency_matrices m ON m.id=v.matrix_id WHERE a.id=?`,
      )
      .get(assessmentId) as Row | undefined;
    if (!assessment) httpError("Assessment not found", 404);
    // General chatbot: do not block on assessment status. Allow any status for platform queries.
    // Keep results/path even if not completed - gaps may be empty.

    const results = loadResults(this.database, assessmentId);
    const loaded = loadPathCourses(this.database, assessmentId);
    const assessmentStatus = text(assessment.status);
    const nssta = await this.nsstaContext(assessmentId, trimmed, results);

    // RAG retrieval: full catalog + platform docs, always
    const rag = retrieveRagContext(this.database, trimmed, loaded);

    const allContextCourses = [...loaded, ...rag.retrievedCourses];
    // Dedup by courseId, keep pathCourses first
    const dedup = new Map<string, CatalogGuidePathCourse>();
    for (const c of allContextCourses) if (!dedup.has(c.courseId)) dedup.set(c.courseId, c);
    const distinctAll = [...dedup.values()];

    const chips = suggestedNext(loaded, rag.retrievedCourses);
    const gapSummary = gapSummaryFromResults(results, assessmentStatus);

    const request: PlatformChatRequest = {
      assessmentSessionId: assessmentId,
      matrixVersionId: String(assessment.matrix_version_id),
      assessmentStatus,
      question: trimmed,
      results,
      pathCourses: loaded,
      ragCourses: rag.retrievedCourses,
      platformDocs: rag.platformDocs.map((d) => ({ title: d.title, content: d.content })),
      nsstaProgrammes: nssta.programmes,
    };

    // Support both legacy ExplainCatalogGuide and new ChatWithRag injected via constructor
    // Try calling handler as Chat, adapt if result is legacy CatalogGuide shape
    let explained: { data: PlatformChat };
    const handler = this.handler as ChatWithRag;
    const raw = await (handler as unknown as (req: PlatformChatRequest) => Promise<{ data: unknown }>)(request);
    // Detect legacy CatalogGuide shape (has gapSummary/courseNotes but no answer)
    if (raw && typeof raw === "object" && "data" in raw && raw.data && typeof (raw.data as Record<string, unknown>).answer !== "string") {
      const legacy = raw as { data: CatalogGuide };
      // Adapt legacy CatalogGuide -> PlatformChat
      explained = {
        data: {
          schemaVersion: AI_SCHEMA_VERSION,
          answer: legacy.data.gapSummary || legacy.data.unavailable || legacy.data.courseNotes.map((n) => n.note).join(" ") || gapSummary,
          citations: legacy.data.courseNotes,
          gapSummary: legacy.data.gapSummary,
          courseNotes: legacy.data.courseNotes,
          unavailable: legacy.data.unavailable,
        } as PlatformChat,
      };
    } else {
      explained = raw as { data: PlatformChat };
    }
    const data = explained.data;

    // Always LLM-shaped response: answer from LLM, citations optional
    const answer = data.answer?.trim() ? data.answer.trim() : data.gapSummary?.trim() ? data.gapSummary.trim() : gapSummary;
    // Prefer citations, fallback to courseNotes for backward compat
    const rawCitations = data.citations?.length ? data.citations : (data.courseNotes ?? []);
    const citedCourses = mapCitedCourses(distinctAll, rawCitations);
    const citedProgrammes = mapCitedProgrammes(nssta.programmes, rawCitations, nssta.sourceUrl);

    return {
      schemaVersion: AI_SCHEMA_VERSION,
      answer,
      gapSummary: data.gapSummary?.trim() ? data.gapSummary.trim() : gapSummary,
      unavailable: data.unavailable ?? "",
      citedCourses,
      citedProgrammes,
      suggestedNext: chips,
    };
  }
}
