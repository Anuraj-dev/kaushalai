import { test, expect } from "@playwright/test";

test("administrator can inspect all ten published matrices", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Role matrices" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await expect(page.getByText("Statistical Investigator / Junior Statistical Officer")).toBeVisible();
});

test("administrator can publish an immutable matrix version", async ({ page }) => {
  await page.goto("/admin/matrices/role-01");
  await page.getByRole("button", { name: "Create new version" }).click();
  await expect(page.getByText("Status: draft")).toBeVisible();
  await page.getByRole("button", { name: "Publish version" }).click();
  await expect(page.getByText(/Version \d+ · published/)).toBeVisible();
});

test("primary official completes the adaptive path at desktop", async ({ page }) => {
  await page.goto("/learner");
  await page.getByRole("button", { name: /Aarav Sharma/ }).click();
  await expect(page.locator(".question-list")).toBeVisible();
  const radios = page.locator('input[type="radio"]');
  await expect(radios).not.toHaveCount(0);
  const count = await radios.count();
  for (let index = 0; index < count; index += 5) await radios.nth(index).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Round 2 · Personalized evidence")).toBeVisible();
  for (const box of await page.locator("textarea").all()) await box.fill("I documented the method, checked the data, and reviewed the result.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect.poll(async () => {
    const finishVisible = await page.getByRole("button", { name: "Finish assessment" }).isVisible().catch(() => false);
    const resultVisible = await page.getByText(/Assessment result/).isVisible().catch(() => false);
    return finishVisible || resultVisible;
  }).toBe(true);
  if (await page.getByRole("button", { name: "Finish assessment" }).count()) {
    await expect(page.getByRole("button", { name: "Finish assessment" })).toBeEnabled();
    for (const box of await page.locator("textarea").all()) await box.fill("I documented the method, checked the data, and reviewed the result.");
    await page.getByRole("button", { name: "Finish assessment" }).click();
  }
  await expect(page.getByText(/Assessment result/)).toBeVisible();
  await expect(page.getByText("Learning plan", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark complete" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Mark complete" }).first().click();
  await expect(page.getByRole("button", { name: "Start reassessment" })).toBeVisible();
  await page.getByRole("button", { name: "Start reassessment" }).click();
  await expect(page.getByText("Round 1 · Fixed baseline")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start reassessment" })).toHaveCount(0);
});

test("learner viewport has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/learner");
  await expect(page.getByRole("heading", { name: "Choose an official to assess" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("three selectable officials produce distinct persisted competency paths", async ({ request }) => {
  const officialsResponse = await request.get("/api/officials?selectable=true");
  expect(officialsResponse.ok()).toBe(true);
  const officials = await officialsResponse.json() as Array<{ id: string; jobRoleName: string }>;
  expect(officials).toHaveLength(3);
  const snapshots: Array<{ role: string; matrix: string; recommendations: string }> = [];
  for (const official of officials) {
    let response = await request.post("/api/learner/session", { data: { action: "start", officialId: official.id } });
    expect(response.ok()).toBe(true);
    let session = await response.json() as { official: { jobRoleName: string }; matrix: { versionId: string; competencies: Array<{ competencyId: string }> }; assessment: { id: string; questions: Array<{ id: string; format: string; options: Array<{ id: string }> }>; status: string }; recommendations: Array<{ title: string }> };
    while (session.assessment.questions.length > 0 && session.assessment.status === "active") {
      const answers = session.assessment.questions.map((question) => ({ questionId: question.id, value: question.format === "single_choice" ? question.options[0]!.id : "I documented the method, checked the data, and reviewed the result." }));
      response = await request.post("/api/learner/session", { data: { action: "submit-round", assessmentId: session.assessment.id, answers } });
      expect(response.ok()).toBe(true);
      session = await response.json() as typeof session;
    }
    expect(session.recommendations.length).toBeGreaterThan(0);
    snapshots.push({ role: session.official.jobRoleName, matrix: session.matrix.competencies.map((item) => item.competencyId).join(","), recommendations: session.recommendations.map((item) => item.title).join("|") });
  }
  expect(new Set(snapshots.map((item) => item.role)).size).toBe(3);
  expect(new Set(snapshots.map((item) => item.matrix)).size).toBe(3);
  expect(new Set(snapshots.map((item) => item.recommendations)).size).toBe(3);
});
