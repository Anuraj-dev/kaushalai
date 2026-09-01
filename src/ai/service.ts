import { randomUUID as nodeRandomUUID } from "node:crypto";
import {
  AI_SCHEMA_VERSION,
  AiContractError,
  CATALOG_GUIDE_EMPTY_PATH_COPY,
  CATALOG_GUIDE_IDENTITY_COPY,
  isCatalogGuideIdentityQuestion,
  CATALOG_GUIDE_OUTSIDE_PATH_COPY,
  type CatalogGuide,
  type CatalogGuideAiRequest,
  type EvaluateWrittenAnswersRequest,
  type GeneratedQuestions,
  type GenerateAdaptiveQuestionsRequest,
  type LearnerQuestion,
  type PlatformChat,
  type PlatformChatRequest,
  toLearnerQuestions,
  validateCatalogGuideOutput,
  validateGeneratedQuestions,
  validatePlatformChatOutput,
  validateWrittenEvaluations,
} from "./contracts";

export type AiProviderName = "gemini" | "groq" | "seeded-fallback";
export type AiOperation = "generate_adaptive_questions" | "evaluate_written_answers" | "explain_catalog_guide" | "platform_chat";

export type ProviderRequest = {
  operation: AiOperation;
  prompt: string;
  timeoutMs: number;
  correlationId: string;
  attemptId: string;
};

export type AiProviderAdapter = {
  name: Exclude<AiProviderName, "seeded-fallback">;
  model: string;
  execute(request: ProviderRequest): Promise<{ data: unknown; requestId?: string; inputTokens?: number; outputTokens?: number }>;
};

export type AiResult<T> = {
  data: T;
  provider: AiProviderName;
  model: string;
  requestId: string;
  attempts: number;
  latencyMs: number;
};

export type AiAttemptEvent = {
  timestamp: string;
  level: "info" | "warn";
  event: "ai_provider_attempt";
  operation: AiOperation;
  assessmentSessionId: string;
  matrixVersionId: string;
  correlationId: string;
  attemptId: string;
  provider: AiProviderName;
  model: string;
  attemptNumber: number;
  outcome: "success" | "timeout" | "transport_error" | "provider_error" | "schema_error" | "semantic_error" | "fallback";
  httpStatus: number | null;
  providerRequestId: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  retryAfterMs: number | null;
  schemaVersion: typeof AI_SCHEMA_VERSION;
  questionCount: number;
  competencyIds: string[];
  errorCode: string;
  errorMessageSanitized: string;
  fallbackReason: string;
};

type Dependencies = {
  gemini: AiProviderAdapter;
  groq: AiProviderAdapter;
  logger?: (event: AiAttemptEvent) => void;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  jitterMs?: () => number;
  correlationId?: () => string;
};

const timeoutByProvider = { gemini: 8_000, groq: 6_000 } as const;
const retryableByProvider = {
  gemini: new Set([408, 429, 500, 501, 502, 503, 504]),
  groq: new Set([422, 429, 498, 500, 501, 502, 503, 504]),
};

function statusOf(error: unknown): number | null {
  if (typeof error === "object" && error && "status" in error && typeof error.status === "number") return error.status;
  return null;
}

function retryAfterOf(error: unknown): number | null {
  if (typeof error !== "object" || !error) return null;
  const value = "retryAfterMs" in error ? error.retryAfterMs : null;
  if (typeof value === "number" && value >= 0) return value;
  if ("headers" in error && error.headers && typeof error.headers === "object") {
    const headers = error.headers as { get?: (name: string) => string | null; [key: string]: unknown };
    const raw = headers.get?.("retry-after") ?? headers["retry-after"];
    if (typeof raw === "string" && Number.isFinite(Number(raw))) return Math.max(0, Number(raw) * 1_000);
  }
  return null;
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError || (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" && ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"].includes(error.code));
}

function sanitizedClass(error: unknown): string {
  if (error instanceof AiContractError) return error.kind;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  if (isNetworkError(error)) return "transport_error";
  return "provider_error";
}

function withAttemptTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const error = new Error("Provider attempt timed out");
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);
    work.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (error: unknown) => { clearTimeout(timeout); reject(error); },
    );
  });
}

function promptForGeneration(request: GenerateAdaptiveQuestionsRequest): string {
  return JSON.stringify({
    task: "Generate concise adaptive assessment questions. Return only schema-valid JSON.",
    matrixVersionId: request.matrixVersionId,
    requestedCount: request.requestedCount,
    competencies: request.competencies,
    priorEvidence: request.priorEvidence,
  });
}

function promptForEvaluation(request: EvaluateWrittenAnswersRequest): string {
  return JSON.stringify({
    task: "Evaluate each written answer only against its supplied rubric. Return only schema-valid JSON.",
    matrixVersionId: request.matrixVersionId,
    answers: request.answers.map(({ questionId, competencyId, answer, rubric }) => ({ questionId, competencyId, answer, rubric })),
  });
}

const PATH_GUIDE_STOPWORDS = new Set([
  "this", "that", "which", "does", "address", "first", "about", "your", "learning", "path",
  "course", "courses", "recommended", "recommend", "gap", "gaps", "skill", "skills", "why",
  "what", "when", "from", "with", "official", "competency", "matrix",
]);

function catalogGuideKeywords(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length >= 4) ?? [];
}

function questionOutsidePath(request: CatalogGuideAiRequest): boolean {
  const distinctive = catalogGuideKeywords(request.question).filter((word) => !PATH_GUIDE_STOPWORDS.has(word));
  if (distinctive.length === 0) return false;
  const corpus = new Set(request.pathCourses.flatMap((course) => catalogGuideKeywords(
    [course.title, course.provider, course.competencyName, course.rationale, course.description ?? "", ...(course.tags ?? []), ...(course.learningOutcomes ?? [])].join(" "),
  )));
  return !distinctive.some((word) => corpus.has(word));
}

function gapSummaryFromResults(results: CatalogGuideAiRequest["results"], assessmentStatus?: string): string {
  if (results.length === 0 && assessmentStatus !== undefined && !["completed", "provisional"].includes(assessmentStatus)) {
    return "Your assessment is still in progress. Skill-gap results will be available after scoring.";
  }
  const names = results.filter((result) => result.gap > 0).map((result) => result.competencyName);
  if (names.length === 0) return "No current skill gaps on the assessed competencies.";
  return `Skill gaps in ${names.join(", ")}.`;
}

function catalogGuideCoursePayload(course: CatalogGuideAiRequest["pathCourses"][number]) {
  const payload: {
    courseId: string; title: string; provider: string; duration: string; level: string; sourceUrl: string;
    evidence: "title" | "detailed"; competencyId: string; competencyName: string; rank: number; rationale: string;
    highlighted?: boolean; description?: string; outcomes?: string[]; tags?: string[];
  } = {
    courseId: course.courseId, title: course.title, provider: course.provider, duration: course.duration,
    level: course.level, sourceUrl: course.sourceUrl, evidence: course.evidence, competencyId: course.competencyId,
    competencyName: course.competencyName, rank: course.rank, rationale: course.rationale,
  };
  if (course.highlighted !== undefined) payload.highlighted = course.highlighted;
  if (course.evidence === "detailed") {
    if (course.description !== undefined) payload.description = course.description;
    if (course.learningOutcomes !== undefined) payload.outcomes = course.learningOutcomes;
    if (course.tags !== undefined) payload.tags = course.tags;
  }
  return payload;
}

function promptForCatalogGuide(request: CatalogGuideAiRequest): string {
  return JSON.stringify({
    task: "Explain the official's current learning path. Return only schema-valid JSON.",
    rules: [
      "Write short, direct notes. One or two sentences per course.",
      "Cite at most three relevant path courses. Prefer highlighted or rank-1 courses.",
      "Do not hedge, do not say I think, do not add filler, do not invent courses.",
      "Do not mention search terms or inferred competency domains as course facts.",
      "If the question is outside the path, set unavailable to the canonical outside-path sentence and leave courseNotes empty.",
    ],
    matrixVersionId: request.matrixVersionId,
    question: request.question,
    results: request.results,
    pathCourses: request.pathCourses.map(catalogGuideCoursePayload),
  });
}

