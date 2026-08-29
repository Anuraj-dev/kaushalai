# AI provider contracts for adaptive assessment

Checked against current Google AI and Groq documentation on 30 August 2026.

## Verdict

Use `gemini-3.7-flash` as the primary model and `qwen/qwen3.8-27b` on Groq as the secondary model.

Both can return schema-constrained JSON. Gemini 3.7 Flash is a stable model with structured-output support. Groq marks Qwen 3.8 27B as Preview, but it is the current Groq-hosted Qwen model with strict JSON Schema support. That makes it a credible deadline fallback, not a permanent dependency to forget about. Keep both model IDs in environment configuration and validate them at startup.

The application, not either model, must calculate final competency scores, assessment coverage, contradictions, and the Round 3 gate. The models only generate bounded questions and evaluate short written answers against a supplied rubric.

## Model contracts

### Google Gemini

Use model ID `gemini-3.7-flash` through the Google GenAI SDK.

- Google lists this exact ID as stable and last updated in August 2026. It supports structured outputs, text input and output, and low, medium, or high thinking levels. Its input limit is 1,048,576 tokens and output limit is 65,536 tokens. [Gemini 3.7 Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash)
- For this small, latency-sensitive task, use thinking level `low`, temperature near `0.2`, and a small output cap. The model limits are far beyond what the assessment needs.
- On the current Interactions API, pass `response_format` with `type: "text"`, `mime_type: "application/json"`, and the JSON Schema in `schema`. The Google GenAI JavaScript SDK can accept a schema generated from Zod. [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- Gemini supports a subset of JSON Schema. The portable schema below stays within documented object, array, string, integer, number, boolean, enum, required, `additionalProperties`, minimum, maximum, `minItems`, and `maxItems` features. Google still tells callers to validate values in the application because schema compliance does not prove semantic correctness. [Gemini JSON Schema support and limitations](https://ai.google.dev/gemini-api/docs/structured-output#json-schema-support)
- Gemini's interactive rate limits vary by model, project tier, and account status. They apply per project rather than per API key. Read the active values from AI Studio instead of baking a number into the product. [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

### Groq Qwen

Use model ID `qwen/qwen3.8-27b` through Groq's chat-completions API.

- Groq lists Qwen 3.8 27B as Preview. It accepts text and images, returns text, and supports JSON Object Mode, JSON Schema Mode, and reasoning. Its context window is 131,042 tokens and its maximum output is 16,384 tokens. [Groq Qwen 3.8 27B model page](https://console.groq.com/docs/model/qwen/qwen3.8-27b)
- Use `reasoning_effort: "none"` for question generation and routine rubric evaluation. The model page recommends this instruct mode for efficient general-purpose work. If evaluation quality proves weak in tests, `low` is supported, but latency must be measured before making it the default.
- Pass `response_format.type: "json_schema"`, a short schema `name`, `strict: true`, and the shared JSON Schema. Qwen 3.8 27B appears in Groq's strict-mode support table. Strict mode requires every field to be listed in `required` and every object to set `additionalProperties: false`. Streaming and tool use cannot be combined with Groq Structured Outputs. [Groq Structured Outputs](https://console.groq.com/docs/structured-outputs)
- Groq's published base Developer-plan limits for this model are 30 requests per minute, 1,000 requests per day, 8,000 tokens per minute, and 2,000,000 tokens per day. Actual organization limits belong in the Groq console. A `429` response includes `retry-after`; respect it if the remaining request budget permits. [Groq rate limits](https://console.groq.com/docs/rate-limits)

## Provider-neutral domain schemas

Keep two small schemas instead of one union envelope. This avoids provider-specific support for complex `oneOf` or `anyOf` branches and makes validation errors easier to diagnose. Every property is required for Groq strict mode. Where a value does not apply, use an empty array or empty string rather than omitting the field.

### Adaptive question generation

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "type": "string", "enum": ["1.0"] },
    "questions": {
      "type": "array",
      "minItems": 1,
      "maxItems": 10,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string" },
          "competencyId": { "type": "string" },
          "format": { "type": "string", "enum": ["single_choice", "short_text"] },
          "prompt": { "type": "string" },
          "targetLevel": { "type": "integer", "minimum": 1, "maximum": 5 },
          "selectionReason": { "type": "string" },
          "options": {
            "type": "array",
            "maxItems": 5,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "id": { "type": "string" },
                "text": { "type": "string" },
                "demonstratedLevel": { "type": "integer", "minimum": 1, "maximum": 5 }
              },
              "required": ["id", "text", "demonstratedLevel"]
            }
          },
          "rubric": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "level": { "type": "integer", "minimum": 1, "maximum": 5 },
                "criterion": { "type": "string" }
              },
              "required": ["level", "criterion"]
            }
          }
        },
        "required": ["id", "competencyId", "format", "prompt", "targetLevel", "selectionReason", "options", "rubric"]
      }
    }
  },
  "required": ["schemaVersion", "questions"]
}
```

Server-side semantic checks must reject a question when its competency is not in the pinned matrix version, an ID is duplicated, the requested count is wrong, a `single_choice` item has fewer than two options, or a `short_text` item has non-empty options. The server stores `selectionReason`, option levels, and the rubric but does not send those fields to the learner.

Round 2 sets `maxItems` to 10 and requests 7 to 10 items. Round 3 uses the same schema with `maxItems` set to 5 and only supplies unsupported or contradictory competencies. The application chooses whether Round 3 is allowed. It does not accept the model's opinion as the gate.

### Written-answer evaluation

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "type": "string", "enum": ["1.0"] },
    "evaluations": {
      "type": "array",
      "minItems": 1,
      "maxItems": 10,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "questionId": { "type": "string" },
          "competencyId": { "type": "string" },
          "demonstratedLevel": { "type": "integer", "minimum": 1, "maximum": 5 },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "evidenceSummary": { "type": "string" },
          "rubricReason": { "type": "string" },
          "ambiguity": { "type": "string" }
        },
        "required": ["questionId", "competencyId", "demonstratedLevel", "confidence", "evidenceSummary", "rubricReason", "ambiguity"]
      }
    }
  },
  "required": ["schemaVersion", "evaluations"]
}
```

