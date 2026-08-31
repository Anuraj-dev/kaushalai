# Kaushal AI codebase quality report

Review date: 30 August 2026
Reviewed revision: `9147a4e745ba06af921a20f246adf78e0b8a6b26`
Review scope: every tracked file, compared with the empty Git tree
Specification: GitHub issues #1 through #23, issue comments, `CONTEXT.md`, `PRODUCT.md`, and both research documents

## Verdict

Kaushal AI is a working, browser-tested prototype with good domain foundations. It is suitable for a controlled SIH demonstration. It is not yet equal to the complete written specification, and its current architecture gives stronger test confidence than the production path deserves.

No critical defect was found. Four high-severity design or correctness risks should be fixed before treating the scoring history, matrix lifecycle, or live-AI journey as trustworthy beyond the seeded demo.

Overall codebase quality: **6.6/10**
Specification fidelity: **7.0/10**
Demo readiness: **8.2/10**
Production readiness: **4.5/10**

| Area | Score | Assessment |
| --- | ---: | --- |
| Domain logic | 7.4 | Scoring is explicit and typed, but evidence allocation makes the gate behave poorly in the real journey. |
| Specification fidelity | 7.0 | Most headline behavior exists; matrix editing/versioning and several workflow details are partial. |
| Architecture | 6.0 | Useful module boundaries exist, but production orchestration bypasses the tested assessment engine. |
| Tests | 6.8 | 54 unit/integration tests and 10 browser cases pass; important assertions target unused code or omit failure states. |
| Data integrity and API safety | 5.8 | Foreign keys and transactions help, but request validation, ownership checks, and idempotency are weak. |
| Maintainability | 6.5 | The repository is small and navigable. Dense one-line modules, duplicated paths, and unused dependencies add friction. |
| Performance | 7.4 | Fast at prototype scale. Synchronous SQLite and repeated per-row queries will not scale cleanly. |
| UI and accessibility | 6.6 | Keyboard basics, focus, mobile layout, and empty states exist. The admin editor and learner profile step remain thin. |

## Review inventory

- 104 tracked files
- 51 production TypeScript/TSX files, 2,052 lines
- 10 test files, 855 lines
- 10 route handlers
- 4 SQL migrations
- 14 production dependencies and 16 development dependencies
- 10 roles, 10 officials, 3 selectable officials, 1 administrator
- 222 imported courses, including 25 detailed records

## What is strong

1. **The important formulas live in deterministic code.** Reliability constants, weighted assessment, gaps, priority, confidence, support, contradiction, coverage, and readiness are visible in `src/domain/assessment/scoring.ts`. Model output does not calculate final scores or decide the Round 3 gate.

2. **Provider contracts are unusually disciplined for a prototype.** Gemini and Groq use explicit schemas, local semantic validation, provider-specific timeouts, bounded retries, one overall deadline, and sanitized event objects. The learner projection removes provider metadata.

3. **The seed and import path is repeatable.** The importer rejects anything other than 222 courses and 25 detailed records, creates stable IDs, preserves provenance, and supports repeated setup. Seed validation covers all ten matrices, full rubrics, baseline questions, fallback banks, and course tags.

4. **Core persistence invariants exist in the database.** Foreign keys are enabled, published matrix version rows and matrix requirements are protected by triggers, and assessments keep their starting matrix-version ID.

5. **Recommendations have a real evidence gate.** Search-term membership alone cannot qualify a course. Detailed metadata outranks title-only evidence, known specialist false positives are rejected, paths are ordered and capped, and course completion does not rewrite stored results.

6. **The browser product is real, not a static mock.** The learner and administrator pages read persisted data through route handlers or repositories. Refresh state, matrix publication, assessment rounds, learning paths, completion, and reassessment use SQLite records.

7. **Baseline engineering gates are clean.** ESLint, strict TypeScript, unit/integration tests, deterministic Playwright, production build, dependency audit, and whitespace validation pass at the reviewed revision. No API credential pattern was found in tracked files.

## High-severity findings

### H1. The production journey does not use the tested assessment engine

`AssessmentEngine` and `InMemoryAssessmentStore` are used only by `src/domain/assessment/engine.test.ts`. Production duplicates round order, ownership, persistence, scoring, gating, and completion in the 270-line route handler at `src/app/api/learner/session/route.ts:175-229`.

