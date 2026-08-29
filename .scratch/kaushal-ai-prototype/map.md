Label: wayfinder:map

# Chart the Kaushal AI working prototype

## Destination

Deliver a committed, browser-tested Kaushal AI prototype in a new private `Kaushal-AI` repository for a reliable 5-7 minute SIH demonstration by 31 August 2026. The prototype must assess officials against administrator-published job-role matrices, adapt its questioning, identify supported skill gaps, and recommend credible courses through app-owned APIs backed by seeded data.

## Notes

- This effort explicitly carries execution through the working prototype after its decisions are resolved.
- Treat `/home/raja/Downloads/User_Guide.pdf` as evidence of the existing iGOT AI-CBP workflow, not an individual scoring specification.
- Use `sih.json` through an import/data layer. UI components must not contain embedded profile, matrix, score, or course records.
- Consult `CONTEXT.md` for domain language and `docs/research/role-catalog-coverage.md` for catalog limits.
- Gemini is the primary AI provider. Groq with a supported Qwen model is secondary. A seeded bank is the final fallback and is disclosed only in server logs.
- Keep the deadline in view. Do not expand toward production completeness.

## Decisions so far

- [Set the prototype destination](issues/01-set-prototype-destination.md) - A private, committed, browser-tested repository and working SIH demo are the delivery target.
- [Position Kaushal AI beside iGOT AI-CBP](issues/02-position-beside-igot-cbp.md) - Existing CBP role mapping remains upstream; Kaushal AI measures individual evidence against the resulting role matrix.
- [Define the adaptive assessment rounds](issues/03-define-adaptive-assessment-rounds.md) - Fixed baseline, AI-personalized second round, and a gated five-question clarification round.
- [Define explainable scoring evidence](issues/04-define-explainable-scoring.md) - AI interprets bounded evidence while deterministic code calculates proficiency, gaps, and coverage.
- [Define matrix ownership and versioning](issues/05-define-matrix-lifecycle.md) - Administrators create, preview, and publish matrices; active assessments keep their starting version.
- [Select the ten supported job roles](issues/06-select-supported-roles.md) - Seed ten catalog-supported roles and fully build all ten, with Statistical Investigator as the primary demo.
- [Set recommendation, resilience, and scope boundaries](issues/07-set-resilience-and-scope.md) - Immediate catalog-backed recommendations, two AI providers, hidden fallback, and a narrow prototype scope.

## Not yet specified

- Exact organization-wide dashboard conclusions depend on the final seeded officials and assessment result model.
- The final browser acceptance script depends on the learner, administrator, recommendation, and visual decisions.
- Future government-profile and iGOT adapters remain architectural seams until real access exists.

## Out of scope

- Content Quiz Generator, uploaded-document MCQs, video processing, and OCR.
- Live government profile APIs, live iGOT APIs, SSO, and real enrolment/completion synchronization.
- Full AI-CBP designation approval chains, production security certification, and production-scale operations.
- Multilingual delivery, exhaustive accessibility certification, and edge-case coverage unrelated to the demo.
- Public deployment unless Raja explicitly adds it to the delivery target.