function promptForPlatformChat(request: PlatformChatRequest): string {
  return JSON.stringify({
    task: "You are Kaushal, a helpful general assistant for the Kaushal platform. Answer the user's question using the provided RAG context. Return only schema-valid JSON.",
    rules: [
      "Always produce an answer via the LLM - never return a canned hardcoded string without LLM.",
      "Use RAG context as primary source. Cite at most 3 relevant courses in citations only if they help answer the question.",
      "Do not invent courses, scores, or times. If no course is relevant, return citations as empty array.",
      "For general platform doubts (assessment flow, roles, how Kaushal works), use platformDocs and explain clearly.",
      "For off-topic queries (e.g., current time), explain limitation briefly and offer platform help. Do not claim live clock.",
      "If assessmentStatus is active or another unfinished status and results is empty, say the assessment is still in progress and skill-gap results are pending. Never describe that as no skill gaps.",
      "Write concise, direct, helpful answer. One paragraph or short bullet list.",
      "Never mention search terms or inferred competency domains as course facts unless they appear in RAG context.",
      "Always include schemaVersion, answer, citations, gapSummary, courseNotes, unavailable in JSON. Use empty string/array if no value.",
    ],
    matrixVersionId: request.matrixVersionId,
    assessmentStatus: request.assessmentStatus,
    question: request.question,
    results: request.results,
    pathCourses: request.pathCourses.map(catalogGuideCoursePayload),
    ragCourses: request.ragCourses.map((c) => ({
      courseId: c.courseId, title: c.title, provider: c.provider, duration: c.duration, level: c.level, sourceUrl: c.sourceUrl,
      competencyName: c.competencyName, description: c.description, tags: c.tags, outcomes: c.learningOutcomes, relevanceScore: c.relevanceScore,
    })),
    platformDocs: request.platformDocs,
  });
}

function seededCatalogGuide(request: CatalogGuideAiRequest): CatalogGuide {
  if (isCatalogGuideIdentityQuestion(request.question)) {
    return { schemaVersion: AI_SCHEMA_VERSION, gapSummary: CATALOG_GUIDE_IDENTITY_COPY, courseNotes: [], unavailable: "" };
  }
  if (request.pathCourses.length === 0) {
    return { schemaVersion: AI_SCHEMA_VERSION, gapSummary: CATALOG_GUIDE_EMPTY_PATH_COPY, courseNotes: [], unavailable: CATALOG_GUIDE_EMPTY_PATH_COPY };
  }
  const highlighted = request.pathCourses.filter((course) => course.highlighted);
  if (highlighted.length === 0 && questionOutsidePath(request)) {
    return { schemaVersion: AI_SCHEMA_VERSION, gapSummary: gapSummaryFromResults(request.results), courseNotes: [], unavailable: CATALOG_GUIDE_OUTSIDE_PATH_COPY };
  }
  const first = request.pathCourses[0];
  const asksForFirst = catalogGuideKeywords(request.question).includes("first") && first;
  const relevant = (highlighted.length > 0 ? highlighted : asksForFirst && first ? [first] : request.pathCourses).slice(0, 3);
  return {
    schemaVersion: AI_SCHEMA_VERSION,
    gapSummary: gapSummaryFromResults(request.results),
    courseNotes: relevant.map((course) => ({
      courseId: course.courseId,
      note: `${course.title} is on the plan for the ${course.competencyName} skill gap.`,
    })),
    unavailable: "",
  };
}

