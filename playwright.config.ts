import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  webServer: { command: "npm run db:setup && npm run dev", url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI },
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Use Chromium at the mobile viewport so local verification does not require
    // a separate WebKit download while still exercising the supported width.
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],
});
