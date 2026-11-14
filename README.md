<p align="center">
  <img src="public/kaushal-logo.svg" alt="Kaushal AI logo" width="88" height="88" />
</p>

<h1 align="center">Kaushal AI</h1>

<p align="center">
  Evidence-based competency assessment and learning paths for public officials.<br />
  Officials answer adaptive rounds. The app shows each skill gap with the evidence behind it.
</p>

<p align="center">
  <a href="https://kaushalai.raja-dev.me/">Live demo</a>
  ·
  <a href="#running-it">Run it locally</a>
  ·
  <a href="#documentation">Docs</a>
</p>

Kaushal AI measures an official's demonstrated competency against the competency matrix for their job role. It then turns each confirmed skill gap into a learning path drawn from the iGOT course catalog. Administrators build the matrices and publish new versions. Each assessment stays pinned to the version it started with.

It is a Next.js 16 web app on React 19, with a SQLite database that is created and seeded on first use. Gemini and Groq keys are optional. Without them, the app answers from a seeded question bank, so the assessment journey runs with no credentials.

## What you get

- **Three rounds, adapted to your answers.** The baseline asks half the competencies in the matrix, rounded up, from a fixed question bank. The personalized round asks 4 or 5 questions that the AI writes from the baseline answers. A clarification round of 1 to 3 questions runs only when coverage is 80% or lower, or when a high-importance competency contradicts itself.
- **Scores you can trace.** Each competency gets an assessment confidence based on its evidence count, the reliability of each source, and how well the answers agree. A result counts as supported at 70% confidence or higher. Every result keeps its evidence rows, so the reason for a gap is visible.
- **Code scores, AI writes.** The AI generates questions and evaluates short written answers against each rubric. Levels, confidence, gaps, coverage and round gating are computed in `src/domain/assessment`, not by the model.
- **Versioned matrices.** An administrator publishes a job-role matrix as a numbered version. An assessment keeps the version it started with. When a newer version is published, the official gets a reassessment invitation, and the completed result stays in place.
- **Learning paths from the iGOT catalog.** The bundled `sih.json` capture holds 222 courses, 25 of them with full detail. Setup imports them and rejects the file if those counts change. A path holds at most eight courses, and at most two per gap. A gap with no verified course is marked unavailable.
- **Live NSSTA training calendar.** Upcoming programmes come from the public NSSTA site and are cached for an hour. When nssta.gov.in is slow or down, the guide answers without them, and the programmes endpoint returns a 502.
- **Quizzes from your own material.** An administrator uploads a PDF, TXT or MD file of up to 10 MB. The model writes 3 to 10 four-option questions, and the prompt requires each one to quote its source verbatim from the file. Scanned PDFs without a text layer are rejected.

## How it works

Every AI call goes through one path in `src/ai/service.ts`. Gemini gets up to two attempts, with an 8 second timeout each. If Gemini still fails, Groq gets up to two attempts, with a 6 second timeout each. If both fail, the seeded bank answers. The whole call has a 30 second deadline, or 75 seconds for quiz generation.

Every provider response is validated against a schema before use. Invalid output counts as a failed attempt. Each attempt and each fallback is logged as an `ai_provider_attempt` event.

## Running it

### Setup

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

`npm run db:setup` migrates and seeds the database ahead of time, then prints the official and course counts. The app seeds on first use as well, so this step is optional.

### Sign in to the demo

To sign in as an official, open `/learner/login` and pick `MOSPI-0001`, `MOSPI-0002` or `MOSPI-0003`. The password only has to be non-empty.

To sign in as an administrator, open `/admin/login` and use `ADMIN-001` with the password `admin-demo`. The check runs in the browser, and the middleware allows every `/admin` request. Do not put real personal data behind this build.

### Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

The end-to-end suite starts its own server on port 3100 in seeded AI mode. It runs the golden path at desktop width and at a 390px mobile width. Install the Playwright browsers first with `npx playwright install`.

```sh
GEMINI_API_KEY='' GROQ_API_KEY='' DATABASE_URL=file:./data/e2e.db npm run test:e2e -- --workers=1
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `data/kaushal-ai.db` when unset | SQLite file path. `.env.example` sets `file:./data/kaushal.db`. |
| `GEMINI_API_KEY` | empty | Primary AI provider. Leave it empty to skip Gemini. |
| `GEMINI_MODEL` | `gemini-3.7-flash` | Gemini model name. |
| `GROQ_API_KEY` | empty | Secondary AI provider, tried after Gemini. |
| `GROQ_MODEL` | `qwen/qwen3.8-27b` | Groq model name. |
| `AI_PROVIDER_MODE` | unset | Set to `seeded` to skip both providers and answer from the seeded bank. |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | unset | Optional Turso copy of assessment snapshots. Without them, assessments live only in the local database. |

`vercel.json` pins functions to the `bom1` region in Mumbai. On Vercel the app writes its database to `/tmp`, which is ephemeral. Set the Turso variables if assessments must survive a cold start.

## Documentation

- [Role and catalog coverage](docs/research/role-catalog-coverage.md): research on which job roles the captured catalog covers.
- [AI provider contracts](docs/research/ai-provider-contracts.md): request and response contracts and runtime limits for Gemini and Groq.
- [Domain language](CONTEXT.md): the terms used in the code and interface, such as assessment round and supported result.
- [Product brief](PRODUCT.md): scope, out-of-scope items and product principles.
- [Design notes](DESIGN.md)
- [Review reports](docs/reviews/): audit and quality reports from earlier passes.