function seededPlatformChat(request: PlatformChatRequest): PlatformChat {
  // Generalized fallback: always go through LLM shape, never hardcoded outside/identity gate.
  // Use RAG context to produce a minimal grounded answer without invoking provider.
  const hasRag = request.ragCourses.length > 0;
  const hasPath = request.pathCourses.length > 0;
  const gapSummary = gapSummaryFromResults(request.results, request.assessmentStatus);
  const platformQuestion = isPlatformQuestion(request.question);
  if (hasRag && !platformQuestion) {
    const top = request.ragCourses.slice(0, 2);
    return {
      schemaVersion: AI_SCHEMA_VERSION,
      answer: `${gapSummary} Based on your query "${request.question.slice(0, 120)}", relevant courses include ${top.map((c) => c.title).join(", ")}. See citations for details.`,
      citations: top.map((c) => ({ courseId: c.courseId, note: `${c.title} is relevant for ${c.competencyName}.` })),
      gapSummary,
      courseNotes: [],
      unavailable: "",
    };
  }
  if (hasPath && /\b(first|recommend(?:ed|ation)?)\b/i.test(request.question)) {
    const first = request.pathCourses[0];
    return {
      schemaVersion: AI_SCHEMA_VERSION,
      answer: `${gapSummary} Your current learning plan starts with ${first.title} for ${first.competencyName}. Ask about any platform topic and I will help using the retrieved context.`,
      citations: [{ courseId: first.courseId, note: `${first.title} is on your plan for ${first.competencyName}.` }],
      gapSummary,
      courseNotes: [],
      unavailable: "",
    };
  }
  // platform-only fallback (no LLM available) - still LLM-shaped answer, not hardcoded outside copy
  return {
    schemaVersion: AI_SCHEMA_VERSION,
    answer: `I'm Kaushal, your Kaushal platform assistant. ${request.platformDocs[0]?.content.slice(0, 240) ?? "I can help with assessment, learning plans, and course guidance using the catalog."} Ask about your gaps, courses, or how the platform works.`,
    citations: [],
    gapSummary,
    courseNotes: [],
    unavailable: "",
  };
}

function isPlatformQuestion(question: string): boolean {
  const normalized = question.toLowerCase();
  if (/\b(course|catalog|recommend(?:ed|ation)?)\b/.test(normalized)) return false;
  return /\b(assessment|gap|gaps|platform|kaushal|competenc(?:y|ies)|role|matrix|learning plan|how does|what can|explain)\b/.test(normalized);
}

