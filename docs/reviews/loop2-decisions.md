# Loop 2 Product Decisions — 2026-08-31

## H2 — Matrix versioning covers requirements only (not rubrics/tags/questions)

**Status:** Acknowledged, **deferred** for seeded demo. Current schema `src/db/schema.ts:20` stores rubrics (`competency_rubrics`), tags (`competency_course_tags`), questions (`questions`) as global competency records; `matrix_versions` immutability triggers `migrations/0000_foundation.sql:20` protect only `matrix_competencies`.

**Risk:** Active assessment loads current globals via `rubrics()` `route.ts:48` + `baselineQuestions()` `route.ts:58`, so post-start competency edits could leak into ongoing assessment. Admin UI avoids edits (read-only preview), so demo is safe.

**Decision for Loop 2:** Keep current model, add middleware stub and audit note. Full fix requires snapshot tables `matrix_version_rubrics` / `matrix_version_questions` per `assessment-snapshot.ts` pattern + triggers on snapshot tables. Planned for Loop 3 after product sign-off on versioning scope (Issue #6/#14: 6--8 competencies vs full content versioning).

## H3 — Confidence budget makes R3 mandatory (8-competency primary matrix)

**Status:** Reproduced `scoring.ts:99` `confidence = min(n/3)*avgRel*(0.5+0.5*agreement)` with `SUPPORTED_CONFIDENCE 0.7` `scoring.ts:13` and R2 `7-10` Q `route.ts:104` cannot reach 80% coverage for 8 competencies (needs 14 evidence, max 10). Fallback `route.ts:105` round-robin guarantees R3, then provisional.

**Decision:** Keep formula for demo — deterministic and AI-free per spec. Loop 2 does **not** change `/3` to `/2`. Product must decide: (a) make adaptive questions emit per-competency evidence, or (b) change factor to `/2` with history-weighted confidence. Added single-txn atomicity `route.ts:280` so provisional result is not lost, but gate remains mandatory. Add test in Loop 3 proving both branches reachable for 6/7/8 matrices after budget decision.

## M5 — Readiness divergence (domain weighted vs admin count)

**Status:** Deferred. Domain `scoring.ts:145` weighted attainment vs `admin-repository.ts:96` binary pass rate. Documented as two metrics: `AssessmentResult.readiness` (learner) vs `admin.analytics.readinessPercent` (org pass rate). Rename in Loop 3 or persist weighted avg.

## Loop 2 Fixes Shipped

- `route.ts:181` single atomic `db.transaction` for responses+evidence+results+nextRound (C-AUD-01 fixed)
- `middleware.ts:1` stub guard for `/admin/*` + `/api/matrices/*` (AUTH-001)
- `route.ts:273` bodySchema Zod 64char max, answers max10, sanitized error envelope `route.ts:317`
- `providers.ts:84` Groq AbortSignal + timeoutMs, `assessment-ai.test.ts:234` updated
- `schema.ts:62` + `migrations/0004_course_completion_unique.sql:1` UNIQUE(official_id,course_id) + OR IGNORE idempotency `learning-service.ts:56`

## Remaining for Loop 3

- Versioned snapshot tables + triggers (H2)
- Confidence budget decision + parametrized gate tests (H3)
- Real auth (NextAuth) replacing stub `middleware.ts:10`
- Coverage thresholds `vitest.config.ts` + e2e `AI_PROVIDER_MODE=seeded` `playwright.config.ts:6`
