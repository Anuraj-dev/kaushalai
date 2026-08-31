import { describe, expect, it, vi } from "vitest";

import {
  EVALUATION_JSON_SCHEMA,
  QUESTION_JSON_SCHEMA,
  createAiAssessmentService,
  createGeminiAdapter,
  createGroqAdapter,
  type AiProviderAdapter,
  type GenerateAdaptiveQuestionsRequest,
  validateGeneratedQuestions,
  validateWrittenEvaluations,
} from "./index";

const generationRequest: GenerateAdaptiveQuestionsRequest = {
  assessmentSessionId: "assessment-1",
  matrixVersionId: "matrix-v1",
  requestedCount: 2,
  competencies: [
    {
      id: "statistics",
      targetLevel: 3,
      rubric: [
        { level: 1, criterion: "Recognises basic terms" },
        { level: 3, criterion: "Chooses and explains a method" },
      ],
    },
    {
      id: "python",
      targetLevel: 2,
      rubric: [{ level: 2, criterion: "Writes a small data transformation" }],
    },
  ],
  priorEvidence: [],
  fallbackQuestions: [
    {
      id: "fallback-statistics",
      competencyId: "statistics",
      format: "single_choice",
      prompt: "Which summary best resists an extreme outlier?",
      targetLevel: 3,
      selectionReason: "Checks robust summary selection",
      options: [
        { id: "median", text: "Median", demonstratedLevel: 3 },
        { id: "mean", text: "Mean", demonstratedLevel: 1 },
      ],
      rubric: [{ level: 3, criterion: "Selects the median" }],
    },
    {
      id: "fallback-python",
      competencyId: "python",
      format: "short_text",
      prompt: "Describe how you would remove duplicate rows.",
      targetLevel: 2,
      selectionReason: "Checks data preparation reasoning",
      options: [],
      rubric: [{ level: 2, criterion: "Names a deterministic deduplication method" }],
    },
  ],
};

const validGeneration = {
  schemaVersion: "1.0" as const,
  questions: generationRequest.fallbackQuestions,
};

function provider(name: "gemini" | "groq", responses: Array<unknown>): AiProviderAdapter {
  const execute = vi.fn(async () => {
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return { data: response, requestId: `${name}-request` };
  });
  return { name, model: name === "gemini" ? "gemini-3.7-flash" : "qwen/qwen3.8-27b", execute };
}

describe("adaptive question contract", () => {
  it("accepts a valid fully structured response", () => {
    expect(validateGeneratedQuestions(validGeneration, generationRequest)).toEqual(validGeneration);
  });

  it.each([
    ["unknown competency", { ...validGeneration, questions: [{ ...validGeneration.questions[0], competencyId: "invented" }, validGeneration.questions[1]] }],
    ["duplicate ID", { ...validGeneration, questions: [validGeneration.questions[0], { ...validGeneration.questions[1], id: validGeneration.questions[0].id }] }],
    ["wrong count", { ...validGeneration, questions: [validGeneration.questions[0]] }],
    ["single choice without two options", { ...validGeneration, questions: [{ ...validGeneration.questions[0], options: validGeneration.questions[0].options.slice(0, 1) }, validGeneration.questions[1]] }],
    ["short text with options", { ...validGeneration, questions: [validGeneration.questions[0], { ...validGeneration.questions[1], options: validGeneration.questions[0].options }] }],
    ["rubric level outside matrix rubric", { ...validGeneration, questions: [{ ...validGeneration.questions[0], rubric: [{ level: 5, criterion: "Invented" }] }, validGeneration.questions[1]] }],
  ])("rejects %s", (_case, response) => {
    expect(() => validateGeneratedQuestions(response, generationRequest)).toThrow();
  });
});