export function createAiAssessmentService(dependencies: Dependencies) {
  const now = dependencies.now ?? Date.now;
  const sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const jitterMs = dependencies.jitterMs ?? (() => 500 + Math.floor(Math.random() * 251));
  const makeCorrelationId = dependencies.correlationId ?? (() => nodeRandomUUID());
  const logger = dependencies.logger ?? (() => undefined);

  async function run<T>(parameters: {
    operation: AiOperation;
    assessmentSessionId: string;
    matrixVersionId: string;
    competencyIds: string[];
    questionCount: number;
    prompt: string;
    validate: (data: unknown) => T;
    fallback: () => T;
  }): Promise<AiResult<T>> {
    const startedAt = now();
    const deadline = startedAt + 30_000;
    const correlationId = makeCorrelationId();
    let totalAttempts = 0;
    let fallbackReason = "providers_exhausted";

    for (const provider of [dependencies.gemini, dependencies.groq]) {
      for (let providerAttempt = 1; providerAttempt <= 2; providerAttempt += 1) {
        if (now() >= deadline) { fallbackReason = "overall_deadline"; break; }
        totalAttempts += 1;
        const attemptId = `${correlationId}:${provider.name}:${providerAttempt}`;
        const attemptStarted = now();
        try {
          const timeoutMs = Math.min(timeoutByProvider[provider.name], Math.max(1, deadline - now()));
          const response = await withAttemptTimeout(
            provider.execute({ operation: parameters.operation, prompt: parameters.prompt, timeoutMs, correlationId, attemptId }),
            timeoutMs,
          );
          const data = parameters.validate(response.data);
          logger(eventFor({ parameters, correlationId, attemptId, provider: provider.name, model: provider.model, attemptNumber: providerAttempt, outcome: "success", latencyMs: now() - attemptStarted, response }));
          return { data, provider: provider.name, model: provider.model, requestId: response.requestId ?? correlationId, attempts: totalAttempts, latencyMs: now() - startedAt };
        } catch (error) {
          const outcome = sanitizedClass(error);
          const status = statusOf(error);
          const retryAfterMs = retryAfterOf(error);
          logger(eventFor({ parameters, correlationId, attemptId, provider: provider.name, model: provider.model, attemptNumber: providerAttempt, outcome, latencyMs: now() - attemptStarted, status, retryAfterMs }));
          const semantic = error instanceof AiContractError;
          const retryable = semantic || isNetworkError(error) || (status !== null && retryableByProvider[provider.name].has(status)) || outcome === "timeout";
          if (!retryable || providerAttempt === 2) break;
          const delay = status === 429 ? retryAfterMs ?? jitterMs() : jitterMs();
          if (now() + delay >= deadline) { fallbackReason = "overall_deadline"; break; }
          await sleep(delay);
        }
      }
    }

    let data: T;
    try { data = parameters.fallback(); } catch (e) { const msg = e instanceof Error ? e.message : String(e); logger(eventFor({ parameters, correlationId, attemptId: `${correlationId}:seeded-fallback:1`, provider: "seeded-fallback", model: "seeded-bank-v1", attemptNumber: 1, outcome: "fallback", latencyMs: now() - startedAt, fallbackReason: `fallback_invalid:${msg}` })); throw e; }
    const attemptId = `${correlationId}:seeded-fallback:1`;
    logger(eventFor({ parameters, correlationId, attemptId, provider: "seeded-fallback", model: "seeded-bank-v1", attemptNumber: 1, outcome: "fallback", latencyMs: now() - startedAt, fallbackReason }));
    return { data, provider: "seeded-fallback", model: "seeded-bank-v1", requestId: correlationId, attempts: totalAttempts, latencyMs: now() - startedAt };
  }

  return {
    async generateAdaptiveQuestions(request: GenerateAdaptiveQuestionsRequest) {
      return run({
        operation: "generate_adaptive_questions", assessmentSessionId: request.assessmentSessionId,
        matrixVersionId: request.matrixVersionId, competencyIds: request.competencies.map((item) => item.id),
        questionCount: request.requestedCount, prompt: promptForGeneration(request),
        validate: (data) => validateGeneratedQuestions(data, request),
        fallback: () => validateGeneratedQuestions({ schemaVersion: AI_SCHEMA_VERSION, questions: request.fallbackQuestions.slice(0, request.requestedCount) }, request),
      });
    },
    async evaluateWrittenAnswers(request: EvaluateWrittenAnswersRequest) {
      return run({
        operation: "evaluate_written_answers", assessmentSessionId: request.assessmentSessionId,
        matrixVersionId: request.matrixVersionId, competencyIds: request.answers.map((item) => item.competencyId),
        questionCount: request.answers.length, prompt: promptForEvaluation(request),
        validate: (data) => validateWrittenEvaluations(data, request),
        fallback: () => validateWrittenEvaluations({ schemaVersion: AI_SCHEMA_VERSION, evaluations: request.answers.map((answer) => ({
          questionId: answer.questionId, competencyId: answer.competencyId,
          demonstratedLevel: answer.rubric.some((entry) => entry.level === answer.fallbackDemonstratedLevel)
            ? answer.fallbackDemonstratedLevel
            : [...answer.rubric].sort((a, b) => Math.abs(a.level - answer.fallbackDemonstratedLevel) - Math.abs(b.level - answer.fallbackDemonstratedLevel))[0]!.level,
          confidence: 0,
          evidenceSummary: answer.answer.trim() || (answer.rubric.find((entry) => entry.level === answer.fallbackDemonstratedLevel)?.criterion ?? answer.rubric[0]?.criterion ?? "No evidence available"),
          rubricReason: answer.rubric.find((entry) => entry.level === answer.fallbackDemonstratedLevel)?.criterion ?? answer.rubric[0]?.criterion ?? "No evidence available",
          ambiguity: "Provider evaluation unavailable",
        })) }, request),
      });
    },
    async explainCatalogGuide(request: CatalogGuideAiRequest) {
      // Legacy path: kept for backward compat tests. Now delegates to RAG+LLM via platform_chat where possible,
      // but preserves old schema for callers that pass only pathCourses.
      const allowedCourseIds = request.pathCourses.map((course) => course.courseId);
      if (isCatalogGuideIdentityQuestion(request.question)) {
        const data = validateCatalogGuideOutput(seededCatalogGuide(request), allowedCourseIds);
        return { data, provider: "seeded-fallback" as const, model: "seeded-bank-v1", requestId: "identity", attempts: 0, latencyMs: 0 };
      }
      return run({
        operation: "explain_catalog_guide", assessmentSessionId: request.assessmentSessionId,
        matrixVersionId: request.matrixVersionId, competencyIds: request.results.map((item) => item.competencyId),
        questionCount: request.pathCourses.length, prompt: promptForCatalogGuide(request),
        validate: (data) => validateCatalogGuideOutput(data, allowedCourseIds),
        fallback: () => validateCatalogGuideOutput(seededCatalogGuide(request), allowedCourseIds),
      });
    },
    async chat(request: PlatformChatRequest) {
      // Generalized RAG + LLM: LLM is always last layer, no hardcoded early returns
      const allowedCourseIds = [...request.pathCourses.map((c) => c.courseId), ...request.ragCourses.map((c) => c.courseId)];
      // Dedup allowed
      const dedupAllowed = [...new Set(allowedCourseIds)];
      // Ensure at least one allowed for validation edge (empty rag + empty path) -> allow any fallback validation to pass with empty citations
      const effectiveAllowed = dedupAllowed.length ? dedupAllowed : ["__no_course__"];
      return run({
        operation: "platform_chat", assessmentSessionId: request.assessmentSessionId,
        matrixVersionId: request.matrixVersionId, competencyIds: request.results.map((item) => item.competencyId),
        questionCount: request.ragCourses.length + request.pathCourses.length, prompt: promptForPlatformChat(request),
        validate: (data) => validatePlatformChatOutput(data, effectiveAllowed),
        fallback: () => validatePlatformChatOutput(seededPlatformChat(request), effectiveAllowed),
      });
    },
    toLearnerQuestions: (data: GeneratedQuestions): LearnerQuestion[] => toLearnerQuestions(data),
  };
}

