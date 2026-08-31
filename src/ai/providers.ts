import { GoogleGenAI, ThinkingLevel, type GenerateContentResponse } from "@google/genai";
import Groq from "groq-sdk";

import { AiContractError, EVALUATION_JSON_SCHEMA, GEMINI_MODEL, GROQ_MODEL, QUESTION_JSON_SCHEMA } from "./contracts";
import type { AiProviderAdapter, ProviderRequest } from "./service";

type GeminiClient = {
  models: {
    generateContent(parameters: Parameters<GoogleGenAI["models"]["generateContent"]>[0]): Promise<GenerateContentResponse>;
  };
};

type GroqCompletion = Awaited<ReturnType<Groq["chat"]["completions"]["create"]>>;
type GroqClient = {
  chat: { completions: { create(parameters: Record<string, unknown>): Promise<GroqCompletion> } };
};

export type AiProviderEnvironment = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  AI_PROVIDER_MODE?: string;
};

function schemaFor(request: ProviderRequest) {
  return request.operation === "generate_adaptive_questions" ? QUESTION_JSON_SCHEMA : EVALUATION_JSON_SCHEMA;
}

function outputLimitFor(request: ProviderRequest) {
  return request.operation === "generate_adaptive_questions" ? 2_500 : 1_200;
}

function missingCredential(provider: string): Error & { status: number; code: string } {
  return Object.assign(new Error(`${provider} credential is not configured`), { status: 401, code: "provider_not_configured" });
}

function parseStructuredResponse(text: string | null | undefined, provider: string): unknown {
  if (!text) throw new AiContractError("schema_error", `${provider} returned an empty structured response`);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiContractError("schema_error", `${provider} returned malformed JSON`);
  }
}

export function createGeminiAdapter(options: { apiKey?: string; model?: string; client?: GeminiClient } = {}): AiProviderAdapter {
  const apiKey = options.apiKey;
  const model = options.model ?? GEMINI_MODEL;
  const client = options.client ?? (apiKey ? new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 } } }) : undefined);
  return {
    name: "gemini",
    model,
    async execute(request) {
      if (!client) throw missingCredential("Gemini");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new DOMException("Provider attempt timed out", "TimeoutError")), request.timeoutMs);
      try {
        const response = await client.models.generateContent({
          model,
          contents: request.prompt,
          config: {
            abortSignal: controller.signal,
            httpOptions: { timeout: request.timeoutMs, retryOptions: { attempts: 1 } },
            responseMimeType: "application/json",
            responseJsonSchema: schemaFor(request),
            temperature: 0.2,
            maxOutputTokens: outputLimitFor(request),
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        return {
          data: parseStructuredResponse(response.text, "Gemini"),
          requestId: response.responseId,
          inputTokens: response.usageMetadata?.promptTokenCount,
          outputTokens: response.usageMetadata?.candidatesTokenCount,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function createGroqAdapter(options: { apiKey?: string; model?: string; client?: GroqClient } = {}): AiProviderAdapter {
  const apiKey = options.apiKey;
  const model = options.model ?? GROQ_MODEL;
  const client = options.client ?? (apiKey ? new Groq({ apiKey, timeout: 6_000, maxRetries: 0 }) : undefined);
  return {
    name: "groq",
    model,
    async execute(request) {
      if (!client) throw missingCredential("Groq");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new DOMException("Provider attempt timed out", "TimeoutError")), request.timeoutMs);
      let completion: GroqCompletion;
      try {
        completion = (await client.chat.completions.create(
          {
            model,
            messages: [{ role: "user", content: request.prompt }],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: request.operation === "generate_adaptive_questions" ? "adaptive_questions" : "written_evaluations",
                strict: true,
                schema: schemaFor(request),
              },
            },
            reasoning_effort: "none",
            temperature: 0.2,
            max_tokens: outputLimitFor(request),
            stream: false,
          },
          { signal: controller.signal } as Record<string, unknown>,
        )) as GroqCompletion;
      } finally {
        clearTimeout(timeout);
      }
      if (!("choices" in completion)) throw new AiContractError("schema_error", "Groq returned a non-completion response");
      const content = completion.choices[0]?.message.content;
      return {
        data: parseStructuredResponse(content, "Groq"),
        requestId: "_request_id" in completion && typeof completion._request_id === "string" ? completion._request_id : undefined,
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
      };
    },
  };
}

export function createConfiguredProviderAdapters(environment?: AiProviderEnvironment) {
  const configured = environment ?? {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    AI_PROVIDER_MODE: process.env.AI_PROVIDER_MODE,
  };
  const isSeeded = configured.AI_PROVIDER_MODE === "seeded" || process.env.AI_PROVIDER_MODE === "seeded";
  if (isSeeded) {
    return {
      gemini: createGeminiAdapter({}),
      groq: createGroqAdapter({}),
    };
  }
  return {
    gemini: createGeminiAdapter({ apiKey: configured.GEMINI_API_KEY, model: configured.GEMINI_MODEL ?? GEMINI_MODEL }),
    groq: createGroqAdapter({ apiKey: configured.GROQ_API_KEY, model: configured.GROQ_MODEL ?? GROQ_MODEL }),
  };
}
