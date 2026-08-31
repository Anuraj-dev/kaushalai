# Kaushal AI

Working prototype for evidence-based competency assessment and catalog-backed learning paths for public officials.

## Setup

```bash
npm install
cp .env.example .env.local
npm run db:setup
```

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run typecheck
npm test
GEMINI_API_KEY='' GROQ_API_KEY='' DATABASE_URL=file:./data/e2e.db npm run test:e2e -- --workers=1
npm run build
git diff --check
```

The app uses deterministic seeded AI behavior when Gemini and Groq credentials are absent (`AI_PROVIDER_MODE=seeded`). The e2e harness forces `AI_PROVIDER_MODE=seeded` and `DATABASE_URL=file:./data/e2e.db` via `playwright.config.ts` (`webServer.env`) and the `GEMINI_API_KEY='' GROQ_API_KEY='' DATABASE_URL=file:./data/e2e.db npm run test:e2e -- --workers=1` invocation to match verification.
