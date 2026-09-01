import {
  AI_SCHEMA_VERSION,
  CATALOG_GUIDE_EMPTY_PATH_COPY,
  CATALOG_GUIDE_IDENTITY_COPY,
  CATALOG_GUIDE_OUTSIDE_PATH_COPY,
  isCatalogGuideIdentityQuestion,
  createAiAssessmentService,
  createConfiguredProviderAdapters,
  type CatalogGuide,
  type CatalogGuideAiRequest,
  type CatalogGuidePathCourse,
} from "@/ai";
import type { KaushalDatabase } from "@/db/client";

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

export type CatalogGuideResponse = {
  schemaVersion: typeof AI_SCHEMA_VERSION;
  gapSummary: string;
  unavailable: string;
  citedCourses: CatalogGuideCitedCourse[];
  suggestedNext: string[];
};

export type ExplainCatalogGuide = (request: CatalogGuideAiRequest) => Promise<{ data: CatalogGuide }>;

const parse = <T>(value: unknown, fallback: T): T => {
  try { return value ? JSON.parse(String(value)) as T : fallback; } catch { return fallback; }
};

function httpError(message: string, status: number): never {
  throw Object.assign(new Error(message), { status });
}

const PATH_GUIDE_STOPWORDS = new Set([
  "this", "that", "which", "does", "address", "first", "about", "your", "learning", "path",
  "course", "courses", "recommended", "recommend", "gap", "gaps", "skill", "skills", "why",
  "what", "when", "from", "with", "official", "competency", "matrix",
]);

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length >= 4) ?? [];
}

function distinctiveQuestionTokens(question: string): string[] {
  return tokens(question).filter((word) => !PATH_GUIDE_STOPWORDS.has(word));
}

function defaultExplain(): ExplainCatalogGuide {
  const ai = createAiAssessmentService({
    ...createConfiguredProviderAdapters(),
    logger: (event) => console.warn(JSON.stringify(event)),
  });
  return (request) => ai.explainCatalogGuide(request);
}

function text(value: unknown): string {
  return value == null || value === "" ? "" : String(value);
}

function gapSummaryFromResults(results: CatalogGuideAiRequest["results"]): string {
  const names = results.filter((result) => result.gap > 0).map((result) => result.competencyName);
  if (names.length === 0) return CATALOG_GUIDE_EMPTY_PATH_COPY;
  return `Skill gaps in ${names.join(", ")}.`;
}

function suggestedNext(pathCourses: CatalogGuidePathCourse[]): string[] {
  const chips = ["Why is this first?", "Which gap does this address?"];
  const first = pathCourses[0];
  if (first) chips.push(`Why was ${first.title} recommended?`);
  return chips;
}

function courseCorpus(course: CatalogGuidePathCourse): string {
  return [
    course.title,
    course.provider,
    course.competencyName,
    course.rationale,
    course.description ?? "",
    ...(course.tags ?? []),
    ...(course.learningOutcomes ?? []),
  ].join(" ");
}