The server must verify that each result refers to the submitted question and competency, contains a level allowed by the stored rubric, and does not invent evidence outside the answer. An empty `ambiguity` means the model found none. Clamp neither levels nor confidence silently. Reject invalid output and continue through the retry or failover policy.

The adapter returns either schema through one application envelope:

```ts
type AiResult<T> = {
  data: T;
  provider: "gemini" | "groq" | "seeded-fallback";
  model: string;
  requestId: string;
  attempts: number;
  latencyMs: number;
};
```

Provider metadata comes from the adapter, never from model-generated JSON.

## Timeout, retry, and failover

Use the same ordered policy for question generation and written-answer evaluation:

1. Call Gemini 3.7 Flash with an 8-second attempt timeout.
2. Retry Gemini once after 500 to 750 milliseconds of jitter only for a network error, timeout, `408`, `429`, or `5xx` response. Do not retry `400`, `401`, or `403`.
3. Call Groq Qwen 3.8 27B with a 6-second attempt timeout.
4. Retry Groq once for a network error, timeout, `422`, `429`, `498`, or `5xx`. For `429`, honor `retry-after` only when it fits inside the overall deadline. Use the same 500 to 750 millisecond jitter when no server delay is supplied. Groq documents `422` as potentially retryable, `429` as requiring throttling, and `500`, `502`, and `503` as temporary failures. [Groq error codes](https://console.groq.com/docs/errors)
5. Use the seeded fallback bank after both providers fail, either provider returns semantically invalid content twice, or the 30-second overall deadline expires.

Google recommends exponential backoff with jitter for transient `408`, `429`, and `5xx` failures and warns against retrying client errors such as `400` and `403`. One retry is intentionally tighter than the SDK defaults because this is an interactive assessment and the second provider is already available. Disable SDK-level automatic retries or set them to the same single-retry budget so hidden retries do not exhaust the deadline. [Gemini retry guidance](https://ai.google.dev/gemini-api/docs/troubleshooting#retry-strategy)

Generation and evaluation calls do not write application state, so retrying them is safe. Persist a result only after local schema and semantic validation. Use the same correlation ID across attempts, but give each provider call its own attempt ID.

Cap model output at 2,500 tokens for question generation and 1,200 tokens for evaluation. These caps reduce latency and prevent a malformed answer from consuming either provider's much larger model limit. Do not stream either operation. The complete assessment context should contain the pinned matrix version, relevant competency rubrics, prior evidence summaries, and the requested count, not the full database record.

## Logs

Write one structured event per attempt. Keep provider failures out of learner-facing UI, as agreed for the prototype.

Required fields:

```text
timestamp
level
event = ai_provider_attempt
operation = generate_adaptive_questions | evaluate_written_answers
assessmentSessionId
matrixVersionId
correlationId
attemptId
provider
model
attemptNumber
outcome = success | timeout | transport_error | provider_error | schema_error | semantic_error | fallback
httpStatus
providerRequestId
latencyMs
inputTokens
outputTokens
retryAfterMs
schemaVersion
questionCount
competencyIds
errorCode
errorMessageSanitized
fallbackReason
```

Never log API keys, authorization headers, full profile data, raw learner answers, prompts, or full model responses. Hash or use internal IDs for the official and assessment session. Keep the provider's request ID because it is the most useful field when debugging a failed API call.

## Implementation check before the demo

Run one startup or health-check request against each configured model using the exact production schemas. A valid API key does not prove that the project can call the chosen model. The check should confirm model access, schema acceptance, local validation, and that the measured latency fits the attempt timeout. If Groq changes the Preview model, update only the environment model ID and provider adapter, then rerun the contract test.
