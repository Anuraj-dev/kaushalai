Type: research
Status: resolved

# Verify Gemini and Groq Qwen provider contracts

## Question

Which current Gemini and Groq-hosted Qwen models support the structured question-generation and rubric-evaluation contracts, and what provider-neutral response schema, timeout, retry, and failover behavior should the prototype use?

## Answer

Use stable `gemini-3.7-flash` first, then Groq Preview `qwen/qwen3.8-27b`, then the seeded fallback bank. Both providers support JSON Schema output; Groq Qwen supports strict mode. Share simple, fully required question-generation and written-evaluation schemas, validate semantics locally, and keep final scoring and the Round 3 gate deterministic. Give Gemini 8 seconds per attempt and Groq 6 seconds, with one transient-error retry per provider inside a 30-second overall budget. Log every attempt without raw answers, prompts, credentials, or profile data. Full contract and official sources: [`docs/research/ai-provider-contracts.md`](../../../docs/research/ai-provider-contracts.md).
