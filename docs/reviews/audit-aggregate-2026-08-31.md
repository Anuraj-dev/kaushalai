# Aggregated Audit — 2026-08-31 Loop 1

**Branch:** `audit/fix-loop-2026-08-31` | **Baseline:** lint 0, typecheck 0, 58/58 tests | **Agents:** A1-A5 parallel

## Deduplicated Findings (35 distinct, grouped)

### P0 Critical — Fix in this loop
| ID | Severity | File:Line | Title | Agents |
|---|---|---|---|---|
| C-AUD-01 | CRITICAL | `route.ts:205-233` | 3 separate txns — partial commit leaves no pending round (H1) | A1/A3 |
| C-AUD-02 | CRITICAL | `route.ts:192-203` | `single_choice` evaluated as written answer (H4) | A1/A2 |
| C-AUD-03 | HIGH | `route.ts:203` | `confidence ||0.6` → `0`→`0.6` inflates reliability (M2) | A1/A2 |
| C-AUD-04 | HIGH | `route.ts:187-189` + `learner-journey.tsx:120` | Answer unbounded, no maxLength (M1) | A1/A5 |
| C-AUD-05 | HIGH | `route.ts:250` + `assessments/route.ts:3` etc | `request.json() as` without Zod (M6) | A1/A5 |
| C-AUD-06 | HIGH | `service.ts:195` | Fallback `validateGeneratedQuestions` can throw → hard crash | A2 |
| C-AUD-07 | HIGH | `learning-service.ts:44`, `route.ts:271` | `completeCourse` no ownership/duplicate check (M3) | A3/A4/A5 |
| C-AUD-08 | MEDIUM | `service.ts:110-122` + `providers.ts:87` | `withAttemptTimeout` leaks, Groq ignores `timeoutMs`/deadline | A2 |
| C-AUD-09 | MEDIUM | `contracts.ts:152-171` | Grounding single-stem overlap (M8) | A2 |
| C-AUD-10 | MEDIUM | `service.ts:217-224` | Fallback `confidence 0` masquerades @0.6 reliability | A2 |
| C-AUD-11 | MEDIUM | `contracts.ts:84-123` vs `12-27` | Provider JSON Schema missing `minLength:1` | A2 |

### P1 High — Fix if low-risk
| ID | File:Line | Title |
|---|---|---|
| P1-01 | `scoring.ts:99,163` | Confidence budget makes R3 mandatory (H3) — requires product decision, not code-only |
| P1-02 | `db/schema.ts:20-37` + `migrations/0000:20` | Versioning only requirements, not rubrics/questions (H2) — needs migration |
| P1-03 | `admin-repository.ts:96-107` vs `scoring.ts:145` | Readiness divergence (M5) |
| P1-04 | `services/learning-service.ts:13` | `supported=1` filter hides gaps |
| P1-05 | `recommendations.ts:15` | 4 competencies 0 eligible (Government Cloud etc) |
| P1-06 | `db/client.ts:12`, `assessment-snapshot-store.ts:17` | Vercel /tmp ephemeral + silent no-op Turso (C1/C2) |
| P1-07 | `route.ts:48,149` | N+1 queries |
| P1-08 | `route.ts:279` | Error envelope leaks `error.message` |
| P1-09 | `courses/route.ts:3` | limit NaN, no bounds |
| P1-10 | `playwright.config.ts:6` | e2e not deterministic (M7) |

### P2 Low/Info — Defer
L1 kind JSON column, L2 evidence regex, L3 missing profile step, L4 one-liners, L6 batch, M9 deps pruning, etc.

## Loop Topology
```
[Audit x5 parallel] → Aggregate → [Fix x3 parallel (non-overlapping files)] → Verify (lint/typecheck/test) → PR (gh, no merge) → [Review x3 parallel] → Fix review → Push
```
- Branch: `audit/fix-loop-2026-08-31`
- Never merge (per instruction)
- Fix agents partitioned by file to avoid conflicts

## Fix Assignment (this loop)
- **F1 — Route Critical:** `src/app/api/learner/session/route.ts` — single_choice branch, `??` fix, answer bounds Zod, input schema, transaction comment/todo
- **F2 — AI Layer:** `src/ai/service.ts`, `src/ai/contracts.ts`, `src/ai/providers.ts` — fallback try/catch, `minLength:1`, Groq timeout via AbortSignal, grounding threshold, sanitize
- **F3 — API/UI/Persistence:** `src/components/learner/learner-journey.tsx`, `src/app/api/courses/route.ts`, `src/app/api/completions/route.ts`, `src/services/learning-service.ts`, `src/domain/recommendations/recommendations.ts`

Verification gate after fix: `npm run lint && npm run typecheck && npm test` must stay 0/0/58.
