import { test, expect } from "@playwright/test";

test("landing feature cards use the updated copy", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Assess step by step" })).toBeVisible();
  await expect(page.getByText("Begin with the basics and follow up only where more clarity is needed", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publish with a paper trail" })).toBeVisible();
  await expect(page.getByText("Build, review, and publish competency matrices with a clear version history", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Track progress over time" })).toBeVisible();
  await expect(page.getByText("New progress is recorded while previous assessment results stay intact", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "From skill gaps to the right learning path" })).toBeVisible();
  await expect(page.getByText("Each recommendation comes from what the role requires and what the assessment shows", { exact: true })).toBeVisible();
  await expect(page.getByText("Personalized learning for public officials", { exact: true })).toBeVisible();
  const officialCta = page.getByRole("link", { name: "Continue as an official" });
  const administratorCta = page.getByRole("link", { name: "Continue as administrator" });
  await expect(officialCta).toHaveClass(/kaushal-button-primary/);
  await expect(administratorCta).toHaveClass(/kaushal-button-secondary/);
  await expect(officialCta).not.toHaveClass(/(?:^|\s)button(?:\s|$)/);
  await expect(administratorCta).not.toHaveClass(/(?:^|\s)button(?:\s|$)/);
  expect(await page.locator("body").innerText()).not.toMatch(/\./);
});

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

test("primary official lands on the persisted learning path at desktop", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/learner");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".question-list")).toHaveCount(0);
  await expect(page.getByText("Round 1", { exact: true })).toHaveCount(0);
  await expect(page.getByText("MOSPI-0001", { exact: true })).toHaveCount(0);
  await expect(page.getByText("active", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/matrix v/i)).toHaveCount(0);
  await expect(page.getByText(/Assessment result/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Assessment progress" }).getByText("Learning plan")).toBeVisible();
  await expect(page.locator(".recommendation-card").getByText("Learning plan", { exact: true })).toBeVisible();
  await expect(page.locator(".question-list")).toHaveCount(0);
});

test("learner viewport has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/learner");
  await expect(page.getByRole("heading", { name: /Sign in to your official workspace/ })).toBeVisible();
  await expect(page.getByLabel("Employee code")).toHaveValue("MOSPI-0001");
  await expect(page.getByRole("button", { name: "Change credentials" })).toBeVisible();
  const signInButton = page.getByRole("button", { name: "Sign in" });
  await expect(signInButton).toHaveClass(/kaushal-button-primary/);
  await expect(signInButton).not.toHaveClass(/(?:^|\s)button(?:\s|$)/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("three selectable officials produce distinct persisted competency paths", async ({ request }) => {
  test.setTimeout(180_000);
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
