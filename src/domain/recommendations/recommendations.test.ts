import { describe, expect, it } from "vitest";
import { buildLearningPath, isEligibleCourse } from "./recommendations";
import type { CatalogCourse, PriorityGap } from "./types";

const course = (overrides: Partial<CatalogCourse>): CatalogCourse => ({
  id: "course-1", title: "Overview of Basic Statistics", provider: "iGOT",
  detailAvailable: true, searchTerms: ["statistics"], tags: ["statistics"],
  description: "Learn descriptive statistics for official data.", learningOutcomes: ["Select a suitable summary statistic"],
  ...overrides,
});

describe("course eligibility", () => {
  it("does not qualify a course from search membership alone", () => {
    expect(isEligibleCourse(course({ title: "Environmental soil collection", detailAvailable: false, searchTerms: ["sampling"], tags: [], description: "", learningOutcomes: [] }), ["sampling"])).toBe(false);
  });

  it("rejects known specialist false positives", () => {
    expect(isEligibleCourse(course({ title: "Fundamentals of Company Accounts", searchTerms: ["national accounts"], tags: [], description: "Financial statements and company accounts", learningOutcomes: [] }), ["national accounts"])).toBe(false);
  });
});

describe("buildLearningPath", () => {
  const gaps: PriorityGap[] = [
    { competencyId: "statistics", competencyName: "Basic Statistics", priority: 6, tags: ["statistics"] },
    { competencyId: "python", competencyName: "Python", priority: 4, tags: ["python"] },
  ];

  it("orders eligible courses by gap priority and evidence, capped at eight and two per gap", () => {
    const courses = [
      course({ id: "stats-detail", title: "Overview of Basic Statistics" }),
      course({ id: "stats-title", title: "Statistics at Work", detailAvailable: false, tags: [], description: "", learningOutcomes: [] }),
      course({ id: "stats-third", title: "Statistics for Everyone" }),
      course({ id: "python-detail", title: "Introduction to Python", tags: ["python"], description: "Use Python for data analysis." }),
    ];
    const path = buildLearningPath(gaps, courses);
    expect(path.items.map((item) => item.courseId)).toEqual(["stats-detail", "stats-third", "python-detail"]);
    expect(path.items).toHaveLength(3);
    expect(path.items.every((item) => item.rationale.includes(item.competencyName))).toBe(true);
  });

  it("returns an explicit unavailable result when evidence is weak", () => {
    const path = buildLearningPath([{ competencyId: "sampling", competencyName: "Sampling", priority: 5, tags: ["sampling"] }], [course({ title: "Soil Sampling", detailAvailable: false, searchTerms: ["sampling"], tags: [], description: "", learningOutcomes: [] })]);
    expect(path.items).toEqual([]);
    expect(path.unavailable).toEqual([{ competencyId: "sampling", message: "No verified course available in the current catalog." }]);
  });

  it("produces different paths for different gap sets", () => {
    const courses = [course({ id: "statistics" }), course({ id: "python", title: "Python for Data Analysis", tags: ["python"], description: "Python data workflows" }), course({ id: "privacy", title: "Data Privacy Practices", tags: ["data privacy"], description: "Protect personal data" })];
    const a = buildLearningPath([gaps[0]!], courses);
    const b = buildLearningPath([gaps[1]!], courses);
    const c = buildLearningPath([{ competencyId: "privacy", competencyName: "Data Privacy", priority: 6, tags: ["data privacy"] }], courses);
    expect(new Set([a.items[0]?.courseId, b.items[0]?.courseId, c.items[0]?.courseId]).size).toBe(3);
  });
});