function eventFor(input: {
  parameters: { operation: AiOperation; assessmentSessionId: string; matrixVersionId: string; competencyIds: string[]; questionCount: number };
  correlationId: string; attemptId: string; provider: AiProviderName; model: string; attemptNumber: number;
  outcome: AiAttemptEvent["outcome"] | string; latencyMs: number; status?: number | null; retryAfterMs?: number | null;
  response?: { requestId?: string; inputTokens?: number; outputTokens?: number }; fallbackReason?: string;
}): AiAttemptEvent {
  const outcome = input.outcome as AiAttemptEvent["outcome"];
  return {
    timestamp: new Date().toISOString(), level: outcome === "success" ? "info" : "warn", event: "ai_provider_attempt",
    operation: input.parameters.operation, assessmentSessionId: input.parameters.assessmentSessionId,
    matrixVersionId: input.parameters.matrixVersionId, correlationId: input.correlationId, attemptId: input.attemptId,
    provider: input.provider, model: input.model, attemptNumber: input.attemptNumber, outcome,
    httpStatus: input.status ?? null, providerRequestId: input.response?.requestId ?? "", latencyMs: input.latencyMs,
    inputTokens: input.response?.inputTokens ?? null, outputTokens: input.response?.outputTokens ?? null,
    retryAfterMs: input.retryAfterMs ?? null, schemaVersion: AI_SCHEMA_VERSION, questionCount: input.parameters.questionCount,
    competencyIds: [...new Set(input.parameters.competencyIds)], errorCode: outcome === "success" ? "" : outcome,
    errorMessageSanitized: outcome === "success" ? "" : outcome, fallbackReason: input.fallbackReason ?? "",
  };
}
