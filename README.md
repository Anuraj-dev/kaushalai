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
npm run test:e2e
npm run build
git diff --check
```

The app uses deterministic seeded AI behavior when Gemini and Groq credentials are absent.