This matters because tests for structured errors, invalid round order, question ownership, question counts, pinned snapshots, and provisional completion exercise a different implementation. The real route returns `{ error: string }`, not the domain engine's structured error contract. It also commits responses and evidence at `route.ts:199-208`, results at `route.ts:212`, and next-round state at `route.ts:213-228` in separate operations. A failure between them can leave an active assessment with no pending round.

Fix: make one persistent `AssessmentService` own the state transition and inject repositories plus the AI question/evaluation ports. Test that exact service against in-memory SQLite. Keep route handlers as request parsing and response mapping only.

### H2. Matrix versioning covers requirements, not the complete matrix

Issue #6 and issue #14 define a versioned matrix as competencies, levels, importance, rubrics, baseline questions, fallback questions, and course tags. The schema versions only `matrix_competencies` (`src/db/schema.ts:29-34`). Rubrics, tags, and questions are global competency records (`schema.ts:20-25`, `35-37`). The immutability triggers protect only matrix versions and requirement rows (`src/db/migrations/0000_foundation.sql:20-24`).

The live assessment loads current global rubrics and questions by competency (`src/app/api/learner/session/route.ts:47-82`), so the data model cannot prove that later content edits leave an active assessment unchanged. The admin UI avoids the problem by not allowing those edits, but that also leaves the required editor incomplete.

Fix: snapshot every assessed artifact under a matrix version, or version competency content and reference a specific content version from each matrix requirement. Immutability must cover the whole snapshot.

### H3. The confidence formula and question allocation make Round 3 effectively mandatory

A competency needs three evidence items to reach the maximum `evidenceCount / 3` factor. With one fixed baseline item and one fully reliable AI item, confidence cannot exceed `2/3 × 0.9 = 0.60`, below the 0.70 support threshold (`src/domain/assessment/scoring.ts:95-113`).

The real Round 2 asks only 7 to 10 questions (`src/app/api/learner/session/route.ts:98-100`) across matrices containing 6 to 8 competencies. For a seven-competency matrix, supporting more than 80% requires at least two Round 2 items for six competencies, or 12 questions. For the primary eight-competency matrix it requires at least 14. Both exceed the ten-question limit. Without prior learning history, those roles cannot pass the coverage gate after Round 2. The seeded fallback distributes roughly one question per competency (`route.ts:70-82`), guaranteeing Round 3 for the primary demo.

Round 3 adds at most five items. The eight-competency primary role therefore cannot obtain three evidence items for every competency in one assessment and normally ends provisional.

Fix: decide the intended evidence budget before changing code. A coherent option is to make each concise adaptive question cover multiple rubric observations while still producing separate evidence, or revise how evidence count contributes to confidence. Add production-service tests proving both gate branches are reachable for six-, seven-, and eight-competency matrices.

### H4. Live AI single-choice questions are evaluated incorrectly

The AI contract permits `single_choice` adaptive questions and stores each option's demonstrated level. The learner response contains only the option ID. For Round 2 and Round 3, production sends that opaque ID to written-answer evaluation (`src/app/api/learner/session/route.ts:193-197`) and ignores the stored option level. An AI-generated single-choice question can therefore receive an unrelated score or fail semantic validation. The deterministic fallback hides the bug because it produces short-text questions.

Fix: score adaptive single-choice responses deterministically from the stored option snapshot. Send written-answer evaluation only for short-text responses. Add a route-level test with a generated single-choice item.

## Medium-severity findings

### M1. Written evidence is not bounded at the application boundary

The brief calls for bounded short answers. The textarea has no `maxLength` (`src/components/learner/learner-journey.tsx:71-72`), and the route checks only that trimmed input is non-empty (`src/app/api/learner/session/route.ts:181-195`). Very large answers can increase latency and provider cost or exceed context limits.

Add shared Zod request schemas, enforce a documented character limit in both UI and API, and return stable error codes.

### M2. A zero AI confidence is silently converted to 0.60 reliability

`Math.max(0.1, item.confidence || 0.6)` at `src/app/api/learner/session/route.ts:197` treats an explicit confidence of `0` as missing. The deterministic fallback intentionally returns confidence zero, so its default level-two evaluation is persisted with reliability 0.60. This can inflate confidence and gap calculations despite the provider having supplied no confidence.

Use a deliberate reliability policy and `??` for missing values. Seeded fallback should have its own documented evidence treatment rather than masquerading as a confident AI evaluation.

