import type { CatalogGuidePathCourse } from "@/ai";
import type { KaushalDatabase } from "@/db/client";

type Row = Record<string, unknown>;

const STOP_WORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "can", "does", "for", "from", "how", "i", "in", "is", "it",
  "me", "of", "on", "or", "that", "the", "this", "to", "what", "which", "with", "you", "your",
  "address", "courses", "course", "first", "from", "gap", "gaps", "official", "recommend", "recommended", "skill", "skills", "tell", "was", "when", "why",
]);

export type RagCourse = CatalogGuidePathCourse & {
  relevanceScore: number;
  matchedTerms: string[];
};

export type RagContext = {
  /** Top relevant courses from full catalog (not just path) */
  retrievedCourses: RagCourse[];
  /** Path courses enriched with match info */
  pathCourses: CatalogGuidePathCourse[];
  /** Platform knowledge chunks relevant to query */
  platformDocs: Array<{ title: string; content: string; relevance: number }>;
};

const PLATFORM_KNOWLEDGE: Array<{ title: string; content: string; keywords: string[] }> = [
  {
    title: "Kaushal Platform Overview",
    content:
      "Kaushal AI is an evidence-based competency assessment and learning-path platform for public officials. Officials are assessed against competency matrices tied to job roles. Results show gaps, confidence and priority, then the system builds a personalized learning plan from the iGOT Karmayogi catalog (222 courses). Chat is a general platform assistant, not just a recommender.",
    keywords: ["kaushal", "platform", "assessment", "competency", "learning", "officials"],
  },
  {
    title: "Assessment Flow",
    content:
      "Assessment has 4 steps: 01 Baseline (single-choice), 02 Adaptive (personalized), 03 Clarify (short-text for ambiguous evidence), 04 Learning plan. Scores are calculated from answers. Each competency has a 5-level rubric (1 Recognizes basic terms with guidance → 5 Defines standards). Supported flag indicates confidence.",
    keywords: ["assessment", "baseline", "adaptive", "clarify", "round", "rubric", "level", "supported", "confidence", "step"],
  },
  {
    title: "Learning Plan",
    content:
      "Learning plan is ranked by priority gaps (supported first, then priority). It selects courses from catalog by matching competency_course_tags. Marking a course complete adds learning_history and invites reassessment. Completion does not rewrite the assessment result directly.",
    keywords: ["learning", "plan", "priority", "gap", "recommendation", "course", "complete", "reassessment", "history"],
  },
  {
    title: "iGOT Catalog",
    content:
      "Catalog contains 222 courses from iGOT Karmayogi, 25 with detailed descriptions/outcomes/tags. Domains: statistical (statistics, survey design, sampling, data quality...), technical (R, Python, SQL, GIS...), digital_governance (cybersecurity, APIs...), behavioural (leadership, ethics...). Course has title, provider, duration, level, sourceUrl, detailAvailable.",
    keywords: ["catalog", "igot", "course", "provider", "duration", "level", "statistics", "python", "sql", "r", "gis"],
  },
  {
    title: "Roles and Matrices",
    content:
      "Job roles include Statistical Investigator, Senior Statistical Officer, Survey Design Officer, Data Analyst, Industrial Statistics Analyst, Data Quality Officer, etc. Each matrix defines requiredLevel (1-5) and importance per competency.",
    keywords: ["role", "matrix", "job", "required", "importance", "investigator", "officer"],
  },
  {
    title: "Current Time and General Queries",
    content:
      "The assistant does not have live browsing or real-time clock. For time, respond that you don't have live time and suggest checking the device clock, then offer platform help. For off-topic queries, answer helpfully using general knowledge but stay grounded and cite catalog only if relevant.",
    keywords: ["time", "current", "date", "clock"],
  },
  {
    title: "Chat Capabilities",
    content:
      "Chat can explain why a course was recommended (rationale, rank, competency gap), explain gaps, summarize assessment results, describe how assessment works, guide platform usage, and answer general doubts about Kaushal, competencies, and learning. It should not invent courses or scores.",
    keywords: ["chat", "explain", "why", "first", "gap", "recommend", "help", "guide"],
  },
];

function tokens(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length >= 3 && !STOP_WORDS.has(w)) ?? [])];
}

function scoreOverlap(queryTokens: Set<string>, docTokens: string[]): number {
  const documentTerms = new Set(docTokens);
  return [...queryTokens].filter((term) => documentTerms.has(term)).length;
}

function courseCorpusText(course: {
  title: string;
  provider: string;
  competencyName: string;
  rationale: string;
  description?: string;
  learningOutcomes?: string[];
  tags?: string[];
  searchTerms?: string[];
}): string {
  return [
    course.title,
    course.provider,
    course.competencyName,
    course.rationale,
    course.description ?? "",
    ...(course.learningOutcomes ?? []),
    ...(course.tags ?? []),
    ...((course as unknown as { searchTerms?: string[] }).searchTerms ?? []),
  ].join(" ");
}