describe("written evaluation contract", () => {
  const request = {
    assessmentSessionId: "assessment-1",
    matrixVersionId: "matrix-v1",
    answers: [{
      questionId: "written-1",
      competencyId: "statistics",
      answer: "I would compare the median and IQR because they resist extreme values.",
      rubric: [{ level: 1, criterion: "Names a summary" }, { level: 3, criterion: "Explains a robust summary" }],
      fallbackDemonstratedLevel: 1,
    }],
  };
  const valid = { schemaVersion: "1.0" as const, evaluations: [{
    questionId: "written-1", competencyId: "statistics", demonstratedLevel: 3,
    confidence: 0.78, evidenceSummary: "The answer selects robust summaries.",
    rubricReason: "It explains why median and IQR resist extremes.", ambiguity: "",
  }] };

  it("accepts a valid evaluation", () => {
    expect(validateWrittenEvaluations(valid, request)).toEqual(valid);
  });

  it.each([
    ["unknown question", { ...valid, evaluations: [{ ...valid.evaluations[0], questionId: "other" }] }],
    ["wrong competency", { ...valid, evaluations: [{ ...valid.evaluations[0], competencyId: "python" }] }],
    ["level outside rubric", { ...valid, evaluations: [{ ...valid.evaluations[0], demonstratedLevel: 2 }] }],
    ["invented evidence", { ...valid, evaluations: [{ ...valid.evaluations[0], evidenceSummary: "The official deployed a production survey system." }] }],
  ])("rejects %s", (_case, response) => {
    expect(() => validateWrittenEvaluations(response, request)).toThrow();
  });
});

describe("provider failover", () => {
  it("uses Gemini success without exposing provider metadata in learner questions", async () => {
    const gemini = provider("gemini", [validGeneration]);
    const groq = provider("groq", []);
    const service = createAiAssessmentService({ gemini, groq, sleep: async () => undefined, jitterMs: () => 0 });

    const result = await service.generateAdaptiveQuestions(generationRequest);

    expect(result.provider).toBe("gemini");
    expect(result.model).toBe("gemini-3.7-flash");
    expect(service.toLearnerQuestions(result.data)).toEqual([
      { id: "fallback-statistics", competencyId: "statistics", format: "single_choice", prompt: "Which summary best resists an extreme outlier?", options: [{ id: "median", text: "Median" }, { id: "mean", text: "Mean" }] },
      { id: "fallback-python", competencyId: "python", format: "short_text", prompt: "Describe how you would remove duplicate rows.", options: [] },
    ]);
    expect(groq.execute).not.toHaveBeenCalled();
  });

  it("fails over from a non-transient Gemini error to Groq", async () => {
    const rejected = Object.assign(new Error("bad request included secret-value"), { status: 400 });
    const gemini = provider("gemini", [rejected]);
    const groq = provider("groq", [validGeneration]);
    const events: unknown[] = [];
    const service = createAiAssessmentService({ gemini, groq, logger: (event) => events.push(event), sleep: async () => undefined, jitterMs: () => 0 });

    const result = await service.generateAdaptiveQuestions(generationRequest);

    expect(result.provider).toBe("groq");
    expect(gemini.execute).toHaveBeenCalledTimes(1);
    expect(groq.execute).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(events)).not.toContain("secret-value");
    expect(JSON.stringify(events)).not.toContain("Which summary");
  });

  it("retries transient failures once and uses deterministic fallback after both providers fail", async () => {
    const transient = () => Object.assign(new Error("network down"), { status: 503 });
    const gemini = provider("gemini", [transient(), transient()]);
    const groq = provider("groq", [transient(), transient()]);
    const service = createAiAssessmentService({ gemini, groq, sleep: async () => undefined, jitterMs: () => 0 });

    const first = await service.generateAdaptiveQuestions(generationRequest);
    const second = await service.generateAdaptiveQuestions(generationRequest);

    expect(first.provider).toBe("seeded-fallback");
    expect(first.data).toEqual(second.data);
    expect(gemini.execute).toHaveBeenCalledTimes(4);
    expect(groq.execute).toHaveBeenCalledTimes(4);
  });

  it("retries semantic rejection before moving to the next provider", async () => {
    const invalid = { ...validGeneration, questions: [validGeneration.questions[0]] };
    const gemini = provider("gemini", [invalid, invalid]);
    const groq = provider("groq", [validGeneration]);
    const service = createAiAssessmentService({ gemini, groq, sleep: async () => undefined, jitterMs: () => 0 });

    const result = await service.generateAdaptiveQuestions(generationRequest);

    expect(result.provider).toBe("groq");
    expect(gemini.execute).toHaveBeenCalledTimes(2);
  });

  it("uses a stored rubric level when provider evaluation falls back", async () => {
    const unavailable = () => Object.assign(new Error("provider unavailable"), { status: 401 });
    const gemini = provider("gemini", [unavailable()]);
    const groq = provider("groq", [unavailable()]);
    const service = createAiAssessmentService({ gemini, groq, sleep: async () => undefined, jitterMs: () => 0 });

    const result = await service.evaluateWrittenAnswers({
      assessmentSessionId: "assessment-1",
      matrixVersionId: "matrix-v1",
      answers: [{
        questionId: "written-1",
        competencyId: "statistics",
        answer: "I reviewed the result and documented the method.",
        rubric: [{ level: 1, criterion: "Names the method" }, { level: 3, criterion: "Explains and validates the method" }],
        fallbackDemonstratedLevel: 2,
      }],
    });

    expect(result.provider).toBe("seeded-fallback");
    expect(result.data.evaluations[0]?.demonstratedLevel).toBe(1);
  });
});