### M3. Course completion accepts inconsistent relationships

The learner route accepts `officialId`, `assessmentId`, `courseId`, and `competencyId` independently (`src/app/api/learner/session/route.ts:261-264`). `LearningService.completeCourse` inserts them without proving that the assessment belongs to the official, the course was recommended for that assessment and competency, or the same course has not already been completed (`src/services/learning-service.ts:44-53`). Foreign keys cannot enforce those cross-record relationships.

Resolve the recommendation from one server-owned recommendation ID, derive the other identifiers, and add an idempotency constraint for completion.

### M4. The administrator cannot maintain all required matrix content

The editor changes competency membership, required level, and importance only (`src/components/admin/matrix-form.tsx:9-17`). Domains, rubric descriptors, baseline questions, fallback questions, and course tags are read-only counts or text in preview. That is materially less than issues #6 and #14 require.

Build version-aware editors for the missing content after fixing H2. Publishing should validate the version snapshot, not global competency records.

### M5. Organization readiness uses a different formula from assessment readiness

The domain engine computes importance-weighted attainment (`src/domain/assessment/scoring.ts:145-151`). Administrator analytics instead report the percentage of all result rows that are both supported and at or above required level (`src/data/admin-repository.ts:96-107`). Both are called readiness, but they answer different questions. The analytics test checks only the all-zero state.

Define the organization aggregation explicitly, persist or recompute assessment readiness consistently, and test non-zero mixed-importance data.

### M6. HTTP inputs rely on TypeScript casts instead of runtime contracts

Most route handlers cast `request.json()` directly. Examples include `src/app/api/completions/route.ts:3`, `src/app/api/assessments/route.ts:3`, and `src/app/api/learner/session/route.ts:241-269`. Malformed values reach SQL or service code, status codes vary by incidental exception, and internal error messages can reach the learner route.

Add route-level Zod schemas and one error envelope with `code`, `message`, and optional field details. Sanitize unexpected exceptions server-side.

### M7. The automated browser mode is not explicitly deterministic

`playwright.config.ts:6` starts the normal development command, which loads `.env.local`. Once real credentials exist, `npm run test:e2e` can make paid, variable network calls. The documented command also omits `--workers=1`, while both projects share one SQLite database and mutate matrix versions (`README.md:21-29`). The delivered gate avoided this by passing a fresh database and one worker manually.

Add `AI_PROVIDER_MODE=seeded`, create a unique database per run, and encode one worker in configuration or isolate project databases. Then the README command will match the verified command.

### M8. AI grounding validation is too weak for the claim it makes

`validateWrittenEvaluations` accepts a summary or rubric reason if any stemmed word overlaps the answer or rubric (`src/ai/contracts.ts:152-171`). A mostly invented claim containing one generic overlapping word passes. The current rejection test covers only a no-overlap sentence.

Use a bounded evidence-quote field tied to offsets or exact normalized spans, or require structured rubric criterion IDs plus a concise explanation. Add adversarial partial-overlap tests.

### M9. The specified implementation stack is present mostly as packages

The runtime uses raw `better-sqlite3` queries across repositories and route handlers; Drizzle supplies a schema file but no runtime ORM calls. The repository also has no actual shadcn component layer. `@libsql/client`, `class-variance-authority`, `clsx`, `lucide-react`, `recharts`, and `tailwind-merge` are installed but unused.

Choose one direction. Either use Drizzle and a small shared component system as specified, or document the deliberate raw-SQL/plain-CSS substitution and remove unused packages. The current middle state creates schema drift and dependency noise.

## Low-severity findings

1. `assessment_rounds.kind` stores a JSON payload rather than a kind value (`src/app/api/learner/session/route.ts:109-111`), while the JSON contains another `kind`. Split `kind` and `payload_json`.
2. Evidence round membership is reconstructed from an ID regex (`route.ts:114-125`). Store `round_id` or `round_number` explicitly.
3. The learner begins an assessment immediately after persona selection. There is no dedicated profile and pinned-matrix review step required by issue #13.
4. Several UI and route modules compress complete functions or JSX trees onto one line. This passes tooling but makes diffs and failure localization harder.
5. Vitest reports a future native-config warning, coverage reporters are configured, but no coverage provider or threshold is installed. The project has no measured coverage baseline.
6. Session assembly performs per-competency rubric, fallback-question, and evidence queries. It is harmless for eight competencies but should be batched before real-scale use.
7. The admin analytics requirement refers to charts, but the current page renders metric cards and a plain list. `recharts` is installed but unused.

