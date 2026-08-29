import {
  AI_SCHEMA_VERSION,
  AiContractError,
  type EvaluateWrittenAnswersRequest,
  type GeneratedQuestions,
  type GenerateAdaptiveQuestionsRequest,
  type LearnerQuestion,
  toLearnerQuestions,
  validateGeneratedQuestions,
  validateWrittenEvaluations,
} from "./contracts";

export type AiProviderName = "gemini" | "groq" | "seeded-fallback";
export type AiOperation = "generate_adaptive_questions" | "evaluate_written_answers";

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

export function createAiAssessmentService(dependencies: Dependencies) {
  const now = dependencies.now ?? Date.now;
  const sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const jitterMs = dependencies.jitterMs ?? (() => 500 + Math.floor(Math.random() * 251));
  const makeCorrelationId = dependencies.correlationId ?? (() => crypto.randomUUID());
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

    const data = parameters.fallback();
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
          demonstratedLevel: answer.fallbackDemonstratedLevel, confidence: 0,
          evidenceSummary: answer.answer.trim() || (answer.rubric.find((entry) => entry.level === answer.fallbackDemonstratedLevel)?.criterion ?? answer.rubric[0]?.criterion ?? "No evidence available"),
          rubricReason: answer.rubric.find((entry) => entry.level === answer.fallbackDemonstratedLevel)?.criterion ?? answer.rubric[0]?.criterion ?? "No evidence available",
          ambiguity: "Provider evaluation unavailable",
        })) }, request),
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
