import type { CatalogCourse, LearningPath, PriorityGap } from "./types";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const includesTag = (text: string, tag: string) => ` ${normalize(text)} `.includes(` ${normalize(tag)} `);

function evidenceScore(course: CatalogCourse, tags: string[]): number {
  const normalizedTitle = normalize(course.title);
  const specialistFalsePositive = tags.some((tag) => {
    const normalizedTag = normalize(tag);
    if (normalizedTag === "sampling") return /\b(soil|water|air|mineral|geological|legal)\b/.test(normalizedTitle);
    if (normalizedTag === "national accounts") return /\b(company|financial|pension|postal|partnership)\b/.test(normalizedTitle);
    return false;
  });
  if (specialistFalsePositive) return 0;
  const titleMatch = tags.some((tag) => includesTag(normalizedTitle, tag));
  const detailText = `${course.tags.join(" ")} ${course.description} ${course.learningOutcomes.join(" ")}`;
  const detailMatch = course.detailAvailable && tags.some((tag) => includesTag(detailText, tag));
  if (!titleMatch && !detailMatch) return 0;
  return (detailMatch ? 100 : 0) + (titleMatch ? 20 : 0) + (course.detailAvailable ? 5 : 0);
}

export function isEligibleCourse(course: CatalogCourse, tags: string[]): boolean {
  return evidenceScore(course, tags) > 0;
}

export function buildLearningPath(gaps: PriorityGap[], courses: CatalogCourse[]): LearningPath {
  const items: LearningPath["items"] = [];
  const unavailable: LearningPath["unavailable"] = [];
  const usedCourses = new Set<string>();

  for (const gap of [...gaps].filter((item) => item.priority > 0).sort((a, b) => b.priority - a.priority)) {
    const eligible = courses
      .map((course) => ({ course, score: evidenceScore(course, gap.tags) }))
      .filter(({ course, score }) => score > 0 && !usedCourses.has(course.id))
      .sort((a, b) => b.score - a.score || a.course.title.localeCompare(b.course.title))
      .slice(0, 2);
    if (eligible.length === 0) {
      unavailable.push({ competencyId: gap.competencyId, message: "No verified course available in the current catalog." });
      continue;
    }
    for (const { course } of eligible) {
      if (items.length >= 8) break;
      usedCourses.add(course.id);
      items.push({
        courseId: course.id,
        competencyId: gap.competencyId,
        competencyName: gap.competencyName,
        rank: items.length + 1,
        rationale: `${course.title} provides catalog evidence for the ${gap.competencyName} gap.`,
        evidence: course.detailAvailable ? "detailed" : "title",
      });
    }
    if (items.length >= 8) break;
  }
  return { items, unavailable };
}
