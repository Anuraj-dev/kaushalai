# Product

<!-- impeccable:product-schema 1 -->

> Inferred from the canonical GitHub decisions, `CONTEXT.md`, and local research because the implementation brief states Raja is unavailable. No open visual preference is recorded as approved.

## Platform

web

## Users

Public officials assess evidence of their current competency against a published job-role matrix. Administrators maintain those matrices and review organization-level readiness and learning progress. SIH judges evaluate the complete prototype in a 5-7 minute walkthrough.

## Product purpose

Kaushal AI measures demonstrated competency, identifies supported gaps, and creates an evidence-backed learning path from the captured iGOT catalog. Success means an official can complete the adaptive journey and understand every score, while an administrator can publish a new immutable matrix version and see computed organization outcomes.

## Positioning

iGOT AI-CBP maps departments and designations upstream. Kaushal AI adds an individual evidence loop against the resulting published role matrix. AI generates bounded questions and evaluates short written evidence; deterministic application code owns scoring, confidence, gaps, and round gating.

## Operating context

The primary demo role is Statistical Investigator / Junior Statistical Officer. Three seeded officials are selectable in the learner flow; ten officials and ten Official Statistics roles feed administrator analytics. The local `sih.json` capture contains 222 courses, including 25 detailed records, and is the prototype's course evidence.

## Capabilities and constraints

- Fixed baseline, 7-10 personalized Round 2 questions, and a gated clarification round of at most five questions.
- Versioned administrator-controlled matrices. Active assessments remain pinned to their starting version.
- Catalog-backed recommendations capped at eight. Weak evidence returns an explicit unavailable state.
- Course completion adds low-reliability learning history and a reassessment invitation. It does not rewrite proficiency.
- Seeded fallback behavior keeps the browser demo working without Gemini or Groq credentials.
- Authentication, SSO, live government/iGOT APIs, document assessment generation, multilingual delivery, and public deployment are out of scope.

## Brand commitments

The product name is Kaushal AI. Language uses the domain terms official, administrator, job role, competency matrix, assessment round, skill gap, assessment confidence, supported result, and learning history. The interface is institutional and direct, never promotional.

## Evidence on hand

- Canonical product decisions and implementation tickets in GitHub issues #1-#23.
- `CONTEXT.md` domain language.
- `docs/research/role-catalog-coverage.md` role and catalog coverage findings.
- `docs/research/ai-provider-contracts.md` provider contracts and runtime limits.
- `sih.json` captured iGOT catalog.
- `/home/raja/Downloads/User_Guide.pdf` as evidence of the upstream AI-CBP workflow only.

## Product principles

- Show the evidence behind every consequential result.
- Prefer an explicit unavailable state to a weak or unrelated recommendation.
- Keep assessment state stable across refreshes and matrix publications.
- Let deterministic rules decide scores and progression.
- Keep the 5-7 minute demonstration path obvious without faking product state in UI code.

## Accessibility and inclusion

The full learner path must work by keyboard and at a 390px viewport without horizontal page overflow. Motion respects reduced-motion preferences. Labels, focus, contrast, loading, failure, and empty states need explicit treatment.