function highlightPathCourses(question: string, pathCourses: CatalogGuidePathCourse[]): { courses: CatalogGuidePathCourse[]; outsidePath: boolean } {
  const questionTokens = new Set(tokens(question));
  const distinctive = distinctiveQuestionTokens(question);
  const courses = pathCourses.map((course) => {
    const highlighted = questionTokens.size > 0 && tokens(courseCorpus(course)).some((word) => questionTokens.has(word));
    return highlighted ? { ...course, highlighted: true } : { ...course, highlighted: false };
  });
  const corpus = new Set(pathCourses.flatMap((course) => tokens(courseCorpus(course))));
  const outsidePath = distinctive.length > 0 && !distinctive.some((word) => corpus.has(word));
  return { courses, outsidePath };
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
  return (database.prepare(`SELECT r.*,c.name FROM assessment_results r JOIN competencies c ON c.id=r.competency_id
    WHERE r.assessment_id=? ORDER BY r.priority DESC,c.name`).all(assessmentId) as Row[]).map((row) => ({
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
  const rows = database.prepare(`SELECT r.course_id,r.competency_id,r.rank,r.rationale,c.title,c.provider,c.duration,c.level,c.source_url,c.detail_available,c.detail_json,comp.name competency_name
    FROM recommendations r JOIN courses c ON c.id=r.course_id JOIN competencies comp ON comp.id=r.competency_id
    WHERE r.assessment_id=? ORDER BY r.rank LIMIT 8`).all(assessmentId) as Row[];
  return rows.map((row) => {
    const evidence = row.detail_available === 1 ? "detailed" as const : "title" as const;
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

function cardFromPath(course: CatalogGuidePathCourse, note: string): CatalogGuideCitedCourse {
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

function mapCitedCourses(pathCourses: CatalogGuidePathCourse[], notes: CatalogGuide["courseNotes"]): CatalogGuideCitedCourse[] {
  const byId = new Map(pathCourses.map((course) => [course.courseId, course]));
  const cited: CatalogGuideCitedCourse[] = [];
  for (const item of notes) {
    const course = byId.get(item.courseId);
    if (!course) httpError("Catalog guide references a course outside the learning path", 500);
    cited.push(cardFromPath(course, item.note));
  }
  return cited;
}

export class CatalogGuideService {
  constructor(
    private readonly database: KaushalDatabase,
    private readonly explain: ExplainCatalogGuide = defaultExplain(),
  ) {}

  async ask(assessmentId: string, question: string): Promise<CatalogGuideResponse> {
    const trimmed = question.trim();
    if (!trimmed) httpError("Question is required", 400);

    const assessment = this.database.prepare(`SELECT a.*,v.version,m.job_role_id FROM assessments a JOIN matrix_versions v ON v.id=a.matrix_version_id
      JOIN competency_matrices m ON m.id=v.matrix_id WHERE a.id=?`).get(assessmentId) as Row | undefined;
    if (!assessment) httpError("Assessment not found", 404);
    const status = String(assessment.status);
    if (status !== "completed" && status !== "provisional") httpError("Assessment is not finished", 400);

    const results = loadResults(this.database, assessmentId);
    const loaded = loadPathCourses(this.database, assessmentId);
    const chips = suggestedNext(loaded);

    if (isCatalogGuideIdentityQuestion(trimmed)) {
      return {
        schemaVersion: AI_SCHEMA_VERSION,
        gapSummary: CATALOG_GUIDE_IDENTITY_COPY,
        unavailable: "",
        citedCourses: [],
        suggestedNext: chips,
      };
    }

    if (loaded.length === 0) {
      return {
        schemaVersion: AI_SCHEMA_VERSION,
        gapSummary: gapSummaryFromResults(results),
        unavailable: CATALOG_GUIDE_EMPTY_PATH_COPY,
        citedCourses: [],
        suggestedNext: chips,
      };
    }

    const { courses: pathCourses, outsidePath } = highlightPathCourses(trimmed, loaded);
    const explained = await this.explain({
      assessmentSessionId: assessmentId,
      matrixVersionId: String(assessment.matrix_version_id),
      question: trimmed,
      results,
      pathCourses,
    });
    const data = explained.data;

    if (outsidePath) {
      return {
        schemaVersion: AI_SCHEMA_VERSION,
        gapSummary: data.gapSummary || gapSummaryFromResults(results),
        unavailable: CATALOG_GUIDE_OUTSIDE_PATH_COPY,
        citedCourses: [],
        suggestedNext: chips,
      };
    }

    const citedCourses = mapCitedCourses(pathCourses, data.courseNotes);
    return {
      schemaVersion: AI_SCHEMA_VERSION,
      gapSummary: data.gapSummary,
      unavailable: citedCourses.length === 0 && data.unavailable.trim() ? CATALOG_GUIDE_OUTSIDE_PATH_COPY : "",
      citedCourses,
      suggestedNext: chips,
    };
  }
}