export function retrieveRagContext(
  database: KaushalDatabase,
  question: string,
  pathCourses: CatalogGuidePathCourse[],
  options?: { limit?: number },
): RagContext {
  const limit = options?.limit ?? 6;
  const qTokens = tokens(question);
  const qSet = new Set(qTokens);
  const qLower = question.toLowerCase();

  // 1) Retrieve from full catalog (all courses, not just path)
  const allRows = database
    .prepare(
      `SELECT c.id, c.title, c.provider, c.duration, c.level, c.source_url, c.detail_available, c.detail_json, c.search_terms_json, c.domains_json,
       (SELECT comp.name FROM course_competencies cc JOIN competencies comp ON comp.id=cc.competency_id WHERE cc.course_id=c.id ORDER BY cc.relevance DESC, comp.name LIMIT 1) competency_name,
       (SELECT comp.id FROM course_competencies cc JOIN competencies comp ON comp.id=cc.competency_id WHERE cc.course_id=c.id ORDER BY cc.relevance DESC, comp.name LIMIT 1) competency_id
       FROM courses c`,
    )
    .all() as Row[];

  // dedup by course id, keep first competency mapping if any
  const byId = new Map<string, Row>();
  for (const r of allRows) {
    const id = String(r.id);
    if (!byId.has(id)) byId.set(id, r);
  }

  const scored: Array<{ row: Row; score: number; matched: string[] }> = [];
  for (const row of byId.values()) {
    const title = String(row.title);
    const provider = String(row.provider ?? "");
    const compName = String(row.competency_name ?? "");
    const detail = (() => {
      try {
        return row.detail_json ? (JSON.parse(String(row.detail_json)) as Record<string, unknown>) : {};
      } catch {
        return {};
      }
    })();
    const description = typeof detail.description === "string" ? detail.description : "";
    const outcomes = Array.isArray(detail.learning_outcomes) ? (detail.learning_outcomes as string[]) : [];
    const tags = Array.isArray(detail.tags) ? (detail.tags as string[]) : [];
    const searchTerms = (() => {
      try {
        return row.search_terms_json ? (JSON.parse(String(row.search_terms_json)) as string[]) : [];
      } catch {
        return [];
      }
    })();
    const corpus = courseCorpusText({
      title,
      provider,
      competencyName: compName,
      rationale: "",
      description,
      learningOutcomes: outcomes,
      tags,
      searchTerms,
    });
    const docTokens = tokens(corpus);
    let score = scoreOverlap(qSet, docTokens);
    // boost exact substring in title
    if (qLower.length >= 3 && title.toLowerCase().includes(qLower)) score += 5;
    // boost if any query token in title
    const titleTokens = new Set(tokens(title));
    for (const qt of qTokens) if (titleTokens.has(qt)) score += 2;
    if (score > 0) {
      // Only boost a course after it has a meaningful query match; detail alone
      // must not make every detailed course a result for a generic question.
      if (row.detail_available === 1) score += 0.1;
      scored.push({ row, score, matched: [...qSet].filter((t) => docTokens.includes(t)) });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit).map(({ row, score, matched }) => {
    const detail = (() => {
      try {
        return row.detail_json ? (JSON.parse(String(row.detail_json)) as Record<string, unknown>) : {};
      } catch {
        return {};
      }
    })();
    const description = typeof detail.description === "string" ? detail.description : undefined;
    const outcomes = Array.isArray(detail.learning_outcomes) ? (detail.learning_outcomes as string[]) : undefined;
    const tags = Array.isArray(detail.tags) ? (detail.tags as string[]) : undefined;
    const course: RagCourse = {
      courseId: String(row.id),
      title: String(row.title),
      provider: String(row.provider ?? ""),
      duration: String(row.duration ?? ""),
      level: String(row.level ?? ""),
      sourceUrl: String(row.source_url),
      evidence: row.detail_available === 1 ? "detailed" : "title",
      // Unmapped catalog courses have no reliable competency. Keep that metadata empty
      // instead of presenting a fabricated competency to the model or learner.
      competencyId: row.competency_id == null ? "" : String(row.competency_id),
      competencyName: row.competency_name == null ? "" : String(row.competency_name),
      rank: 999,
      rationale: `Retrieved for query "${question.slice(0, 80)}"`,
      relevanceScore: score,
      matchedTerms: matched,
    };
    if (description) (course as CatalogGuidePathCourse).description = description;
    if (outcomes) (course as CatalogGuidePathCourse).learningOutcomes = outcomes;
    if (tags) (course as CatalogGuidePathCourse).tags = tags;
    return course;
  });

  // 2) Platform docs retrieval
  const docScored = PLATFORM_KNOWLEDGE.map((doc) => {
    const docTokens = tokens(`${doc.title} ${doc.content} ${doc.keywords.join(" ")}`);
    const score = scoreOverlap(qSet, docTokens) + (qTokens.some((t) => doc.keywords.includes(t)) ? 1 : 0);
    return { doc, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ doc, score }) => ({ title: doc.title, content: doc.content, relevance: score }));

  // fallback: if no docs matched, include overview for general queries
  const platformDocs = docScored.length > 0 ? docScored : [PLATFORM_KNOWLEDGE[0]].map((d) => ({ title: d.title, content: d.content, relevance: 0 }));

  return { retrievedCourses: top, pathCourses, platformDocs };
}