describe("provider SDK adapters", () => {
  const providerRequest = {
    operation: "generate_adaptive_questions" as const,
    prompt: "bounded prompt",
    timeoutMs: 8_000,
    correlationId: "correlation-1",
    attemptId: "attempt-1",
  };

  it("configures Gemini structured output without hidden SDK retries", async () => {
    const generateContent = vi.fn(async () => ({ text: JSON.stringify(validGeneration), responseId: "gemini-id", usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 } }));
    const adapter = createGeminiAdapter({ apiKey: "test-key", client: { models: { generateContent } } as never });

    const result = await adapter.execute(providerRequest);

    expect(result.requestId).toBe("gemini-id");
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemini-3.7-flash",
      config: expect.objectContaining({
        responseMimeType: "application/json", responseJsonSchema: QUESTION_JSON_SCHEMA,
        maxOutputTokens: 2_500, temperature: 0.2,
        httpOptions: { timeout: 8_000, retryOptions: { attempts: 1 } },
      }),
    }));
  });

  it("configures Groq Qwen strict schema output with reasoning disabled", async () => {
    const create = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify(validGeneration) } }], usage: { prompt_tokens: 11, completion_tokens: 21 }, _request_id: "groq-id" }));
    const adapter = createGroqAdapter({ apiKey: "test-key", client: { chat: { completions: { create } } } as never });

    const result = await adapter.execute({ ...providerRequest, timeoutMs: 6_000 });

    expect(result.requestId).toBe("groq-id");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: "qwen/qwen3.8-27b", reasoning_effort: "none", stream: false, max_tokens: 2_500,
      response_format: { type: "json_schema", json_schema: { name: "adaptive_questions", strict: true, schema: QUESTION_JSON_SCHEMA } },
    }));
  });

  it("uses the smaller evaluation output cap and evaluation schema", async () => {
    const create = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify({ schemaVersion: "1.0", evaluations: [] }) } }] }));
    const adapter = createGroqAdapter({ apiKey: "test-key", client: { chat: { completions: { create } } } as never });
    await adapter.execute({ ...providerRequest, operation: "evaluate_written_answers" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      max_tokens: 1_200,
      response_format: { type: "json_schema", json_schema: { name: "written_evaluations", strict: true, schema: EVALUATION_JSON_SCHEMA } },
    }));
  });
});