## Test-quality assessment

Confirmed passing behavior:

- scoring constants, weighted means, gaps, confidence boundary, contradiction, and 80% gate
- seed integrity and exact catalog counts
- published requirement-row immutability and assessment version IDs
- provider schemas, semantic rejection, retry counts, Gemini to Groq failover, and final fallback
- recommendation evidence filtering, caps, persistence, completion history, and invitation creation
- administrator listing/publication
- complete learner browser path at desktop and the 390px project
- three distinct demo role matrices and recommendation lists
- mobile horizontal-overflow assertion

Missing or weak coverage:

- the production orchestration path is not unit/integration tested as one service
- actual API structured errors and invalid JSON shapes
- both reachable outcomes of the real Round 3 gate for every matrix size
- generated adaptive single-choice scoring
- refresh restoration in Playwright
- active-assessment behavior across a newly published matrix in the browser
- completion ownership, duplicate completion, and transaction recovery
- non-zero mixed-data administrator readiness
- loading, empty, validation, unavailable-course, and provider-failure UI states named by issue #23
- exact 30-second overall provider deadline behavior
- adversarial grounding output with partial word overlap
- coverage percentage and minimum thresholds

The Playwright suite is deterministic only when credentials are explicitly blanked and an isolated database plus one worker are supplied. The fresh review used those controls and passed.

## Repository history

The commit sequence is focused and understandable:

1. `f1ae438` established the Next.js foundation.
2. `ef47214` and `b4dc87a` added deterministic assessment and provider contracts.
3. `447f9a2` added persistence, catalog import, roles, matrices, questions, and seeds.
4. `c4468e2` added recommendations and learning progress.
5. `457f159` and `0b7a29a` assembled learner and administrator workflows.
6. `bc27d1a` applied the shared visual system.
7. `d58388a` through `9147a4e` hardened matching, database paths, browser coverage, migration constraints, generated Next.js declarations, and clarification targeting.

The history shows sensible ticket-sized delivery. The main architectural debt entered when the learner route assembled a second assessment state machine instead of connecting persistence to the tested domain engine.

## Recommended next work

### First: make results trustworthy

1. Replace the route-owned assessment state machine with one persistent service and test it directly.
2. Resolve the confidence and question-budget contradiction. Add mathematical acceptance cases where Round 3 is skipped and where it is required.
3. Version rubrics, questions, and course tags with the matrix snapshot.
4. Correct adaptive single-choice scoring and define seeded-fallback reliability.

### Second: protect state and live-provider use

5. Add runtime schemas, answer limits, stable error codes, ownership checks, and completion idempotency.
6. Strengthen written-evidence grounding.
7. Add an explicit seeded E2E mode, isolated test databases, and route-level integration tests.

### Third: finish the written product scope

8. Complete the administrator content editors and use the same readiness formula throughout analytics.
9. Add the learner profile review step and the missing UI-state tests.
10. Either adopt Drizzle and a real shared component layer or simplify the dependency set and document the substitution.
11. Add coverage instrumentation and thresholds, then split the densest route/UI files at domain boundaries.

## Verification evidence

| Command | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0, 9 files and 54 tests passed in 762 ms |
| `CI=1 GEMINI_API_KEY='' GROQ_API_KEY='' DATABASE_URL=<temporary>/e2e.db npm run test:e2e -- --workers=1 --reporter=line` | exit 0, 10 tests passed in 10.0 s |
| `npm run build` | exit 0, all application routes compiled |
| `npm audit --omit=dev` | exit 0, 0 vulnerabilities |
| `git diff --check` | exit 0 |
| tracked-secret pattern scan | no Gemini, Groq, or private-key pattern found |

The integrated browser suite used seeded fallback, not the configured live providers. Earlier direct health calls returned HTTP 200 for both configured model endpoints, but this review did not run the full learner journey against live Gemini and Groq responses.

## Finding count

- Standards and code quality: 0 critical, 3 high, 9 medium, 7 low or informational
- Specification fidelity: 0 critical, 4 high or materially partial, 6 medium, 3 low
- Worst standards risk: production behavior bypasses the tested assessment engine
- Worst specification risk: the matrix version does not own every assessed artifact, and the evidence budget makes the primary Round 3 gate effectively predetermined
