import { describe, expect, it, vi } from "vitest";

import {
  CATALOG_GUIDE_IDENTITY_COPY,
  CATALOG_GUIDE_JSON_SCHEMA,
  CATALOG_GUIDE_OUTSIDE_PATH_COPY,
  EVALUATION_JSON_SCHEMA,
  createAiAssessmentService,
  createGeminiAdapter,
  createGroqAdapter,
  type AiProviderAdapter,
  type CatalogGuideAiRequest,
  validateCatalogGuideOutput,
} from "./index";

const catalogGuideRequest: CatalogGuideAiRequest = {
  assessmentSessionId: "assessment-1",
  matrixVersionId: "matrix-v1",
  question: "How does the official statistics course address my skill gap?",
  results: [{
    competencyId: "statistics",
    competencyName: "Official statistics",
    assessedLevel: 2,
    requiredLevel: 4,
    gap: 2,
    priority: 1,
    confidence: 0.8,
    supported: true,
  }],
  pathCourses: [{
    courseId: "stats-101",
    title: "Official Statistics Methods",
    provider: "iGOT",
    duration: "4 hours",
    level: "Intermediate",
    sourceUrl: "https://example.test/stats-101",
    evidence: "detailed",
    competencyId: "statistics",
    competencyName: "Official statistics",
    rank: 1,
    rationale: "Covers summary selection for official reporting",
    description: "Methods used in official statistics work",
    learningOutcomes: ["Select a suitable summary statistic"],
    tags: ["statistics"],
  }],
};

const validGuide = {
  schemaVersion: "1.0" as const,
  gapSummary: "Skill gaps in Official statistics.",
  courseNotes: [{ courseId: "stats-101", note: "Official Statistics Methods covers summary selection." }],
  unavailable: "",
};

function provider(name: "gemini" | "groq", responses: Array<unknown>): AiProviderAdapter {
  const execute = vi.fn(async () => {
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return { data: response, requestId: `${name}-request` };
  });
  return { name, model: name === "gemini" ? "gemini-3.7-flash" : "qwen/qwen3.8-27b", execute };
}

describe("catalog guide contract", () => {
  it("accepts empty course notes and an empty unavailable string", () => {
    const value = { schemaVersion: "1.0" as const, gapSummary: "Skill gaps in Official statistics.", courseNotes: [], unavailable: "" };
    expect(validateCatalogGuideOutput(value, ["stats-101"])).toEqual(value);
  });

  it("rejects unknown courseId", () => {
    expect(() => validateCatalogGuideOutput(
      { ...validGuide, courseNotes: [{ courseId: "invented", note: "Not on the path." }] },
      ["stats-101"],
    )).toThrow();
  });

  it("rejects duplicate courseId", () => {
    expect(() => validateCatalogGuideOutput(
      { ...validGuide, courseNotes: [validGuide.courseNotes[0], { ...validGuide.courseNotes[0], note: "Repeated." }] },
      ["stats-101"],
    )).toThrow();
  });

  it("rejects off-path courseId", () => {
    expect(() => validateCatalogGuideOutput(
      { ...validGuide, courseNotes: [{ courseId: "other-catalog-course", note: "A course not on this path." }] },
      ["stats-101"],
    )).toThrow();
  });
});

describe("catalog guide failover", () => {
  it("fails over from a semantic catalog guide rejection to Groq", async () => {
    const invalid = { ...validGuide, courseNotes: [{ courseId: "invented", note: "Off path." }] };
    const gemini = provider("gemini", [invalid, invalid]);
    const groq = provider("groq", [validGuide]);
    const service = createAiAssessmentService({ gemini, groq, sleep: async () => undefined, jitterMs: () => 0 });

    const result = await service.explainCatalogGuide(catalogGuideRequest);

    expect(result.provider).toBe("groq");
    expect(result.data).toEqual(validGuide);
    expect(gemini.execute).toHaveBeenCalledTimes(2);
    expect(groq.execute).toHaveBeenCalledTimes(1);
  });

  it("skips both providers for identity questions", async () => {
    const gemini = provider("gemini", [validGuide]);
    const groq = provider("groq", [validGuide]);
    const service = createAiAssessmentService({ gemini, groq, sleep: async () => undefined, jitterMs: () => 0 });
    const result = await service.explainCatalogGuide({ ...catalogGuideRequest, question: "What can you do?" });
    expect(result.provider).toBe("seeded-fallback");
    expect(result.data.gapSummary).toBe(CATALOG_GUIDE_IDENTITY_COPY);
    expect(result.data.courseNotes).toEqual([]);
    expect(gemini.execute).not.toHaveBeenCalled();
    expect(groq.execute).not.toHaveBeenCalled();
  });

  it("yields seeded path notes when both providers fail", async () => {
    const unavailable = () => Object.assign(new Error("provider unavailable"), { status: 401 });
    const gemini = provider("gemini", [unavailable()]);
    const groq = provider("groq", [unavailable()]);
    const service = createAiAssessmentService({ gemini, groq, sleep: async () => undefined, jitterMs: () => 0 });

    const result = await service.explainCatalogGuide(catalogGuideRequest);

    expect(result.provider).toBe("seeded-fallback");
    expect(result.data.courseNotes.map((note) => note.courseId)).toEqual(["stats-101"]);
    expect(result.data.courseNotes[0]?.note).toContain("Official Statistics Methods");
    expect(result.data.unavailable).toBe("");
    expect(result.data.unavailable).not.toBe(CATALOG_GUIDE_OUTSIDE_PATH_COPY);
  });
});

describe("catalog guide provider adapters", () => {
  const providerRequest = {
    operation: "explain_catalog_guide" as const,
    prompt: "bounded prompt",
    timeoutMs: 8_000,
    correlationId: "correlation-1",
    attemptId: "attempt-1",
  };

  it("configures Gemini catalog guide schema and 1500 output cap", async () => {
    const generateContent = vi.fn(async () => ({ text: JSON.stringify(validGuide), responseId: "gemini-id", usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 } }));
    const adapter = createGeminiAdapter({ apiKey: "test-key", client: { models: { generateContent } } as never });

    await adapter.execute(providerRequest);

    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        responseMimeType: "application/json",
        responseJsonSchema: CATALOG_GUIDE_JSON_SCHEMA,
        maxOutputTokens: 1_500,
      }),
    }));
    const firstCall = generateContent.mock.calls.at(0)?.at(0) as { config?: { responseJsonSchema?: unknown } } | undefined;
    expect(firstCall?.config?.responseJsonSchema).not.toBe(EVALUATION_JSON_SCHEMA);
  });

  it("configures Groq catalog_guide json_schema with 1500 max tokens", async () => {
    const create = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify(validGuide) } }], usage: { prompt_tokens: 11, completion_tokens: 21 }, _request_id: "groq-id" }));
    const adapter = createGroqAdapter({ apiKey: "test-key", client: { chat: { completions: { create } } } as never });

    await adapter.execute({ ...providerRequest, timeoutMs: 6_000 });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 1_500,
        response_format: { type: "json_schema", json_schema: { name: "catalog_guide", strict: true, schema: CATALOG_GUIDE_JSON_SCHEMA } },
      }),
      expect.anything(),
    );
  });
});
