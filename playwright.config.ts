import { defineConfig, devices } from "@playwright/test";

const e2ePort = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  expect: { timeout: 45_000 },
  webServer: {
    command: `AI_PROVIDER_MODE=seeded DATABASE_URL=file:./data/e2e.db NEXT_DIST_DIR=.next-e2e npm run db:setup && AI_PROVIDER_MODE=seeded DATABASE_URL=file:./data/e2e.db NEXT_DIST_DIR=.next-e2e npm run dev -- --hostname 127.0.0.1 --port ${e2ePort}`,
    url: baseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "true",
    env: { AI_PROVIDER_MODE: "seeded", DATABASE_URL: "file:./data/e2e.db" },
  },
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Use Chromium at the mobile viewport so local verification does not require
    // a separate WebKit download while still exercising the supported width.
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],
});
